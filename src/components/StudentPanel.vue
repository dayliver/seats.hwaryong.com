<script setup>
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Plus } from 'lucide-vue-next'

const props = defineProps({ seating: Object })
const isImportOpen = ref(false)
const rawInput = ref("")

const remaining = computed(() => props.seating.students.filter(s => !s.isAssigned).length)

const handleImport = () => {
  props.seating.importStudents(rawInput.value)
  rawInput.value = ""
  isImportOpen.value = false
}
</script>

<template>
  <aside class="w-[400px] shrink-0 p-6 pr-3">
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
            <Button size="sm" variant="secondary"><Plus class="w-4 h-4" /> 명단</Button>
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
        <div class="px-4 pb-2 flex flex-col gap-1.5">
          <button
            v-for="s in seating.students" :key="s.id"
            @click="seating.selectedStudent = seating.selectedStudent?.id === s.id ? null : s"
            :disabled="(s.isAssigned && !seating.isRestrictionMode) || seating.isAnimating"
            class="w-full h-[54px] px-4 rounded-2xl flex items-center gap-3 text-left transition-all duration-150 disabled:opacity-100"
            :class="seating.selectedStudent?.id === s.id ? 'is-picked' : (s.isAssigned ? 'is-done' : 'is-idle')"
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
.is-idle:hover { background: var(--c-accent-soft); }

.is-done { background: transparent; color: var(--c-muted); }

.is-picked {
  background: var(--grad);
  color: #fff;
  box-shadow: var(--shadow-hot);
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
