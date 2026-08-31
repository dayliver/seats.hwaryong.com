<script setup>
import { ref, nextTick, useTemplateRef } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { THEMES } from '@/lib/themes'
import { Check, Plus, Copy, Pencil, Trash2 } from 'lucide-vue-next'

const props = defineProps({ seating: Object })
const open = defineModel('open', { type: Boolean, default: false })

const editingId = ref(null)
const draftName = ref('')
const nameInput = useTemplateRef('nameInput')

const startRename = async (r) => {
  editingId.value = r.id
  draftName.value = r.name
  await nextTick()
  nameInput.value?.[0]?.select?.()
}

const commitRename = () => {
  if (editingId.value) props.seating.renameRoster(editingId.value, draftName.value)
  editingId.value = null
}

const confirmRemove = ref(null)
const doRemove = (id) => {
  props.seating.removeRoster(id)
  confirmRemove.value = null
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="!rounded-[24px] !border-0 !p-0 !gap-0 sm:max-w-xl overflow-hidden"
                  style="box-shadow: var(--shadow-md)">
      <DialogHeader class="px-8 pt-8 pb-5">
        <DialogTitle class="text-[26px] font-black leading-tight">설정</DialogTitle>
        <DialogDescription class="text-[16px] leading-relaxed pt-1" style="color: var(--c-ink-soft)">
          테마와 학생 명단을 관리합니다. 명단마다 학생·좌석·교실 구조가 따로 저장됩니다.
        </DialogDescription>
      </DialogHeader>

      <div class="px-8 pb-8 max-h-[62vh] overflow-y-auto flex flex-col gap-8">

        <!-- 테마 -->
        <section>
          <h3 class="sect">테마</h3>
          <div class="grid grid-cols-5 gap-2.5">
            <button
              v-for="t in THEMES" :key="t.id"
              @click="seating.setTheme(t.id)"
              class="swatch"
              :class="seating.themeId === t.id ? 'swatch--on' : ''"
            >
              <span class="chip" :style="{ background: `linear-gradient(135deg, ${t.primary} 0%, ${t.accent} 100%)` }">
                <Check v-if="seating.themeId === t.id" class="w-5 h-5 text-white" stroke-width="3.5" />
              </span>
              <span class="text-[14px] font-bold">{{ t.label }}</span>
            </button>
          </div>
        </section>

        <!-- 명단 -->
        <section>
          <div class="flex items-center justify-between mb-3">
            <h3 class="sect !mb-0">학생 명단</h3>
            <Button size="sm" variant="secondary" @click="seating.addRoster()">
              <Plus class="w-4 h-4" /> 새 명단
            </Button>
          </div>

          <div class="flex flex-col gap-2">
            <div
              v-for="r in seating.rosters" :key="r.id"
              class="row" :class="seating.activeRosterId === r.id ? 'row--on' : ''"
            >
              <button class="flex-1 min-w-0 flex items-center gap-3 text-left"
                      :disabled="editingId === r.id" @click="seating.switchRoster(r.id)">
                <span class="dot" :class="seating.activeRosterId === r.id ? 'dot--on' : ''" />
                <span v-if="editingId !== r.id" class="min-w-0">
                  <span class="block text-[18px] font-bold truncate">{{ r.name }}</span>
                  <span class="block text-[13px] font-bold mt-0.5" style="color: var(--c-muted)">
                    학생 {{ (r.id === seating.activeRosterId ? seating.students : (r.students || [])).length }}명
                  </span>
                </span>
                <input
                  v-else ref="nameInput" v-model="draftName"
                  class="rename" @keyup.enter="commitRename" @keyup.esc="editingId = null" @blur="commitRename"
                />
              </button>

              <div class="flex items-center gap-1 shrink-0">
                <button class="act" title="이름 바꾸기" @click="startRename(r)"><Pencil class="w-4 h-4" /></button>
                <button class="act" title="구조만 복제" @click="seating.duplicateRoster(r.id, { withStudents: false })">
                  <Copy class="w-4 h-4" />
                </button>
                <button
                  class="act act--danger" title="삭제"
                  :disabled="seating.rosters.length <= 1"
                  @click="confirmRemove = confirmRemove === r.id ? null : r.id"
                ><Trash2 class="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          <div v-if="confirmRemove" class="mt-3 p-4 rounded-2xl flex items-center justify-between gap-3"
               style="background: var(--c-accent-soft)">
            <span class="text-[15px] font-bold" style="color: var(--c-primary-deep)">
              이 명단의 학생과 자리 배치가 모두 사라집니다.
            </span>
            <div class="flex gap-2 shrink-0">
              <Button size="sm" variant="ghost" @click="confirmRemove = null">취소</Button>
              <Button size="sm" variant="destructive" @click="doRemove(confirmRemove)">삭제</Button>
            </div>
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.sect {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--c-muted);
  margin-bottom: 12px;
}

.swatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 4px;
  border-radius: 16px;
  color: var(--c-ink-soft);
  transition: background-color 150ms ease, color 150ms ease;
}
.swatch:hover { background: var(--c-accent-soft); }
.swatch--on { background: var(--c-accent-soft); color: var(--c-primary-deep); }

.chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 999px;
  box-shadow: var(--shadow-sm);
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--c-bg);
  transition: background-color 150ms ease, box-shadow 150ms ease;
}
.row--on { background: var(--c-accent-soft); box-shadow: inset 0 0 0 2px var(--c-accent); }

.dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 2px var(--c-muted);
}
.dot--on { background: var(--c-primary); box-shadow: none; }

.rename {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border-radius: 10px;
  font-size: 17px;
  font-weight: 700;
  background: #fff;
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
.act:hover:not(:disabled) { background: #fff; color: var(--c-ink); }
.act--danger:hover:not(:disabled) { color: var(--c-primary); }
.act:disabled { opacity: 0.3; }
</style>
