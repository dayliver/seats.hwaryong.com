<script setup>
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Plus } from 'lucide-vue-next'
import { openActionMenu } from '@/composables/useActionMenu'
import { navCursor } from '@/composables/useKeyboardNav'

const props = defineProps({ seating: Object })
const isImportOpen = ref(false)
const rawInput = ref("")

const remaining = computed(() => props.seating.students.filter(s => !s.isAssigned).length)

// 학생을 누르면 그 학생으로 무엇을 할지 묻는다.
// 다만 이미 내려둔 지시가 있으면 메뉴 없이 곧바로 그 지시를 수행한다.
const pick = (s, el) => {
  const seating = props.seating
  if (seating.isAnimating) return

  // 빈 자리에서 '학생 고르기'로 들어온 경우 — 바로 그 자리에 앉힌다
  if (seating.pendingSeatId) return void seating.placeStudentAt(s, seating.pendingSeatId)

  // 금지 지정 중이면 대상 학생만 갈아탄다
  if (seating.isRestrictionMode) {
    seating.selectedStudent = s
    return
  }

  seating.placingStudentId = null   // 다른 학생을 열었으면 앞선 '직접 배정'은 무효
  seating.selectedStudent = s
  openActionMenu(el, studentMenu(s))
}

const studentMenu = (s) => {
  const seating = props.seating
  const seatId = seating.getStudentSeatId(s.id)
  const denied = s.deniedSeatIds?.length || 0

  return {
    title: s.name + (seatId ? ` · ${seating.getSeatCode(seatId)}` : ''),
    items: [
      !s.isAssigned && {
        key: 'spin', label: '무작위 배정 (룰렛)',
        run: () => seating.assignBySpin(s)
      },
      !s.isAssigned && {
        key: 'place', label: '직접 배정',
        run: () => { seating.startPlacing(s); navCursor.toSeats() }
      },
      s.isAssigned && {
        key: 'move', label: '자리 옮기기',
        run: () => { seating.startSwap(seatId); navCursor.toSeats() }
      },
      s.isAssigned && {
        key: 'off', label: '배정 해제', danger: true,
        run: () => seating.cancelAssignment(seatId)
      },
      {
        key: 'deny', label: '금지 좌석 지정', note: denied ? String(denied) : '',
        run: () => { seating.selectedStudent = s; seating.isRestrictionMode = true; navCursor.toSeats() }
      },
      denied > 0 && {
        key: 'denyOff', label: '금지 좌석 모두 해제', danger: true,
        run: () => seating.clearStudentRestrictions(s)
      }
    ]
  }
}

const handleImport = () => {
  props.seating.importStudents(rawInput.value)
  rawInput.value = ""
  isImportOpen.value = false
}
</script>

<template>
  <aside class="w-[400px] shrink-0 p-6 pr-3" data-zone="students">
    <div class="ui-card h-full flex flex-col overflow-hidden">

      <div class="px-7 pt-7 pb-5 flex justify-between items-center gap-3">
        <div>
          <p class="text-[13px] font-bold tracking-[0.2em] uppercase" style="color: var(--c-muted)">
            Students · {{ seating.students.length }}
          </p>
          <h1 class="text-[30px] font-black leading-tight mt-1 truncate max-w-[240px]">
            {{ seating.activeRoster?.name || '우리 반' }}
          </h1>
        </div>
        <Dialog v-model:open="isImportOpen">
          <DialogTrigger asChild>
            <Button size="sm" variant="secondary" data-kb><Plus class="w-4 h-4" /> 명단</Button>
          </DialogTrigger>
          <DialogContent class="!rounded-[22px] !border-0 !p-8 !gap-5 sm:max-w-lg" style="box-shadow: var(--shadow-md)">
            <DialogHeader>
              <DialogTitle class="text-[26px] font-black leading-tight">명단 붙여넣기</DialogTitle>
              <DialogDescription class="text-[17px] leading-relaxed pt-1" style="color: var(--c-ink-soft)">
                엑셀에서 복사한 이름을 그대로 붙여넣으세요. 줄바꿈·쉼표·탭 모두 인식합니다.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              v-model="rawInput"
              class="h-64 !text-[18px] !rounded-2xl !border-0 leading-relaxed !p-5"
              style="box-shadow: inset 0 0 0 1.5px var(--c-line); background: var(--c-bg)"
              placeholder="강시훈&#10;강승구..."
            />
            <DialogFooter><Button @click="handleImport">명단 만들기</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea class="flex-1 overflow-hidden">
        <!-- 위아래 여백은 첫·마지막 항목의 포커스 외곽선(3px+오프셋 3px)과
             선택 글로우가 ScrollArea에 잘리지 않도록 비워둔 자리다 -->
        <div class="px-4 pt-2 pb-3 flex flex-col gap-1.5">
          <button
            v-for="s in seating.students" :key="s.id"
            data-kb
            @click="pick(s, $event.currentTarget)"
            :disabled="seating.isAnimating"
            class="w-full h-[54px] px-4 rounded-2xl flex items-center gap-3 text-left transition-all duration-150 disabled:opacity-100"
            :class="[
              seating.selectedStudent?.id === s.id ? 'is-picked' : (s.isAssigned ? 'is-done' : 'is-idle'),
              seating.pendingSeatId ? 'is-target' : ''
            ]"
          >
            <span class="text-[21px] font-bold leading-none truncate flex-1">{{ s.name }}</span>

            <span v-if="s.deniedSeatIds?.length" class="text-[14px] font-bold leading-none shrink-0 opacity-75">
              ✕{{ s.deniedSeatIds.length }}
            </span>

            <span v-if="s.isAssigned" class="badge shrink-0">{{ seating.getStudentSeatCode(s.id) }}</span>
          </button>
        </div>
      </ScrollArea>

      <div class="px-7 py-6 flex items-center justify-between"
           style="border-top: 1.5px solid var(--c-line)">
        <span class="text-[16px] font-bold" style="color: var(--c-ink-soft)">아직 자리 없는 학생</span>
        <span class="text-[34px] font-black leading-none"
              :style="{ color: remaining ? 'var(--c-primary)' : 'var(--c-muted)' }">{{ remaining }}</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.is-idle { background: transparent; color: var(--c-ink); }
.is-done { background: transparent; color: var(--c-muted); }

/* 어떤 상태든 마우스가 올라간 행은 보여야 한다 (배정된 학생도 고를 수 있으므로) */
.is-idle:hover,
.is-done:hover { background: var(--c-accent-soft); color: var(--c-ink); }

.is-picked {
  background: var(--grad);
  color: #fff;
  box-shadow: var(--shadow-hot);
}
.is-picked:hover { filter: brightness(1.06); }

/* 빈 자리에 앉힐 학생을 고르는 중 — 누를 대상이 카드처럼 떠오른다 */
.is-target:hover {
  background: var(--c-surface);
  color: var(--c-ink);
  box-shadow: inset 0 0 0 2px var(--c-primary), var(--shadow-md);
}
.is-target.is-picked:hover {
  background: var(--grad);
  color: #fff;
  box-shadow: inset 0 0 0 2px var(--c-surface), var(--shadow-hot);
}

.badge {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  background: var(--c-accent-soft);
  color: var(--c-primary-deep);
}
.is-picked .badge { background: rgba(255, 255, 255, 0.28); color: #fff; }
</style>
