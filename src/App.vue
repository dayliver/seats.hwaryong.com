<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useSeating } from '@/composables/useSeating'
import StudentPanel from '@/components/StudentPanel.vue'
import SeatGrid from '@/components/SeatGrid.vue'
import SpinOverlay from '@/components/SpinOverlay.vue'
import ActionMenu from '@/components/ActionMenu.vue'

// 비즈니스 로직 주입 (composables에서 가져옴)
const seating = useSeating()

// --- 윈도우 스케일링 로직 ---
const scale = ref(1)
const rootWidth = 1920
const rootHeight = 1080

const updateScale = () => {
  const winWidth = window.innerWidth
  const winHeight = window.innerHeight
  
  // 가로/세로 중 더 꽉 차는 비율에 맞춰 배율 결정.
  // transform:scale() 대신 zoom을 쓴다 — transform은 배치가 끝난 뒤 확대하므로
  // 9-slice 조각들이 각자 반올림되어 경계에 틈이 생긴다.
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
  <div class="app-shell fixed inset-0 flex items-center justify-center overflow-hidden">
    
    <div 
      id="presentation-root"
      class="relative flex shadow-[0_30px_90px_-20px_rgba(74,43,38,0.42)] overflow-hidden"
      :style="{ 
        width: `${rootWidth}px`, 
        height: `${rootHeight}px`,
        zoom: scale,
        background: 'var(--c-bg)' 
      }"
    >
      <StudentPanel :seating="seating" />

      <SeatGrid :seating="seating" />

      <ActionMenu />

      <Transition name="spin-fade">
        <SpinOverlay v-if="seating.spin.active" :spin="seating.spin" />
      </Transition>

    </div>

    <div class="absolute bottom-3 right-4 text-[11px] pointer-events-none"
         style="color: var(--c-ink); opacity: 0.3">
      {{ scale.toFixed(2) }}x · 에이투지체
    </div>
  </div>
</template>

<style>
/* 전역 폰트 및 스타일 초기화 */
body {
  margin: 0;
  padding: 0;
  cursor: default;
  background: var(--c-shell);
}

/* 캔버스 바깥은 쓰지 않는 공간이라는 뜻으로 옅은 모눈을 깐다.
   40px 잔선 위에 200px마다 조금 진한 선을 겹쳐 제도판처럼 보이게 했다. */
.app-shell {
  background-color: var(--c-shell);
  background-image:
    linear-gradient(to right, var(--c-grid-strong) 1px, transparent 1px),
    linear-gradient(to bottom, var(--c-grid-strong) 1px, transparent 1px),
    linear-gradient(to right, var(--c-grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--c-grid) 1px, transparent 1px);
  background-size: 200px 200px, 200px 200px, 40px 40px, 40px 40px;
  background-position: center center;
}

/* 배정 연출 오버레이 등장/퇴장 */
.spin-fade-enter-active { transition: opacity 300ms ease; }
.spin-fade-leave-active { transition: opacity 400ms ease; }
.spin-fade-enter-from,
.spin-fade-leave-to { opacity: 0; }

/* 스크롤바 커스텀: 프레젠테이션 느낌 유지 */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #e3cfc7;
  border-radius: 999px;
}
::-webkit-scrollbar-thumb:hover {
  background: #f9ab8f;
}
</style>