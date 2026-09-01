import { reactive } from 'vue'

// 대상(학생·좌석·행·열)을 Enter하면 뜨는 상황별 메뉴.
// 캔버스(1920×1080) 좌표계에 절대 배치하므로, 화면 배율과 무관하게 대상 옆에 붙는다.

const CANVAS_W = 1920
const CANVAS_H = 1080
const MENU_W = 300
const EDGE = 20

const state = reactive({
  open: false,
  title: '',
  hint: '',
  items: [],
  x: 0,
  y: 0,
  flipUp: false
})

let anchorEl = null

export const actionMenu = state

export function openActionMenu(el, { title, hint = '', items }) {
  const root = document.getElementById('presentation-root')
  if (!root || !el) return

  const rr = root.getBoundingClientRect()
  const scale = rr.width / CANVAS_W || 1
  const r = el.getBoundingClientRect()

  const left = (r.left - rr.left) / scale
  const top = (r.top - rr.top) / scale
  const bottom = (r.bottom - rr.top) / scale

  state.items = items.filter(Boolean)
  state.title = title
  state.hint = hint
  state.x = Math.max(EDGE, Math.min(left, CANVAS_W - MENU_W - EDGE))

  // 아래로 펼쳤을 때 캔버스를 벗어나면 위로 뒤집는다
  const guess = 62 + state.items.length * 52 + (hint ? 34 : 0)
  if (bottom + 10 + guess > CANVAS_H - EDGE) {
    state.y = top - 10
    state.flipUp = true
  } else {
    state.y = bottom + 10
    state.flipUp = false
  }

  anchorEl = el
  state.open = true
}

export function closeActionMenu({ restoreFocus = true } = {}) {
  if (!state.open) return
  state.open = false
  state.items = []
  const el = anchorEl
  anchorEl = null
  if (restoreFocus && el?.isConnected) el.focus?.()
}
