<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useSeating } from '@/composables/useSeating'
import StudentPanel from '@/components/StudentPanel.vue'
import SeatGrid from '@/components/SeatGrid.vue'

// 비즈니스 로직 주입 (composables에서 가져옴)
const seating = useSeating()

// --- 윈도우 스케일링 로직 ---
const scale = ref(1)
const rootWidth = 1920
const rootHeight = 1080

const updateScale = () => {
  const winWidth = window.innerWidth
  const winHeight = window.innerHeight
  
  // 가로/세로 중 더 꽉 차는 비율에 맞춰 스케일 결정
  const widthRatio = winWidth / rootWidth
  const heightRatio = winHeight / rootHeight
  scale.value = Math.min(widthRatio, heightRatio)
}

onMounted(() => {
  updateScale()
  window.addEventListener('resize', updateScale)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScale)
})
</script>

<template>
  <div class="fixed inset-0 bg-[#0f172a] flex items-center justify-center overflow-hidden">
    
    <div 
      id="presentation-root"
      class="bg-white flex shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden origin-center transition-transform duration-200"
      :style="{ 
        width: `${rootWidth}px`, 
        height: `${rootHeight}px`,
        transform: `scale(${scale})` 
      }"
    >
      <StudentPanel :seating="seating" />

      <SeatGrid :seating="seating" />
      
    </div>

    <div class="absolute bottom-4 right-4 text-white/30 text-xs pointer-events-none">
      Scaling: {{ scale.toFixed(2) }}x | 1920x1080
    </div>
  </div>
</template>

<style>
/* 전역 폰트 및 스타일 초기화 */
body {
  margin: 0;
  padding: 0;
  cursor: default;
  -webkit-font-smoothing: antialiased;
}

/* 스크롤바 커스텀: 프레젠테이션 느낌 유지 */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>