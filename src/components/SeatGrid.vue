<script setup>
import { computed, ref, nextTick, useTemplateRef } from 'vue'
import { onClickOutside, useFullscreen } from '@vueuse/core'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Printer, Menu, LayoutGrid, ShieldOff, UserX, Trash2, ArrowLeftRight, X, Settings, Maximize, Minimize, Save, FolderOpen, Share2 } from 'lucide-vue-next'
import SettingsDialog from '@/components/SettingsDialog.vue'
import SnapshotsDialog from '@/components/SnapshotsDialog.vue'
import ShareDialog from '@/components/ShareDialog.vue'
import { openPrintView } from '@/lib/print'
import { useKeyboardNav, navCursor } from '@/composables/useKeyboardNav'
import { actionMenu, openActionMenu, closeActionMenu } from '@/composables/useActionMenu'

const props = defineProps({ seating: Object })

const gridStyle = computed(() => ({
  gridTemplateColumns: `44px repeat(${props.seating.gridConfig.cols}, 1fr)`,
  gridTemplateRows: `34px repeat(${props.seating.gridConfig.rows}, 1fr)`
}))

const getSeatAt = (r, c) => props.seating.seats.find(s => s.row === r && s.col === c)

// 좌석 한 칸이 지금 어떤 상태인지 (표시 우선순위 순서대로 판정)
const stateOf = (r, c) => {
  const id = `seat-${r}-${c}`
  const seat = getSeatAt(r, c)
  if (props.seating.highlightedSeatId === id) return 'hot'
  if (!seat || seat.status === 'forbidden') return 'void'
  if (seat.status === 'occupied') return 'taken'
  if (props.seating.selectedStudent?.deniedSeatIds?.includes(id)) return 'deny'
  return 'free'
}

const onSeatClick = (seat) => {
  if (!seat || props.seating.isAnimating) return
  const { seating } = props

  if (seating.isSwapMode) {
    if (seat.id === seating.swapSourceId) {
      seating.isSwapMode = false
      seating.swapSourceId = null
    } else {
      seating.executeSwap(seat.id)
    }
    return
  }

  if (seating.isEditMode) {
    if (seat.status === 'occupied') return
    seat.status = seat.status === 'forbidden' ? 'available' : 'forbidden'
  } else if (seating.selectedStudent) {
    if (seating.isRestrictionMode) {
      seating.toggleRestriction(seating.selectedStudent, seat.id)
    } else if (seat.status === 'available') {
      seating.assignManual(seating.selectedStudent, seat)
    }
  }
}

// 좌석을 고르라고 지시해 둔 상태 — 마우스로도 어느 칸을 누를지 보이게 강조한다
const pickingSeat = computed(() => {
  const s = props.seating
  return !!s.placingStudentId || s.isSwapMode || s.isEditMode || s.isRestrictionMode
})

// 진행 중인 지시가 있으면 메뉴를 열지 않고 곧바로 그 지시를 수행한다
const hasPendingOrder = () => {
  const s = props.seating
  return s.isSwapMode || s.isEditMode || s.isRestrictionMode ||
         !!s.placingStudentId || !!s.lineSwapFrom
}

const activateSeat = (r, c) => {
  const { seating } = props
  if (seating.isAnimating) return
  const seat = getSeatAt(r, c)
  const el = document.querySelector(`[data-seat="${r}-${c}"]`)

  if (hasPendingOrder()) {
    if (seating.placingStudentId && seat?.status === 'available') {
      const st = seating.students.find(x => x.id === seating.placingStudentId)
      if (st) return void seating.placeStudentAt(st, seat.id)
    }
    return onSeatClick(seat)
  }
  if (!seat) return
  seating.pendingSeatId = null      // 다른 자리를 열었으면 앞선 '학생 고르기'는 무효
  openActionMenu(el, seatMenu(seat))
}

const seatMenu = (seat) => {
  const { seating } = props
  const code = seating.getSeatCode(seat.id)
  const sel = seating.selectedStudent

  if (seat.status === 'occupied') {
    const name = seating.getStudentName(seat.studentId)
    return {
      title: `${code} · ${name}`,
      items: [
        { key: 'move', label: '자리 옮기기', run: () => seating.startSwap(seat.id) },
        { key: 'off', label: '배정 해제', danger: true, run: () => seating.cancelAssignment(seat.id) }
      ]
    }
  }

  const denied = sel?.deniedSeatIds?.includes(seat.id)
  return {
    title: `${code} · ${seat.status === 'forbidden' ? '없는 자리' : '빈 자리'}`,
    items: [
      seat.status === 'available' && sel && !denied && {
        key: 'sit', label: `${sel.name} 앉히기`,
        run: () => seating.placeStudentAt(sel, seat.id)
      },
      seat.status === 'available' && {
        key: 'pick', label: '학생 고르기',
        run: () => { seating.startPickingFor(seat.id); navCursor.toStudents() }
      },
      seat.status === 'available' && sel && {
        key: 'deny', label: denied ? `${sel.name} 금지 해제` : `${sel.name}에게 금지`,
        run: () => seating.toggleRestriction(sel, seat.id)
      },
      {
        key: 'forbid',
        label: seat.status === 'forbidden' ? '자리 되살리기' : '이 자리 없애기',
        danger: seat.status !== 'forbidden',
        run: () => seating.toggleSeatForbidden(seat)
      }
    ]
  }
}

// 행·열 머리글 메뉴
const activateAxis = (type, index, el) => {
  const { seating } = props
  if (seating.isAnimating) return

  if (seating.lineSwapFrom) return seating.executeLineSwap(type, index)
  if (seating.isRestrictionMode) return seating.toggleBatchRestriction(type, index)

  const info = seating.lineInfo(type, index)
  const label = type === 'row' ? `${index + 1}행` : `${String.fromCharCode(65 + index)}열`
  const sel = seating.selectedStudent

  openActionMenu(el, {
    title: `${label} · ${info.total}칸`,
    hint: sel ? '' : '학생을 먼저 고르면 금지 지정도 할 수 있습니다.',
    items: [
      sel && {
        key: 'deny',
        label: info.allDenied ? `${sel.name} 금지 해제` : `${sel.name}에게 줄 전체 금지`,
        run: () => seating.toggleBatchRestriction(type, index)
      },
      {
        key: 'clear', label: '이 줄 배정 해제', note: info.occupied ? `${info.occupied}명` : '',
        disabled: info.occupied === 0, danger: true,
        run: () => seating.clearLineAssignments(type, index)
      },
      {
        key: 'shift', kind: 'arrows', label: '한 칸씩 밀기',
        options: ['←', '→', '↑', '↓'].map(d => ({
          key: 'shift' + d, glyph: d,
          title: d + ' 방향으로 한 칸',
          disabled: !seating.canShiftLine(type, index, d),
          run: () => seating.shiftLine(type, index, d)
        }))
      },
      {
        key: 'swap', label: `다른 ${type === 'row' ? '행' : '열'}과 통째 교체`,
        disabled: info.occupied === 0,
        run: () => seating.startLineSwap(type, index)
      },
      {
        key: 'forbid',
        label: info.forbidden === info.total ? '이 줄 되살리기' : '이 줄 자리 없애기',
        note: info.occupied ? '앉은 자리 제외' : '',
        danger: info.forbidden !== info.total,
        run: () => seating.setLineForbidden(type, index, info.forbidden !== info.total)
      }
    ]
  })
}

// 지금 어떤 모드인지 알려주는 안내 배지
const hint = computed(() => {
  const s = props.seating
  if (s.lineSwapFrom) return `교체할 ${s.lineSwapFrom.type === 'row' ? '행' : '열'}을 고르세요`
  if (s.isSwapMode) return '교체할 자리를 고르세요'
  if (s.placingStudentId) return `${s.getStudentName(s.placingStudentId)} 앉힐 자리를 고르세요`
  if (s.pendingSeatId) return `${s.getSeatCode(s.pendingSeatId)}에 앉힐 학생을 고르세요`
  if (s.isRestrictionMode) return '이 학생이 앉으면 안 될 자리를 고르세요'
  if (s.isEditMode) return '없앨 자리를 고르세요'
  if (s.selectedStudent) return '자리를 직접 고르거나 룰렛을 돌리세요'
  return null
})

// 전체화면. 창 크기가 바뀌면 App.vue의 resize 리스너가 배율을 다시 맞춘다.
const { isSupported: canFullscreen, isFullscreen, toggle: toggleFullscreen } = useFullscreen()

// --- 햄버거 메뉴 ---
// reka-ui DropdownMenu는 body로 포탈되어 부모의 배율을 못 받으므로
// 캔버스 안에 직접 띄우는 가벼운 패널로 구현한다.
const isMenuOpen = ref(false)
const menuRef = useTemplateRef('menuRef')
onClickOutside(menuRef, () => { isMenuOpen.value = false })

// 햄버거와 액션 메뉴 중 열려 있는 쪽을 키보드 조작이 다루게 한다
const anyMenuOpen = computed(() => isMenuOpen.value || actionMenu.open)
const closeAnyMenu = (opt = {}) => {
  if (actionMenu.open) return closeActionMenu(opt)
  if (isMenuOpen.value) {
    isMenuOpen.value = false
    if (opt.restoreFocus !== false) menuRef.value?.querySelector('[data-kb]')?.focus()
  }
}

// 키보드 커서: Tab으로 구역을 오가고 방향키로 항목을 옮긴다
const { focusMenuFirst } = useKeyboardNav(props.seating, {
  menu: { isOpen: anyMenuOpen, close: closeAnyMenu },
  onActivate: (r, c) => activateSeat(r, c)
})

// 메뉴를 열면 첫 항목으로 커서를 옮겨 바로 방향키로 고를 수 있게 한다
const openMenu = async () => {
  isMenuOpen.value = !isMenuOpen.value
  if (isMenuOpen.value) { await nextTick(); focusMenuFirst() }
}

// --- 되돌릴 수 없는 동작 확인 ---
const confirmKind = ref(null)
const isSettingsOpen = ref(false)

// --- 배치 저장 ---
const isSaveOpen = ref(false)
const isLoadOpen = ref(false)
const isShareOpen = ref(false)
const saveName = ref('')
const saveDone = ref(false)

const openSave = () => {
  isMenuOpen.value = false
  saveName.value = props.seating.defaultSnapshotName()
  saveDone.value = false
  isSaveOpen.value = true
}

const doSave = () => {
  if (!props.seating.saveSnapshot(saveName.value)) return
  saveDone.value = true
  setTimeout(() => { isSaveOpen.value = false }, 700)
}

const CONFIRMS = {
  assignments: {
    title: '전체 배정 취소',
    description: '모든 학생을 자리에서 내보냅니다. 교실 구조와 금지 좌석 설정은 그대로 유지됩니다.',
    action: () => props.seating.clearAllAssignments()
  },
  restrictions: {
    title: '금지 좌석 전체 해제',
    description: '모든 학생에게 지정해 둔 금지 좌석을 한 번에 없앱니다. 되돌릴 수 없습니다.',
    action: () => props.seating.clearAllRestrictions()
  }
}

const confirmData = computed(() => (confirmKind.value ? CONFIRMS[confirmKind.value] : null))

const runMenu = (fn) => { isMenuOpen.value = false; fn() }
const askConfirm = (kind) => { isMenuOpen.value = false; confirmKind.value = kind }
const acceptConfirm = () => { confirmData.value?.action(); confirmKind.value = null }
</script>

<template>
  <main class="flex-1 min-w-0 flex flex-col overflow-hidden p-6 pl-3 gap-5">

    <div class="flex justify-between items-center gap-4 pt-1">
      <div class="flex items-center gap-4 min-w-0">
        <Transition name="hint">
          <span v-if="hint" class="ui-pill truncate"
                style="background: var(--c-accent-soft); color: var(--c-primary-deep)">{{ hint }}</span>
        </Transition>
      </div>

      <div class="flex gap-2.5 items-center shrink-0" data-zone="toolbar">
        <Button
          v-if="seating.selectedStudent && !seating.isEditMode && !seating.isRestrictionMode"
          data-kb
          @click="seating.assignBySpin(seating.selectedStudent)"
          :disabled="seating.isAnimating"
        >
          룰렛 돌리기
        </Button>

        <Button
          v-if="seating.selectedStudent && !seating.isEditMode"
          data-kb
          @click="seating.isRestrictionMode = !seating.isRestrictionMode"
          :disabled="seating.isAnimating"
          :variant="seating.isRestrictionMode ? 'destructive' : 'outline'"
        >
          {{ seating.isRestrictionMode ? '설정 완료' : '금지 지정' }}
        </Button>

        <Button v-if="seating.isEditMode" data-kb @click="seating.isEditMode = false" variant="destructive">
          구조 설정 완료
        </Button>

        <Button
          v-if="canFullscreen"
          data-kb
          variant="outline" size="icon"
          :title="isFullscreen ? '전체화면 끝내기' : '전체화면'"
          @click="toggleFullscreen"
        >
          <Minimize v-if="isFullscreen" class="w-5 h-5" />
          <Maximize v-else class="w-5 h-5" />
        </Button>

        <Button variant="outline" size="icon" title="설정" data-kb
                :disabled="seating.isAnimating" @click="isSettingsOpen = true">
          <Settings class="w-5 h-5" />
        </Button>

        <div ref="menuRef" class="relative">
          <Button variant="outline" size="icon" data-kb @click="openMenu" title="메뉴">
            <Menu class="w-5 h-5" />
          </Button>

          <Transition name="menu">
            <div v-if="isMenuOpen" data-zone="menu" class="ui-card absolute right-0 top-full mt-3 w-[320px] z-50 p-2.5">
              <button class="menu-item" data-kb @click="openSave">
                <Save class="w-[18px] h-[18px] shrink-0 opacity-45" />
                <span class="flex-1">배치 저장하기</span>
                <span v-if="seating.snapshots.length" class="text-[15px] opacity-45">{{ seating.snapshots.length }}</span>
              </button>

              <button class="menu-item" data-kb @click="runMenu(() => { isLoadOpen = true })">
                <FolderOpen class="w-[18px] h-[18px] shrink-0 opacity-45" />
                <span class="flex-1">배치 불러오기</span>
                <span v-if="seating.snapshots.length" class="text-[15px] opacity-45">{{ seating.snapshots.length }}</span>
              </button>

              <div class="h-px my-2 mx-2" style="background: var(--c-line)" />

              <button class="menu-item" data-kb @click="runMenu(() => { isShareOpen = true })">
                <Share2 class="w-[18px] h-[18px] shrink-0 opacity-45" /> 링크로 보내기
              </button>

              <button class="menu-item" data-kb @click="runMenu(() => openPrintView(seating))">
                <Printer class="w-[18px] h-[18px] shrink-0 opacity-45" /> 인쇄
              </button>

              <button
                class="menu-item" data-kb
                :disabled="seating.isRestrictionMode || seating.isAnimating"
                @click="runMenu(() => seating.isEditMode = !seating.isEditMode)"
              >
                <LayoutGrid class="w-[18px] h-[18px] shrink-0 opacity-45" /> 교실 구조 설정
              </button>

              <div class="h-px my-2 mx-2" style="background: var(--c-line)" />

              <button
                v-if="seating.selectedStudent?.deniedSeatIds?.length"
                class="menu-item" data-kb
                @click="runMenu(() => seating.clearStudentRestrictions(seating.selectedStudent))"
              >
                <UserX class="w-[18px] h-[18px] shrink-0 opacity-45" />
                <span class="flex-1 truncate">{{ seating.selectedStudent.name }} 금지 해제</span>
                <span class="text-[15px] opacity-45">{{ seating.selectedStudent.deniedSeatIds.length }}</span>
              </button>

              <button
                class="menu-item menu-item--danger" data-kb
                :disabled="seating.restrictionCount === 0 || seating.isAnimating"
                @click="askConfirm('restrictions')"
              >
                <ShieldOff class="w-[18px] h-[18px] shrink-0" />
                <span class="flex-1">금지 좌석 전체 해제</span>
                <span v-if="seating.restrictionCount" class="text-[15px]">{{ seating.restrictionCount }}</span>
              </button>

              <button
                class="menu-item menu-item--danger" data-kb
                :disabled="seating.isAnimating"
                @click="askConfirm('assignments')"
              >
                <Trash2 class="w-[18px] h-[18px] shrink-0" /> 전체 배정 취소
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <div class="board">칠판</div>

    <div class="flex-1 min-h-0">
      <div class="grid gap-2.5 w-full h-full" :style="gridStyle" data-zone="seats">

        <div />

        <button
          v-for="c in seating.gridConfig.cols" :key="'col-h-' + c"
          :data-axis="`col-${c - 1}`" data-kb
          :disabled="seating.isAnimating"
          @click="activateAxis('col', c - 1, $event.currentTarget)"
          class="axis"
          :class="[
            seating.isRestrictionMode ? 'axis--live' : '',
            seating.lineSwapFrom?.type === 'col' && seating.lineSwapFrom.index === c - 1 ? 'axis--picked' : ''
          ]"
        >
          {{ String.fromCharCode(64 + c) }}
        </button>

        <template v-for="r in seating.gridConfig.rows" :key="'row-g-' + r">
          <button
            :data-axis="`row-${r - 1}`" data-kb
            :disabled="seating.isAnimating"
            @click="activateAxis('row', r - 1, $event.currentTarget)"
            class="axis"
            :class="[
              seating.isRestrictionMode ? 'axis--live' : '',
              seating.lineSwapFrom?.type === 'row' && seating.lineSwapFrom.index === r - 1 ? 'axis--picked' : ''
            ]"
          >
            {{ r }}
          </button>

          <div
            v-for="c in seating.gridConfig.cols" :key="`cell-${r - 1}-${c - 1}`"
            :data-seat="`${r - 1}-${c - 1}`" data-kb tabindex="0"
            @click="activateSeat(r - 1, c - 1)"
            class="seat group select-none"
            :class="[
              `seat--${stateOf(r - 1, c - 1)}`,
              seating.swapSourceId === `seat-${r - 1}-${c - 1}` ? 'is-swapping' : ''
            ]"
          >
            <template v-if="stateOf(r - 1, c - 1) === 'hot'">
              <span class="text-[54px] font-black leading-none">{{ seating.countdownValue }}</span>
            </template>

            <template v-else-if="stateOf(r - 1, c - 1) === 'taken'">
              <span class="text-[36px] font-bold leading-tight text-center px-2 break-keep">
                {{ seating.getStudentName(getSeatAt(r - 1, c - 1).studentId) }}
              </span>

              <template v-if="!seating.isAnimating && !seating.isSwapMode">
                <button
                  @click.stop="seating.startSwap(getSeatAt(r - 1, c - 1).id)"
                  class="seat-act left-2.5" title="자리 교체"
                >
                  <ArrowLeftRight class="w-4 h-4" />
                </button>
                <button
                  @click.stop="seating.cancelAssignment(getSeatAt(r - 1, c - 1).id)"
                  class="seat-act right-2.5" title="배정 취소"
                >
                  <X class="w-4 h-4" />
                </button>
              </template>
            </template>

            <template v-else-if="stateOf(r - 1, c - 1) === 'deny'">
              <X class="w-9 h-9" stroke-width="3" />
            </template>

            <template v-else-if="stateOf(r - 1, c - 1) === 'free'">
              <span class="text-[15px] font-bold leading-none opacity-70">
                {{ String.fromCharCode(64 + c) }}{{ r }}
              </span>
            </template>
          </div>
        </template>
      </div>
    </div>

    <SettingsDialog v-model:open="isSettingsOpen" :seating="seating" />
    <SnapshotsDialog v-model:open="isLoadOpen" :seating="seating" />
    <ShareDialog v-model:open="isShareOpen" :seating="seating" />

    <Dialog v-model:open="isSaveOpen">
      <DialogContent class="!rounded-[24px] !border-0 !p-9 !gap-5 sm:max-w-xl" style="box-shadow: var(--shadow-md)">
        <DialogHeader>
          <DialogTitle class="text-[25px] font-black leading-tight">배치 저장하기</DialogTitle>
          <DialogDescription class="text-[16px] leading-relaxed pt-1" style="color: var(--c-ink-soft)">
            지금 자리 배치를 이름 붙여 남깁니다. 나중에 설정에서 그대로 되돌릴 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <input
          v-model="saveName" class="name-field"
          placeholder="배치 이름" @keyup.enter="doSave"
        />

        <p v-if="seating.saveError" class="text-[15px] font-bold" style="color: var(--c-primary)">
          {{ seating.saveError }}
        </p>

        <DialogFooter class="gap-2.5">
          <Button variant="ghost" @click="isSaveOpen = false">취소</Button>
          <Button :disabled="saveDone" @click="doSave">{{ saveDone ? '저장했습니다' : '저장' }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="confirmKind !== null" @update:open="v => { if (!v) confirmKind = null }">
      <DialogContent class="!rounded-[24px] !border-0 !p-9 !gap-5 sm:max-w-lg" style="box-shadow: var(--shadow-md)">
        <DialogHeader>
          <DialogTitle class="text-[26px] font-black leading-tight">{{ confirmData?.title }}</DialogTitle>
          <DialogDescription class="text-[17px] leading-relaxed pt-1" style="color: var(--c-ink-soft)">
            {{ confirmData?.description }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2.5">
          <Button variant="ghost" @click="confirmKind = null">취소</Button>
          <Button variant="destructive" @click="acceptConfirm">실행</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </main>
</template>

<style scoped>
.name-field {
  width: 100%;
  height: 52px;
  padding: 0 20px;
  border-radius: 16px;
  border: 0;
  outline: none;
  font-family: inherit;
  font-size: 18px;
  font-weight: 700;
  color: var(--c-ink);
  background: var(--c-bg);
  box-shadow: inset 0 0 0 1.5px var(--c-line);
}
.name-field:focus { box-shadow: inset 0 0 0 2px var(--c-primary); }

/* 교실 앞쪽. 화면 격자는 칠판이 위인 학생 시점이다. */
.board {
  width: 46%;
  min-width: 260px;
  margin: 0 auto;
  padding: 9px 0;
  border-radius: 999px;
  background: var(--c-strong);
  color: #fff;
  text-align: center;
  font-size: 19px;
  font-weight: 900;
  letter-spacing: 0.42em;
  text-indent: 0.42em;
}

.axis {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--c-muted);
  border-radius: 8px;
  transition: color 140ms ease, background-color 140ms ease;
}
.axis { cursor: pointer; }
.axis:hover:not(:disabled) { background: var(--c-accent-soft); color: var(--c-ink); }
.axis--live { color: var(--c-primary); }
.axis--picked { color: #fff; background: var(--c-primary); }

.is-swapping { box-shadow: 0 0 0 4px var(--c-primary), var(--shadow-md); z-index: 20; }

.seat-act {
  position: absolute;
  top: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  opacity: 0;
  transition: opacity 140ms ease, background-color 140ms ease;
  z-index: 40;
}
.group:hover .seat-act { opacity: 1; }
.seat-act:hover { background: var(--c-primary); }

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 700;
  text-align: left;
  color: var(--c-ink);
  transition: background-color 140ms ease;
}
.menu-item:hover:not(:disabled) { background: var(--c-accent-soft); }
.menu-item:disabled { opacity: 0.35; }
.menu-item--danger { color: var(--c-primary); }

.hint-enter-active, .hint-leave-active { transition: opacity 200ms ease, transform 200ms ease; }
.hint-enter-from, .hint-leave-to { opacity: 0; transform: translateX(-8px); }

.menu-enter-active, .menu-leave-active { transition: opacity 150ms ease, transform 150ms ease; }
.menu-enter-from, .menu-leave-to { opacity: 0; transform: translateY(-8px) scale(0.97); }
</style>
