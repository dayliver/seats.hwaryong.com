<script setup>
// 1~9 칸으로 나뉜 원형 룰렛.
// value가 정해지면 그 칸이 위쪽 바늘에 오도록 5바퀴 돌며 감속하고,
// 멈춘 뒤 가운데 원에 최종 값을 크게 띄운다.
import { ref, watch, onUnmounted, computed } from 'vue'

const props = defineProps({ value: { type: Number, default: null } })

const SLOTS = 9
const SWEEP = 360 / SLOTS      // 한 칸 각도 = 40°
const TURNS = 5                // 멈추기 전 바퀴 수
const SPIN_MS = 1900

const R = 160                  // 바깥 반지름
const CX = 180
const CY = 180

// 칸 색: 크림슨 / 피치 / 화이트를 번갈아 (9는 3의 배수라 이음매가 자연스럽다)
const SLOT_SKIN = [
  { fill: '#f40752', text: '#ffffff' },
  { fill: '#f9ab8f', text: '#452722' },
  { fill: '#ffffff', text: '#f40752' }
]

// 위(12시)를 0°로 두고 시계방향으로 i번째 칸의 부채꼴 path
function sector(i) {
  const a0 = (i * SWEEP - 90) * Math.PI / 180
  const a1 = ((i + 1) * SWEEP - 90) * Math.PI / 180
  const x0 = CX + R * Math.cos(a0), y0 = CY + R * Math.sin(a0)
  const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1)
  return `M ${CX} ${CY} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`
}

// 숫자를 놓을 위치 (칸 한가운데, 바깥쪽 가까이)
function labelPos(i) {
  const a = ((i + 0.5) * SWEEP - 90) * Math.PI / 180
  return { x: CX + 108 * Math.cos(a), y: CY + 108 * Math.sin(a) }
}

const slots = Array.from({ length: SLOTS }, (_, i) => ({
  n: i + 1,
  d: sector(i),
  ...SLOT_SKIN[i % SLOT_SKIN.length],
  ...labelPos(i),
  rot: (i + 0.5) * SWEEP
}))

const rotation = ref(0)
const settled = ref(false)
let revealTimer = null

watch(() => props.value, (v) => {
  clearTimeout(revealTimer)
  settled.value = false
  if (v == null) { rotation.value = 0; return }
  // v가 적힌 칸의 중앙을 12시로 가져온다
  rotation.value = TURNS * 360 - ((v - 1) * SWEEP + SWEEP / 2)
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
  <div class="relative w-[360px] h-[380px]">
    <svg viewBox="0 0 360 380" class="w-full h-full overflow-visible">
      <!-- 회전하는 바퀴 -->
      <g :style="wheelStyle">
        <circle :cx="CX" :cy="CY" :r="R + 7" fill="#5a332c" />
        <path v-for="s in slots" :key="s.n" :d="s.d" :fill="s.fill" stroke="#5a332c" stroke-width="2.5" />
        <text
          v-for="s in slots" :key="'t' + s.n"
          :x="s.x" :y="s.y"
          text-anchor="middle" dominant-baseline="central"
          :fill="s.text" font-size="42" font-weight="900"
          :transform="`rotate(${s.rot} ${s.x} ${s.y})`"
          style="font-family: var(--f)"
        >{{ s.n }}</text>
      </g>

      <!-- 가운데 결과 원 -->
      <circle :cx="CX" :cy="CY" r="68" fill="#5a332c" />
      <circle :cx="CX" :cy="CY" r="59" fill="#ffffff" />
      <text
        :x="CX" :y="CY + 4"
        text-anchor="middle" dominant-baseline="central"
        :fill="settled ? '#f40752' : '#d9c6c0'"
        :font-size="settled ? 74 : 54" font-weight="900"
        style="font-family: var(--f)"
        :class="settled ? 'value-pop' : ''"
      >{{ settled ? value : '?' }}</text>

      <!-- 위쪽 바늘 -->
      <polygon points="180,36 157,-4 203,-4" fill="#5a332c" />
    </svg>
  </div>
</template>

<style scoped>
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
