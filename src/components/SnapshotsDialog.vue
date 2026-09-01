<script setup>
// 저장된 배치 불러오기. 저장하기와 짝이 되도록 설정이 아니라 햄버거 메뉴에서 연다.
import { ref, nextTick, useTemplateRef } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Download, Upload, Pencil, Trash2, RotateCcw } from 'lucide-vue-next'

const props = defineProps({ seating: Object })
const open = defineModel('open', { type: Boolean, default: false })

const editingId = ref(null)
const draft = ref('')
const asking = ref(null)     // 되돌리는 방식을 묻는 중
const removing = ref(null)
const fileInput = useTemplateRef('fileInput')

const startRename = async (s) => {
  editingId.value = s.id
  draft.value = s.name
  await nextTick()
}
const commitRename = () => {
  if (editingId.value) props.seating.renameSnapshot(editingId.value, draft.value)
  editingId.value = null
}

const restore = (id, asNew) => {
  props.seating.restoreSnapshot(id, { asNew })
  asking.value = null
  open.value = false
}

const whenText = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${p(d.getHours())}:${p(d.getMinutes())}`
}

const pickFile = () => fileInput.value?.click()
const onFile = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  props.seating.importFile(await file.text())
  e.target.value = ''
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="!rounded-[24px] !border-0 !p-0 !gap-0 sm:max-w-2xl overflow-hidden"
                  style="box-shadow: var(--shadow-md)">
      <DialogHeader class="px-9 pt-9 pb-5">
        <DialogTitle class="text-[25px] font-black leading-tight">배치 불러오기</DialogTitle>
        <DialogDescription class="text-[16px] leading-relaxed pt-1" style="color: var(--c-ink-soft)">
          저장해 둔 자리 배치를 그대로 되돌립니다. 파일로 내보내 두면 다른 컴퓨터에서도 쓸 수 있습니다.
        </DialogDescription>
      </DialogHeader>

      <div class="px-9 pb-9 max-h-[62vh] overflow-y-auto flex flex-col gap-4">
        <div class="flex gap-2">
          <Button size="sm" variant="secondary" @click="seating.exportFile()">
            <Download class="w-4 h-4" /> 파일로 내보내기
          </Button>
          <Button size="sm" variant="ghost" @click="pickFile">
            <Upload class="w-4 h-4" /> 파일에서 가져오기
          </Button>
          <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="onFile" />
        </div>

        <p v-if="seating.saveError" class="text-[15px] font-bold" style="color: var(--c-primary)">
          {{ seating.saveError }}
        </p>

        <p v-if="!seating.snapshots.length" class="empty">
          아직 저장된 배치가 없습니다. 메뉴에서 <b>배치 저장하기</b>를 누르면 지금 자리 배치가 이름 붙어 남습니다.
        </p>

        <div v-else class="flex flex-col gap-2">
          <div v-for="s in seating.snapshots" :key="s.id" class="row">
            <div class="flex-1 min-w-0">
              <input
                v-if="editingId === s.id" v-model="draft" class="rename"
                @keyup.enter="commitRename" @keyup.esc="editingId = null" @blur="commitRename"
              />
              <template v-else>
                <span class="block text-[18px] font-bold truncate">{{ s.name }}</span>
                <span class="block text-[13px] font-bold mt-0.5" style="color: var(--c-muted)">
                  {{ s.rosterName }} · 학생 {{ (s.students || []).length }}명 · {{ whenText(s.savedAt) }}
                </span>
              </template>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <button class="act" title="되돌리기" @click="asking = asking === s.id ? null : s.id">
                <RotateCcw class="w-4 h-4" />
              </button>
              <button class="act" title="이름 바꾸기" @click="startRename(s)"><Pencil class="w-4 h-4" /></button>
              <button class="act act--danger" title="삭제" @click="removing = removing === s.id ? null : s.id">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div v-if="asking" class="ask">
          <span class="ask-text">어떻게 되돌릴까요?</span>
          <div class="flex gap-2 shrink-0">
            <Button size="sm" variant="ghost" @click="asking = null">취소</Button>
            <Button size="sm" variant="outline" @click="restore(asking, false)">지금 명단에 덮어쓰기</Button>
            <Button size="sm" @click="restore(asking, true)">새 명단으로</Button>
          </div>
        </div>

        <div v-if="removing" class="ask">
          <span class="ask-text">저장된 배치를 지웁니다. 되돌릴 수 없습니다.</span>
          <div class="flex gap-2 shrink-0">
            <Button size="sm" variant="ghost" @click="removing = null">취소</Button>
            <Button size="sm" variant="destructive" @click="seating.deleteSnapshot(removing); removing = null">삭제</Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.empty {
  margin: 0;
  padding: 18px;
  border-radius: 16px;
  background: var(--c-bg);
  font-size: 15px;
  line-height: 1.6;
  color: var(--c-ink-soft);
}
.empty b { color: var(--c-ink); }

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--c-bg);
}

.rename {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 17px;
  font-weight: 700;
  background: var(--c-surface);
  color: var(--c-ink);
  outline: none;
  box-shadow: inset 0 0 0 2px var(--c-primary);
}

.act {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: var(--c-ink-soft);
  transition: background-color 150ms ease, color 150ms ease;
}
.act:hover { background: var(--c-surface); color: var(--c-ink); }
.act--danger:hover { color: var(--c-primary); }

.ask {
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--c-accent-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.ask-text { font-size: 15px; font-weight: 700; color: var(--c-primary-deep); }
</style>
