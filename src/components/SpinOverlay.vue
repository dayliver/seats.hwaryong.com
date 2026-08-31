<script setup>
// 룰렛 → 셈 기호 슬롯 → 룰렛 순으로 진행되는 배정 연출.
// 결과 배너는 마지막 단계에서만 나타난다 (미리 뜨면 긴장감이 사라지므로).
import { computed } from 'vue'
import SpinWheel from '@/components/SpinWheel.vue'
import SpinDice from '@/components/SpinDice.vue'

const props = defineProps({ spin: Object })

const resultText = computed(() => {
  const v = props.spin.value
  if (v == null) return ''
  if (v === 0) return '제자리!'
  return v > 0 ? `${v}칸 앞으로!` : `${-v}칸 뒤로!`
})
</script>

<template>
  <div class="absolute inset-0 z-50 flex flex-col items-center justify-center select-none"
       style="background: var(--overlay); backdrop-filter: blur(6px)">

    <div class="mb-12 text-center">
      <p class="text-[15px] font-bold tracking-[0.35em] uppercase mb-3" style="color: var(--c-accent)">Next Seat</p>
      <h2 class="text-[64px] font-black leading-none text-white">{{ spin.studentName }}</h2>
    </div>

    <div class="flex items-center gap-10">
      <SpinWheel :value="spin.a" />
      <SpinDice :op="spin.op" />
      <SpinWheel :value="spin.b" />
    </div>

    <div class="h-[120px] mt-8 flex items-center">
      <div v-if="spin.value != null" class="result-pop px-14 py-5 rounded-full"
           style="background: var(--grad); box-shadow: var(--shadow-hot)">
        <span class="text-[58px] font-black leading-none text-white">{{ resultText }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes result-pop {
  0%   { transform: scale(0.4) translateY(20px); opacity: 0; }
  70%  { transform: scale(1.12) translateY(0); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
.result-pop { animation: result-pop 520ms cubic-bezier(.2,1.2,.4,1) both; }
</style>
