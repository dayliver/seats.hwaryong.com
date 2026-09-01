<script setup>
// 원형 룰렛. 눈금은 숫자일 수도, 방향 화살표일 수도 있다.
// value가 정해지면 그 칸이 위쪽 바늘에 오도록 여러 바퀴 돌며 감속하고,
// 멈춘 뒤 가운데 원에 결과를 크게 띄운다.
import { ref, watch, onUnmounted, computed } from 'vue'

const props = defineProps({
  slots: { type: Array, default: () => [] },              // 눈금 라벨 목록
  value: { type: [String, Number], default: null },       // 멈출 눈금
  size: { type: Number, default: 420 }
})

const TURNS = 5
const SPIN_MS = 1900

// 내부 좌표는 고정하고 바깥 크기만 CSS로 줄인다
const BOX = 440
const CX = 220
const CY = 240
const R = 200
const LABEL_R = 148

const ARROW_ROT = { '→': 0, '↓': 90, '←': 180, '↑': 270 }
const isArrow = (v) => v in ARROW_ROT

const count = computed(() => Math.max(props.slots.length, 1))
const sweep = computed(() => 360 / count.value)

// 눈금이 많아지면 글자가 부채꼴 폭을 넘지 않도록 줄인다
const fontSize = computed(() => {
  const arc = (2 * Math.PI * LABEL_R) / count.value
  const digits = Math.max(...props.slots.map(s => String(s).length), 1)
  return Math.round(Math.max(11, Math.min(52, (arc * 0.9) / (0.62 * digits))))
})

// 위(12시)를 0°로 두고 시계방향 i번째 칸
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

        <!-- 눈금이 하나뿐이면 부채꼴 대신 온전한 원 -->
        <circle v-if="count === 1" class="slot slot--0" :cx="CX" :cy="CY" :r="R" />
        <path v-for="w in wedges" v-else :key="w.key" :d="w.d" class="slot" :class="`slot--${w.skin}`" />

        <g v-for="w in wedges" :key="'l' + w.key" :transform="`rotate(${w.rot} ${w.x} ${w.y})`">
          <!-- 방향 눈금: 오른쪽을 향한 도형을 돌려 쓴다 -->
          <g v-if="isArrow(w.label)" :transform="`translate(${w.x} ${w.y}) rotate(${ARROW_ROT[w.label]}) scale(0.62) translate(-50 -50)`">
            <path class="glyph" :class="`num--${w.skin}`" d="M8 42 h48 v-22 l36 30 -36 30 v-22 h-48 z" />
          </g>
          <text
            v-else :x="w.x" :y="w.y"
            text-anchor="middle" dominant-baseline="central"
            class="num" :class="`num--${w.skin}`"
            :font-size="fontSize" font-weight="900"
            style="font-family: var(--f)"
          >{{ w.label }}</text>
        </g>
      </g>

      <!-- 가운데 결과 원 -->
      <circle class="ring" :cx="CX" :cy="CY" r="76" />
      <circle class="hub" :cx="CX" :cy="CY" r="66" />

      <g v-if="settled && isArrow(value)"
         :transform="`translate(${CX} ${CY}) rotate(${ARROW_ROT[value]}) scale(0.86) translate(-50 -50)`">
        <path class="hub-num is-on value-pop" d="M8 42 h48 v-22 l36 30 -36 30 v-22 h-48 z" />
      </g>
      <text
        v-else
        :x="CX" :y="CY + 4"
        text-anchor="middle" dominant-baseline="central"
        :font-size="settled ? 78 : 58" font-weight="900"
        style="font-family: var(--f)"
        class="hub-num" :class="settled ? 'is-on value-pop' : ''"
      >{{ settled ? value : '?' }}</text>

      <!-- 위쪽 바늘 -->
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

.num--0, .glyph.num--0 { fill: var(--c-surface); }
.num--1, .glyph.num--1 { fill: var(--c-ink); }
.num--2, .glyph.num--2 { fill: var(--c-primary); }

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
