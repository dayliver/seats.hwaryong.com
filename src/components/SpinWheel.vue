<script setup>
import { ref, watch, onUnmounted, computed } from 'vue'
import SnakeIcon from '@/components/SnakeIcon.vue'
import { isSnake } from '@/lib/snake'

const props = defineProps({
  slots: { type: Array, default: () => [] },
  value: { type: [String, Number], default: null },
  size: { type: Number, default: 420 },
  // 방향 아이콘을 실제 격자의 줄 수에 맞춰 그리기 위한 크기
  grid: { type: Object, default: () => ({ rows: 3, cols: 3 }) }
})

const TURNS = 5
const SPIN_MS = 1900
const BOX = 440
const CX = 220
const CY = 240
const R = 200
const LABEL_R = 148

const count = computed(() => Math.max(props.slots.length, 1))
const sweep = computed(() => 360 / count.value)

const fontSize = computed(() => {
  const arc = (2 * Math.PI * LABEL_R) / count.value
  const digits = Math.max(...props.slots.map(s => String(s).length), 1)
  return Math.round(Math.max(11, Math.min(52, (arc * 0.9) / (0.62 * digits))))
})

function sector(i) {
  const a0 = (i * sweep.value - 90) * Math.PI / 180
  const a1 = ((i + 1) * sweep.value - 90) * Math.PI / 180
  const x0 = CX + R * Math.cos(a0), y0 = CY + R * Math.sin(a0)
  const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1)
  const large = sweep.value > 180 ? 1 : 0
  return `M ${CX} ${CY} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`
}

function labelPos(i) {
  const a = ((i + 0.5) * sweep.value - 90) * Math.PI / 180
  return { x: CX + LABEL_R * Math.cos(a), y: CY + LABEL_R * Math.sin(a) }
}

const wedges = computed(() => props.slots.map((label, i) => ({
  key: `${i}-${label}`,
  label,
  d: sector(i),
  skin: i % 3,
  ...labelPos(i),
  rot: (i + 0.5) * sweep.value
})))

const rotation = ref(0)
const settled = ref(false)
let revealTimer = null

watch(() => props.value, (v) => {
  clearTimeout(revealTimer)
  settled.value = false
  if (v == null) { rotation.value = 0; return }
  const i = props.slots.findIndex(s => s === v)
  if (i === -1) return
  rotation.value = TURNS * 360 - (i * sweep.value + sweep.value / 2)
  revealTimer = setTimeout(() => { settled.value = true }, SPIN_MS)
})

onUnmounted(() => clearTimeout(revealTimer))

const wheelStyle = computed(() => ({
  transform: `rotate(${rotation.value}deg)`,
  transformOrigin: `${CX}px ${CY}px`,
  transition: `transform ${SPIN_MS}ms cubic-bezier(.13,.72,.16,1)`
}))
</script>

<template>
  <div :style="{ width: `${size}px` }">
    <svg :viewBox="`0 0 ${BOX} ${BOX + 26}`" class="w-full h-auto overflow-visible">
      <g :style="wheelStyle">
        <circle class="ring" :cx="CX" :cy="CY" :r="R + 7" />

        <circle v-if="count === 1" class="slot slot--0" :cx="CX" :cy="CY" :r="R" />
        <path v-for="w in wedges" v-else :key="w.key" :d="w.d" class="slot" :class="`slot--${w.skin}`" />

        <g v-for="w in wedges" :key="'l' + w.key" :transform="`rotate(${w.rot} ${w.x} ${w.y})`">
          <SnakeIcon
            v-if="isSnake(w.label)"
            :id="w.label" :rows="grid.rows" :cols="grid.cols"
            :x="w.x - 22" :y="w.y - 22" width="44" height="44"
            :class="`ico--${w.skin}`"
          />
          <text
            v-else :x="w.x" :y="w.y"
            text-anchor="middle" dominant-baseline="central"
            class="num" :class="`num--${w.skin}`"
            :font-size="fontSize" font-weight="900"
            style="font-family: var(--f)"
          >{{ w.label }}</text>
        </g>
      </g>

      <circle class="ring" :cx="CX" :cy="CY" r="76" />
      <circle class="hub" :cx="CX" :cy="CY" r="66" />

      <g v-if="settled && isSnake(value)" class="value-pop">
        <SnakeIcon
          :id="value" :rows="grid.rows" :cols="grid.cols"
          :x="CX - 40" :y="CY - 40" width="80" height="80"
          class="hub-ico"
        />
      </g>
      <text
        v-else
        :x="CX" :y="CY + 4"
        text-anchor="middle" dominant-baseline="central"
        :font-size="settled ? 78 : 58" font-weight="900"
        style="font-family: var(--f)"
        class="hub-num" :class="settled ? 'is-on value-pop' : ''"
      >{{ settled ? value : '?' }}</text>

      <polygon class="ring" points="220,44 195,0 245,0" />
    </svg>
  </div>
</template>

<style scoped>
.ring { fill: var(--c-strong); }
.hub  { fill: var(--c-surface); }

.slot { stroke: var(--c-strong); stroke-width: 2.5; }
.slot--0 { fill: var(--c-primary); }
.slot--1 { fill: var(--c-accent); }
.slot--2 { fill: var(--c-surface); }

.num--0 { fill: var(--c-surface); }
.num--1 { fill: var(--c-ink); }
.num--2 { fill: var(--c-primary); }

/* 방향 아이콘은 currentColor로 그려지므로 칸 색에 맞춰 글자색을 준다 */
.ico--0 { color: var(--c-surface); }
.ico--1 { color: var(--c-ink); }
.ico--2 { color: var(--c-primary); }
.hub-ico { color: var(--c-primary); }

.hub-num { fill: var(--c-muted); }
.hub-num.is-on { fill: var(--c-primary); }

@keyframes value-pop {
  0%   { opacity: 0; transform: scale(0.3); }
  65%  { opacity: 1; transform: scale(1.25); }
  100% { opacity: 1; transform: scale(1); }
}
.value-pop {
  animation: value-pop 420ms cubic-bezier(.2,1.2,.4,1) both;
  transform-box: fill-box;
  transform-origin: center;
}
</style>
