<script setup>
import { computed, ref, useTemplateRef } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Printer, Menu, LayoutGrid, ShieldOff, UserX, Trash2, ArrowLeftRight, X, Settings } from 'lucide-vue-next'
import SettingsDialog from '@/components/SettingsDialog.vue'
import { openPrintView } from '@/lib/print'

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

// 지금 어떤 모드인지 알려주는 안내 배지
const hint = computed(() => {
  const s = props.seating
  if (s.isSwapMode) return '교체할 자리를 고르세요'
  if (s.isRestrictionMode) return '이 학생이 앉으면 안 될 자리를 고르세요'
  if (s.isEditMode) return '없앨 자리를 고르세요'
  if (s.selectedStudent) return '자리를 직접 고르거나 룰렛을 돌리세요'
  return null
})

// --- 햄버거 메뉴 ---
// reka-ui DropdownMenu는 body로 포탈되어 부모의 배율을 못 받으므로
// 캔버스 안에 직접 띄우는 가벼운 패널로 구현한다.
const isMenuOpen = ref(false)
const menuRef = useTemplateRef('menuRef')
onClickOutside(menuRef, () => { isMenuOpen.value = false })

// --- 되돌릴 수 없는 동작 확인 ---
const confirmKind = ref(null)
const isSettingsOpen = ref(false)

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
        <h2 class="text-[30px] font-black leading-none shrink-0">우리 교실</h2>
        <Transition name="hint">
          <span v-if="hint" class="ui-pill truncate"
                style="background: var(--c-accent-soft); color: var(--c-primary-deep)">{{ hint }}</span>
        </Transition>
      </div>

      <div class="flex gap-2.5 items-center shrink-0">
        <Button
          v-if="seating.selectedStudent && !seating.isEditMode && !seating.isRestrictionMode"
          @click="seating.assignBySpin(seating.selectedStudent)"
          :disabled="seating.isAnimating"
        >
          룰렛 돌리기
        </Button>

        <Button
          v-if="seating.selectedStudent && !seating.isEditMode"
          @click="seating.isRestrictionMode = !seating.isRestrictionMode"
          :disabled="seating.isAnimating"
          :variant="seating.isRestrictionMode ? 'destructive' : 'outline'"
        >
          {{ seating.isRestrictionMode ? '설정 완료' : '금지 지정' }}
        </Button>

        <Button v-if="seating.isEditMode" @click="seating.isEditMode = false" variant="destructive">
          구조 설정 완료
        </Button>

        <Button variant="outline" size="icon" title="설정"
                :disabled="seating.isAnimating" @click="isSettingsOpen = true">
          <Settings class="w-5 h-5" />
        </Button>

        <div ref="menuRef" class="relative">
          <Button variant="outline" size="icon" @click="isMenuOpen = !isMenuOpen" title="메뉴">
            <Menu class="w-5 h-5" />
          </Button>

          <Transition name="menu">
            <div v-if="isMenuOpen" class="ui-card absolute right-0 top-full mt-3 w-[320px] z-50 p-2.5">
              <button class="menu-item" @click="runMenu(() => openPrintView(seating))">
                <Printer class="w-[18px] h-[18px] shrink-0 opacity-45" /> 인쇄
              </button>

              <button
                class="menu-item"
                :disabled="seating.isRestrictionMode || seating.isAnimating"
                @click="runMenu(() => seating.isEditMode = !seating.isEditMode)"
              >
                <LayoutGrid class="w-[18px] h-[18px] shrink-0 opacity-45" /> 교실 구조 설정
              </button>

              <div class="h-px my-2 mx-2" style="background: var(--c-line)" />

              <button
                v-if="seating.selectedStudent?.deniedSeatIds?.length"
                class="menu-item"
                @click="runMenu(() => seating.clearStudentRestrictions(seating.selectedStudent))"
              >
                <UserX class="w-[18px] h-[18px] shrink-0 opacity-45" />
                <span class="flex-1 truncate">{{ seating.selectedStudent.name }} 금지 해제</span>
                <span class="text-[15px] opacity-45">{{ seating.selectedStudent.deniedSeatIds.length }}</span>
              </button>

              <button
                class="menu-item menu-item--danger"
                :disabled="seating.restrictionCount === 0 || seating.isAnimating"
                @click="askConfirm('restrictions')"
              >
                <ShieldOff class="w-[18px] h-[18px] shrink-0" />
                <span class="flex-1">금지 좌석 전체 해제</span>
                <span v-if="seating.restrictionCount" class="text-[15px]">{{ seating.restrictionCount }}</span>
              </button>

              <button
                class="menu-item menu-item--danger"
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

    <div class="flex-1 min-h-0">
      <div class="grid gap-2.5 w-full h-full" :style="gridStyle">

        <div />

        <button
          v-for="c in seating.gridConfig.cols" :key="'col-h-' + c"
          @click="seating.toggleBatchRestriction('col', c - 1)"
          :disabled="!seating.isRestrictionMode"
          class="axis" :class="seating.isRestrictionMode ? 'axis--live' : ''"
        >
          {{ String.fromCharCode(64 + c) }}
        </button>

        <template v-for="r in seating.gridConfig.rows" :key="'row-g-' + r">
          <button
            @click="seating.toggleBatchRestriction('row', r - 1)"
            :disabled="!seating.isRestrictionMode"
            class="axis" :class="seating.isRestrictionMode ? 'axis--live' : ''"
          >
            {{ r }}
          </button>

          <div
            v-for="c in seating.gridConfig.cols" :key="`cell-${r - 1}-${c - 1}`"
            @click="onSeatClick(getSeatAt(r - 1, c - 1))"
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

    <Dialog :open="confirmKind !== null" @update:open="v => { if (!v) confirmKind = null }">
      <DialogContent class="!rounded-[22px] !border-0 !p-8 !gap-5 sm:max-w-md" style="box-shadow: var(--shadow-md)">
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
.axis--live { color: var(--c-primary); cursor: pointer; }
.axis--live:hover { background: var(--c-accent-soft); }

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
