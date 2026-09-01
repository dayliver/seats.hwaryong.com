<script setup>
// 상황별 액션 메뉴. 키보드 조작은 useKeyboardNav가 data-zone="menu" 규칙으로 처리한다.
import { nextTick, watch, useTemplateRef } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { actionMenu, closeActionMenu } from '@/composables/useActionMenu'

const panel = useTemplateRef('panel')
onClickOutside(panel, () => closeActionMenu({ restoreFocus: false }))

// 열리면 첫 항목으로 커서를 옮겨 바로 방향키로 고를 수 있게 한다
watch(() => actionMenu.open, async (open) => {
  if (!open) return
  await nextTick()
  panel.value?.querySelector('[data-kb]:not([disabled])')?.focus()
})

const run = (item) => {
  if (item.disabled) return
  // 먼저 대상으로 포커스를 돌려놓는다. 좌석·명단으로 커서를 옮기는 항목은
  // 그 뒤에 실행되면서 다시 가져가므로 순서만 맞으면 된다.
  closeActionMenu({ restoreFocus: true })
  item.run?.()
}
</script>

<template>
  <div
    v-if="actionMenu.open"
    ref="panel"
    data-zone="menu"
    class="ui-card absolute z-[60] p-2.5 origin-top"
    :style="{
      left: `${actionMenu.x}px`,
      top: `${actionMenu.y}px`,
      width: '300px',
      transform: actionMenu.flipUp ? 'translateY(-100%)' : 'none'
    }"
  >
    <p class="px-3 pt-1.5 pb-2 text-[13px] font-bold tracking-[0.14em] uppercase truncate"
       style="color: var(--c-muted)">{{ actionMenu.title }}</p>

    <button
      v-for="item in actionMenu.items" :key="item.key"
      data-kb
      class="act-item"
      :class="item.danger ? 'act-item--danger' : ''"
      :disabled="item.disabled"
      @click="run(item)"
    >
      <span class="flex-1 truncate">{{ item.label }}</span>
      <span v-if="item.note" class="text-[14px] opacity-50 shrink-0">{{ item.note }}</span>
    </button>

    <p v-if="actionMenu.hint" class="px-3 pt-2 pb-1 text-[13px] font-bold leading-snug"
       style="color: var(--c-muted)">{{ actionMenu.hint }}</p>
  </div>
</template>

<style scoped>
.act-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 700;
  text-align: left;
  color: var(--c-ink);
  transition: background-color 140ms ease;
}
.act-item:hover:not(:disabled) { background: var(--c-accent-soft); }
.act-item:disabled { opacity: 0.35; cursor: default; }
.act-item--danger { color: var(--c-primary); }
</style>
