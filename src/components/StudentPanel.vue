<script setup>
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog'

const props = defineProps({ seating: Object })
const isImportOpen = ref(false)
const rawInput = ref("")

const handleImport = () => {
  props.seating.importStudents(rawInput.value)
  rawInput.value = ""
  isImportOpen.value = false
}
</script>

<template>
  <aside class="w-[320px] border-r bg-white flex flex-col h-full overflow-hidden shrink-0">
    <div class="p-6 border-b flex flex-col gap-4">
      <div class="flex justify-between items-center">
        <h1 class="text-sm font-bold uppercase tracking-widest text-slate-400">Students</h1>
        <Dialog v-model:open="isImportOpen">
          <DialogTrigger asChild><Button variant="ghost" size="sm" class="h-7 text-xs">+ ADD</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>명단 붙여넣기</DialogTitle>
              <DialogDescription>엑셀에서 복사한 이름을 붙여넣으세요.</DialogDescription>
            </DialogHeader>
            <Textarea v-model="rawInput" class="h-64 mt-2 font-mono" placeholder="강시훈&#10;강승구..." />
            <DialogFooter><Button @click="handleImport">생성</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>

    <ScrollArea class="flex-1 overflow-hidden">
      <div class="p-3 space-y-1">
        <button 
          v-for="s in seating.students" :key="s.id"
          @click="seating.selectedStudent = seating.selectedStudent?.id === s.id ? null : s"
          :disabled="s.isAssigned && !seating.isRestrictionMode"
          :class="[
            'w-full text-left px-4 py-2.5 rounded-sm text-sm transition-all flex justify-between items-center group',
            s.isAssigned ? 'text-slate-300 bg-slate-50/50' : 'hover:bg-slate-100',
            seating.selectedStudent?.id === s.id ? 'bg-slate-900 text-white hover:bg-slate-800 ring-2 ring-slate-900 ring-offset-1' : ''
          ]"
        >
          <span class="font-medium">{{ s.name }}</span>
          
          <span v-if="s.isAssigned" class="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded group-hover:bg-slate-800 group-hover:text-white transition-colors">
            {{ seating.getStudentSeatCode(s.id) }}
          </span>
        </button>
      </div>
    </ScrollArea>

    <div v-if="seating.selectedStudent" class="p-5 bg-slate-900 text-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
      <p class="text-[10px] uppercase opacity-50 font-bold mb-1 tracking-tighter">Current Selection</p>
      <div class="flex justify-between items-center">
        <p class="text-lg font-bold">{{ seating.selectedStudent.name }}</p>
        <div v-if="seating.selectedStudent.deniedSeatIds.length > 0" class="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">
          제한됨: {{ seating.selectedStudent.deniedSeatIds.length }}
        </div>
      </div>
    </div>
  </aside>
</template>