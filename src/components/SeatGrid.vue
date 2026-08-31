<script setup>
import { computed, ref, useTemplateRef } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { XCircle, Eraser, ArrowLeftRight, Trash2, Printer, Menu, LayoutGrid, ShieldOff, UserX } from 'lucide-vue-next'
import { openPrintView } from '@/lib/print'

const props = defineProps({ seating: Object })

// --- 햄버거 메뉴 ---
// reka-ui DropdownMenu는 body로 포탈되어 부모의 scale()을 못 받으므로
// 캔버스 안에 직접 띄우는 가벼운 패널로 구현한다.
const isMenuOpen = ref(false)
const menuRef = useTemplateRef('menuRef')
onClickOutside(menuRef, () => { isMenuOpen.value = false })

// --- 되돌릴 수 없는 동작 확인 ---
const confirmKind = ref(null)

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

const gridStyle = computed(() => ({
  gridTemplateColumns: `40px repeat(${props.seating.gridConfig.cols}, 1fr)`,
  gridTemplateRows: `40px repeat(${props.seating.gridConfig.rows}, 1fr)`
}))

const getSeatAt = (r, c) => props.seating.seats.find(s => s.row === r && s.col === c)

const onSeatClick = (seat) => {
  if (!seat || props.seating.isAnimating) return
  const { seating } = props

  // 교체 모드일 때
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
</script>

<template>
  <main class="flex-1 bg-slate-50 p-8 flex flex-col overflow-hidden">
    <div class="flex justify-between items-center mb-6">
      <div class="flex items-center gap-4">
        <h2 class="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Main Classroom</h2>
        <div v-if="seating.isSwapMode" class="px-2 py-0.5 bg-purple-100 text-purple-600 text-[10px] font-bold rounded animate-pulse border border-purple-200 overflow-hidden">
          교체할 대상을 선택하세요
        </div>
      </div>

      <div class="flex gap-2 items-center">
        <Button 
          v-if="seating.selectedStudent && !seating.isEditMode && !seating.isRestrictionMode" 
          @click="seating.assignRandom(seating.selectedStudent)" 
          size="sm" class="bg-slate-900 font-bold shadow-none"
        >
          랜덤 배정
        </Button>

        <Button 
          v-if="seating.selectedStudent && !seating.isEditMode" 
          variant="outline" size="sm" 
          @click="seating.isRestrictionMode = !seating.isRestrictionMode" 
          :class="seating.isRestrictionMode ? 'bg-red-50 text-red-600 border-red-200' : ''"
          class="shadow-none border-2"
        >
          {{ seating.isRestrictionMode ? '설정 완료' : '개별 금지 지정' }}
        </Button>

        <Button 
          v-if="seating.isEditMode" 
          variant="outline" size="sm" 
          @click="seating.isEditMode = false" 
          class="shadow-none border-2 bg-orange-50 text-orange-600 border-orange-200"
        >
          구조 설정 완료
        </Button>

        <div ref="menuRef" class="relative">
          <Button 
            variant="outline" size="sm" 
            @click="isMenuOpen = !isMenuOpen"
            :class="isMenuOpen ? 'bg-slate-100' : ''"
            class="shadow-none border-2 px-2.5"
            title="메뉴"
          >
            <Menu class="w-4 h-4" />
          </Button>

          <div 
            v-if="isMenuOpen" 
            class="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-1.5 text-sm"
          >
            <button 
              @click="runMenu(() => openPrintView(seating))" 
              class="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-slate-100 text-slate-700 text-left"
            >
              <Printer class="w-4 h-4 shrink-0 text-slate-400" /> 인쇄
            </button>

            <button 
              @click="runMenu(() => seating.isEditMode = !seating.isEditMode)" 
              :disabled="seating.isRestrictionMode"
              class="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-slate-100 text-slate-700 text-left disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <LayoutGrid class="w-4 h-4 shrink-0 text-slate-400" /> 교실 구조 설정
            </button>

            <div class="h-px bg-slate-100 my-1.5" />

            <button 
              v-if="seating.selectedStudent?.deniedSeatIds?.length" 
              @click="runMenu(() => seating.clearStudentRestrictions(seating.selectedStudent))" 
              class="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-slate-100 text-slate-700 text-left"
            >
              <UserX class="w-4 h-4 shrink-0 text-slate-400" />
              <span class="flex-1">{{ seating.selectedStudent.name }} 금지 해제</span>
              <span class="text-[10px] font-bold text-slate-400">{{ seating.selectedStudent.deniedSeatIds.length }}</span>
            </button>

            <button 
              @click="askConfirm('restrictions')" 
              :disabled="seating.restrictionCount === 0"
              class="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-red-50 text-red-600 text-left disabled:opacity-40 disabled:hover:bg-transparent disabled:text-slate-400"
            >
              <ShieldOff class="w-4 h-4 shrink-0" />
              <span class="flex-1">금지 좌석 전체 해제</span>
              <span v-if="seating.restrictionCount" class="text-[10px] font-bold">{{ seating.restrictionCount }}</span>
            </button>

            <button 
              @click="askConfirm('assignments')" 
              class="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-red-50 text-red-600 text-left"
            >
              <Trash2 class="w-4 h-4 shrink-0" /> 전체 배정 취소
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 flex items-center justify-center">
      <div class="grid gap-2 w-full h-full max-w-6xl p-4 bg-white border border-slate-200 rounded-xl shadow-none" :style="gridStyle">
        
        <div class="flex items-center justify-center text-[10px] font-bold text-slate-300 select-none">#</div>

        <button 
          v-for="c in seating.gridConfig.cols" :key="'col-h-'+c"
          @click="seating.toggleBatchRestriction('col', c-1)"
          :disabled="!seating.isRestrictionMode"
          :class="['flex items-center justify-center text-xs font-bold transition-colors select-none', seating.isRestrictionMode ? 'text-blue-500 hover:bg-blue-50 rounded cursor-pointer' : 'text-slate-400']"
        >
          {{ String.fromCharCode(64 + c) }}
        </button>

        <template v-for="r in seating.gridConfig.rows" :key="'row-g-'+r">
          <button @click="seating.toggleBatchRestriction('row', r-1)" :disabled="!seating.isRestrictionMode" class="flex items-center justify-center text-xs font-bold text-slate-400 select-none" :class="seating.isRestrictionMode ? 'text-blue-500 hover:bg-blue-50 rounded cursor-pointer' : ''">
            {{ r }}
          </button>

          <div 
            v-for="c in seating.gridConfig.cols" :key="`cell-${r-1}-${c-1}`"
            @click="onSeatClick(getSeatAt(r-1, c-1))"
            :class="[
              'border transition-all flex items-center justify-center rounded-sm relative overflow-hidden select-none cursor-pointer group',
              getSeatAt(r-1, c-1)?.status === 'available' ? 'bg-white border-slate-100 hover:border-slate-300' : '',
              getSeatAt(r-1, c-1)?.status === 'forbidden' ? 'bg-slate-100 border-dashed border-slate-300 opacity-40' : '',
              getSeatAt(r-1, c-1)?.status === 'occupied' ? 'bg-slate-900 text-white border-slate-900 ring-1 ring-slate-900 ring-offset-1' : '',
              seating.highlightedSeatId === `seat-${r-1}-${c-1}` ? 'bg-yellow-400 border-yellow-500 scale-105 z-10 shadow-lg text-slate-900' : '',
              seating.swapSourceId === `seat-${r-1}-${c-1}` ? 'ring-4 ring-purple-500 z-20' : '',
              seating.selectedStudent?.deniedSeatIds?.includes(`seat-${r-1}-${c-1}`) ? 'bg-red-50 border-red-100' : ''
            ]"
          >
            <template v-if="getSeatAt(r-1, c-1)?.status === 'occupied'">
              <span class="font-bold text-3xl leading-tight text-center px-1 tracking-tight">
                {{ seating.getStudentName(getSeatAt(r-1, c-1).studentId) }}
              </span>
              
              <template v-if="!seating.isAnimating && !seating.isSwapMode">
                <button 
                  @click.stop="seating.startSwap(getSeatAt(r-1, c-1).id)" 
                  class="absolute top-1.5 left-1.5 p-1 bg-white text-slate-900 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-purple-500 hover:text-white transition-colors z-40 border shadow-sm" 
                  title="자리 교체"
                >
                  <ArrowLeftRight class="w-3.5 h-3.5" />
                </button>
                
                <button 
                  @click.stop="seating.cancelAssignment(getSeatAt(r-1, c-1).id)" 
                  class="absolute top-1.5 right-1.5 p-1 bg-white text-slate-900 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white transition-colors z-40 border shadow-sm" 
                  title="배정 취소"
                >
                  <XCircle class="w-3.5 h-3.5" />
                </button>
              </template>
            </template>

            <template v-else-if="seating.highlightedSeatId === `seat-${r-1}-${c-1}`">
              <span class="text-3xl font-black italic">{{ seating.countdownValue }}</span>
            </template>

            <template v-else>
              <div v-if="getSeatAt(r-1, c-1)?.status === 'forbidden'" class="flex flex-col items-center opacity-40">
                <Eraser class="w-3 h-3" />
              </div>
              <XCircle v-else-if="seating.selectedStudent?.deniedSeatIds?.includes(`seat-${r-1}-${c-1}`)" class="text-red-400/50 w-5 h-5" />
              <span v-else class="text-[9px] text-slate-200 font-mono opacity-50">{{ String.fromCharCode(64 + c) }}{{ r }}</span>
            </template>
          </div>
        </template>
      </div>
    </div>

    <Dialog :open="confirmKind !== null" @update:open="v => { if (!v) confirmKind = null }">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ confirmData?.title }}</DialogTitle>
          <DialogDescription>{{ confirmData?.description }}</DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2">
          <Button variant="outline" @click="confirmKind = null">취소</Button>
          <Button class="bg-red-600 hover:bg-red-700" @click="acceptConfirm">실행</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </main>
</template>