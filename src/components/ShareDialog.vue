<script setup>
// 배치를 링크·QR·메일로 내보내기.
import { ref, watch, computed, onUnmounted } from 'vue'
import qrcode from 'qrcode-generator'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Copy, Check, Mail, Maximize2 } from 'lucide-vue-next'
import { makeShareLink, mailtoLink } from '@/lib/share'

const props = defineProps({ seating: Object })
const open = defineModel('open', { type: Boolean, default: false })

const url = ref('')
const copied = ref(false)
const qrSvg = ref('')
const zoomed = ref(false)

const rosterName = computed(() => props.seating.activeRoster?.name || '자리 배치')

watch(open, async (on) => {
  zoomed.value = false
  copied.value = false
  if (!on) return
  const r = props.seating.activeRoster
  if (!r) return

  // 살아있는 상태를 그대로 담는다 (명단 항목은 전환할 때만 갱신되므로)
  url.value = await makeShareLink({
    name: r.name,
    gridConfig: props.seating.gridConfig,
    students: props.seating.students,
    seats: props.seating.seats
  })

  // 오류정정은 가장 낮은 L. 깨끗한 화면에 띄우는 용도라 복원력보다
  // 칸 수를 줄여 칸 하나를 크게 만드는 편이 성능 낮은 카메라에 유리하다.
  const qr = qrcode(0, 'L')
  qr.addData(url.value)
  qr.make()
  qrSvg.value = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
})

const copy = async () => {
  try {
    await navigator.clipboard.writeText(url.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1600)
  } catch (e) {
    // 클립보드를 막아둔 브라우저에서는 직접 고르도록 둔다
    document.getElementById('share-url')?.select?.()
  }
}

// 확대 중에는 Esc가 다이얼로그까지 닿지 않게 막는다
const onKey = (e) => {
  if (e.key !== 'Escape' || !zoomed.value) return
  e.preventDefault()
  e.stopPropagation()
  zoomed.value = false
}
watch(zoomed, (on) => {
  if (on) window.addEventListener('keydown', onKey, true)
  else window.removeEventListener('keydown', onKey, true)
})
onUnmounted(() => window.removeEventListener('keydown', onKey, true))
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="!rounded-[24px] !border-0 !p-9 !gap-6 sm:max-w-3xl" style="box-shadow: var(--shadow-md)">
      <DialogHeader>
        <DialogTitle class="text-[25px] font-black leading-tight">링크로 보내기</DialogTitle>
        <DialogDescription class="text-[16px] leading-relaxed pt-1" style="color: var(--c-ink-soft)">
          지금 <b>{{ rosterName }}</b>의 자리 배치를 링크 하나에 담았습니다. 받은 사람이 링크를 열면 그대로 보입니다.
        </DialogDescription>
      </DialogHeader>

      <div class="flex gap-7 items-start">
        <button class="qr" title="크게 보기" @click="zoomed = true">
          <span class="qr-img" v-html="qrSvg" />
          <span class="qr-zoom"><Maximize2 class="w-4 h-4" /> 크게</span>
        </button>

        <div class="flex-1 min-w-0 flex flex-col gap-3">
          <input id="share-url" class="url" :value="url" readonly @focus="$event.target.select()" />
          <div class="flex gap-2">
            <Button size="sm" @click="copy">
              <component :is="copied ? Check : Copy" class="w-4 h-4" />
              {{ copied ? '복사했습니다' : '링크 복사' }}
            </Button>
            <Button size="sm" variant="secondary" as="a" :href="mailtoLink(rosterName, url)">
              <Mail class="w-4 h-4" /> 메일로 보내기
            </Button>
          </div>
          <p class="note">
            링크 안에 이름과 자리만 담깁니다 — 서버에 아무것도 올라가지 않습니다.<br>
            <b>QR을 누르면 화면 가득 커집니다.</b> 교실 화면에 띄워 두면 아이들이 각자 찍어 갑니다.
          </p>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- 확대: 다이얼로그 위에 따로 띄운다 (다이얼로그 안에 두면 잘린다) -->
  <Teleport to="body">
    <Transition name="zoom">
      <button v-if="zoomed" class="zoom-layer" @click="zoomed = false">
        <span class="zoom-card">
          <span class="zoom-img" v-html="qrSvg" />
          <span class="zoom-name">{{ rosterName }}</span>
        </span>
        <span class="zoom-hint">아무 곳이나 누르면 닫힙니다</span>
      </button>
    </Transition>
  </Teleport>
</template>

<style scoped>
.qr {
  position: relative;
  width: 224px;
  height: 224px;
  flex: none;
  padding: 12px;
  border-radius: 20px;
  background: #fff;
  box-shadow: inset 0 0 0 1.5px var(--c-line);
  cursor: pointer;
  transition: box-shadow 160ms ease, transform 160ms ease;
}
.qr:hover { box-shadow: inset 0 0 0 2px var(--c-primary), var(--shadow-md); transform: translateY(-2px); }
.qr:focus-visible { outline: 3px solid var(--c-primary); outline-offset: 3px; }
.qr-img { display: block; width: 100%; height: 100%; }
.qr-img :deep(svg) { width: 100%; height: 100%; display: block; }

.qr-zoom {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 999px;
  background: var(--c-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  opacity: 0;
  transition: opacity 160ms ease;
}
.qr:hover .qr-zoom, .qr:focus-visible .qr-zoom { opacity: 1; }

.url {
  width: 100%;
  height: 46px;
  padding: 0 16px;
  border: 0;
  outline: none;
  border-radius: 14px;
  font-family: inherit;
  font-size: 14px;
  color: var(--c-ink-soft);
  background: var(--c-bg);
  box-shadow: inset 0 0 0 1.5px var(--c-line);
}
.url:focus { box-shadow: inset 0 0 0 2px var(--c-primary); }

.note { margin: 0; font-size: 14px; line-height: 1.7; color: var(--c-muted); }
.note b { color: var(--c-ink-soft); }

/* --- 확대 --- */
.zoom-layer {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  border: 0;
  padding: 0;
  background: rgba(20, 12, 10, 0.88);
  backdrop-filter: blur(4px);
  cursor: zoom-out;
}
.zoom-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 28px;
  border-radius: 28px;
  background: #fff;
  box-shadow: 0 30px 80px -30px rgba(0, 0, 0, .7);
}
.zoom-img { display: block; width: min(66vw, 66vh); height: min(66vw, 66vh); }
.zoom-img :deep(svg) { width: 100%; height: 100%; display: block; }
.zoom-name { font-size: 22px; font-weight: 900; color: var(--c-ink); }
.zoom-hint { font-size: 15px; font-weight: 700; color: rgba(255, 255, 255, .55); }

.zoom-enter-active, .zoom-leave-active { transition: opacity 180ms ease; }
.zoom-enter-from, .zoom-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .qr, .qr-zoom, .zoom-enter-active, .zoom-leave-active { transition: none; }
}
</style>
