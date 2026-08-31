<script setup>
// 셈 기호 슬롯머신.
// 빠르게 돌다가 감속한 뒤, 목표 기호를 아슬아슬하게 지나치거나 못 미친 채 멈칫거리다
// 마지막에 제자리로 넘어간다.
import { ref, watch, onUnmounted, computed } from 'vue'

const props = defineProps({ op: { type: String, default: null } })

const OPS = ['+', '-', '×']
const BOX = 190
const PAD = 14
const CELL = BOX - PAD * 2      // 창 하나에 기호 하나
const LOOPS = 8                 // 멈추기 전 바퀴 수

// 0번 칸은 '?' — 굴리기 전에는 무엇이 나올지 보이지 않는다
const strip = ['?', ...Array.from({ length: (LOOPS + 2) * OPS.length }, (_, i) => OPS[i % OPS.length])]

const offset = ref(0)           // 몇 칸만큼 올라갔는지 (소수 가능)
const trans = ref('none')
const settled = ref(false)
const timers = []

const clearTimers = () => { while (timers.length) clearTimeout(timers.pop()) }
const at = (ms, fn) => timers.push(setTimeout(fn, ms))

watch(() => props.op, (op) => {
  clearTimers()
  settled.value = false
  if (!op) { trans.value = 'none'; offset.value = 0; return }

  const target = 1 + LOOPS * OPS.length + OPS.indexOf(op)
  const teaseDir = Math.random() < 0.5 ? -1 : 1     // 못 미치거나 / 지나치거나
  const tease = target + teaseDir * 0.44

  // 1) 전력 회전
  trans.value = `transform 1150ms linear`
  offset.value = target - 5

  // 2) 감속하며 목표를 살짝 빗나간 자리에 멈춘다
  at(1150, () => {
    trans.value = 'transform 850ms cubic-bezier(.12,.75,.2,1)'
    offset.value = tease
  })

  // 3) 넘어갈 듯 말 듯 떨린다
  at(2050, () => { trans.value = 'transform 190ms ease-in-out'; offset.value = tease + teaseDir * 0.05 })
  at(2250, () => { offset.value = tease - teaseDir * 0.03 })
  at(2450, () => { offset.value = tease + teaseDir * 0.04 })

  // 4) 마지막에 제자리로 툭 넘어간다
  at(2680, () => {
    trans.value = 'transform 520ms cubic-bezier(.3,1.5,.5,1)'
    offset.value = target
  })

  at(3180, () => { settled.value = true })
}, { immediate: true })

onUnmounted(clearTimers)

const stripStyle = computed(() => ({
  transform: `translateY(-${offset.value * CELL}px)`,
  transition: trans.value
}))
</script>

<template>
  <div
    class="dice overflow-hidden"
    :class="[settled ? 'dice--on' : 'dice--off', settled ? 'dice-land' : '']"
    :style="{ width: `${BOX}px`, height: `${BOX}px`, padding: `${PAD}px` }"
  >
    <div class="w-full h-full overflow-hidden">
      <div :style="stripStyle">
        <div
          v-for="(o, i) in strip" :key="i"
          class="flex items-center justify-center"
          :style="{ height: `${CELL}px` }"
        >
          <!-- 기호는 폰트 대신 막대로 그린다: 세 기호의 굵기가 정확히 같아진다 -->
          <span v-if="o === '?'" class="text-[86px] font-black leading-none opacity-25">?</span>
          <span v-else class="relative block" style="width: 104px; height: 104px">
            <i v-if="o !== '×'" class="bar" style="transform: translate(-50%, -50%)" />
            <i v-if="o === '+'" class="bar" style="transform: translate(-50%, -50%) rotate(90deg)" />
            <template v-if="o === '×'">
              <i class="bar" style="transform: translate(-50%, -50%) rotate(45deg)" />
              <i class="bar" style="transform: translate(-50%, -50%) rotate(-45deg)" />
            </template>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dice {
  border-radius: 26px;
  transition: background 260ms ease, color 260ms ease, box-shadow 260ms ease;
}
.dice--off { background: #fff; color: var(--c-primary); box-shadow: var(--shadow-md); }
.dice--on  { background: var(--grad); color: #fff; box-shadow: var(--shadow-hot); }

.bar {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100px;
  height: 22px;
  background: currentColor;
}

@keyframes dice-land {
  0%   { transform: scale(1.16); }
  55%  { transform: scale(0.95); }
  100% { transform: scale(1); }
}
.dice-land { animation: dice-land 400ms cubic-bezier(.2,1.3,.4,1) both; }
</style>
