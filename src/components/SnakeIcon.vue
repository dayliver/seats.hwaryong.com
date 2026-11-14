<script setup>
// 스네이크 방향 아이콘. 격자의 줄 수에 맞춰 그리므로 실제 이동 경로와 모양이 같다.
// 색은 currentColor — 놓이는 자리의 글자색을 따른다.
// 루트가 <svg>라 HTML 안에서도, 다른 SVG 안에서도(x·y·width·height) 쓸 수 있다.
import { computed } from 'vue'
import { snakeIcon } from '@/lib/snake'

const props = defineProps({
  id: { type: String, required: true },
  rows: { type: Number, default: 3 },
  cols: { type: Number, default: 3 }
})

const g = computed(() => snakeIcon(props.id, props.rows, props.cols))
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="`0 0 ${g.size} ${g.size}`"
    fill="none" stroke="currentColor"
    :stroke-width="g.strokeWidth" stroke-linecap="round" stroke-linejoin="round"
  >
    <polygon :points="g.head" fill="currentColor" :stroke-width="g.strokeWidth * 0.75" />
    <path :d="g.path" />
  </svg>
</template>
