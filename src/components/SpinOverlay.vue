<script setup>
// 배정 연출: 룰렛 셋.
//   ① 몇 칸 갈지 (눈금이 지금 앉을 수 있는 자리 수만큼)
//   ② 줄을 따라 어느 쪽으로 셀지
//   ③ 줄이 끝나면 어느 줄로 넘어갈지
// 결과 배너는 마지막에만 나타난다 (미리 뜨면 긴장감이 사라지므로).
import SpinWheel from '@/components/SpinWheel.vue'

defineProps({ spin: Object })
</script>

<template>
  <div class="absolute inset-0 z-50 flex flex-col items-center justify-center select-none"
       style="background: var(--overlay); backdrop-filter: blur(6px)">

    <div class="mb-7 text-center">
      <p class="text-[15px] font-bold tracking-[0.35em] uppercase mb-2" style="color: var(--c-accent)">Next Seat</p>
      <h2 class="text-[56px] font-black leading-none text-white">{{ spin.studentName }}</h2>
    </div>

    <div class="flex items-start gap-8">
      <div class="flex flex-col items-center gap-3">
        <SpinWheel :slots="spin.slots" :value="spin.n" :size="420" />
        <span class="cap">몇 칸</span>
      </div>
      <div class="flex flex-col items-center gap-3">
        <SpinWheel :slots="['→', '←', '↑', '↓']" :value="spin.d1" :size="420" />
        <span class="cap">줄 따라</span>
      </div>
      <div class="flex flex-col items-center gap-3">
        <SpinWheel :slots="spin.d2Slots" :value="spin.d2" :size="420" />
        <span class="cap">줄 바뀔 때</span>
      </div>
    </div>

    <div class="h-[100px] mt-6 flex items-center">
      <div v-if="spin.phase === 'result'" class="result-pop px-12 py-4 rounded-full flex items-center gap-5"
           style="background: var(--grad); box-shadow: var(--shadow-hot)">
        <span class="text-[52px] font-black leading-none text-white">{{ spin.n }}칸</span>
        <span class="text-[40px] font-black leading-none text-white/70">{{ spin.d1 }}{{ spin.d2 }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cap {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.45);
}

@keyframes result-pop {
  0%   { transform: scale(0.4) translateY(20px); opacity: 0; }
  70%  { transform: scale(1.12) translateY(0); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
.result-pop { animation: result-pop 520ms cubic-bezier(.2,1.2,.4,1) both; }
</style>
