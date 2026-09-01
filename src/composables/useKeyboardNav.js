import { ref, onMounted, onUnmounted } from 'vue'

// 게임처럼 키보드만으로 조작하기 위한 커서.
//
//   Tab / Shift+Tab   구역 이동 (명단 → 툴바 → 좌석)
//   방향키            구역 안에서 커서 이동. 가장자리에서 한 번 더 누르면 옆 구역으로 넘어간다.
//
//        ┌──────────┬────────────────┐
//        │          │     toolbar    │   좌석에서 ← 는 행 머리글 → 명단으로
//        │ students ├────────────────┤   좌석에서 ↑ 는 열 머리글 → 툴바로
//        │          │     seats      │   툴바에서 ← 는 명단으로, ↓ 는 좌석으로
//        └──────────┴────────────────┘   명단에서 ↑ 는 툴바로, → 는 좌석으로
//
// 좌석 구역의 커서는 r,c 좌표다. r=-1 은 열 머리글 줄, c=-1 은 행 머리글 칸을 뜻한다.
//   Enter / Space     실행 (메뉴 열기 포함)
//   Esc               취소 (메뉴 닫기 → 모드 해제 → 학생 선택 해제)
//
// 실제 포커스는 브라우저 것을 그대로 쓴다. 그래야 포커스 링·접근성이 공짜로 따라오고
// 마우스로 눌렀을 때도 커서 위치가 저절로 맞는다.

const ZONES = ['students', 'toolbar', 'seats']

// 단 하나뿐인 커서라 모듈 수준에 노출해 둔다. 메뉴에서 '자리를 고르세요' 같은
// 지시를 내린 뒤 커서를 옮겨야 할 때 쓴다.
export const navCursor = {
  toSeats: () => {},
  toStudents: () => {}
}

export function useKeyboardNav(seating, { menu, onActivate }) {
  const zone = ref('seats')
  const lastIdx = { students: 0, toolbar: 0, menu: 0 }
  const cursor = { r: 0, c: 0 }

  const zoneRoot = (z) => document.querySelector(`[data-zone="${z}"]`)

  // 한 구역의 항목들. 안쪽에 다른 구역(열린 메뉴)이 있으면 그건 제외한다.
  const items = (z) => {
    const root = zoneRoot(z)
    if (!root) return []
    // 화면에 없는 항목은 v-if로 이미 제거되므로 레이아웃 검사는 하지 않는다
    return Array.from(root.querySelectorAll('[data-kb]')).filter(
      el => el.closest('[data-zone]') === root && !el.disabled
    )
  }

  const focusIn = (z, idx = 0) => {
    const list = items(z)
    if (!list.length) return false
    const i = Math.max(0, Math.min(idx, list.length - 1))
    list[i].focus()
    zone.value = z
    lastIdx[z] = i
    return true
  }

  // r=-1 열 머리글, c=-1 행 머리글, 그 외는 좌석
  const gridEl = (r, c) => {
    if (r === -1 && c === -1) return null
    if (r === -1) return document.querySelector(`[data-axis="col-${c}"]`)
    if (c === -1) return document.querySelector(`[data-axis="row-${r}"]`)
    return document.querySelector(`[data-seat="${r}-${c}"]`)
  }

  const focusSeat = (r, c) => {
    const el = gridEl(r, c)
    if (!el) return false
    cursor.r = r
    cursor.c = c
    el.focus()
    zone.value = 'seats'
    return true
  }

  // 구역 안에서 한 칸 옮긴다. 끝에 닿으면 leave()로 옆 구역에 넘긴다.
  const step = (z, delta, leave) => {
    const list = items(z)
    if (!list.length) return leave?.()
    const at = list.indexOf(document.activeElement)
    const next = at === -1 ? 0 : at + delta
    if (next < 0 || next >= list.length) return leave?.()
    list[next].focus()
    zone.value = z
    lastIdx[z] = next
  }

  // 메뉴만 순환시킨다 (열린 목록 안에서는 위아래로 도는 편이 자연스럽다)
  const stepMenu = (delta) => {
    const list = items('menu')
    if (!list.length) return
    const at = list.indexOf(document.activeElement)
    const next = (((at === -1 ? 0 : at + delta) % list.length) + list.length) % list.length
    list[next].focus()
    lastIdx.menu = next
  }

  const enterSeats = () => focusSeat(cursor.r, cursor.c) || focusSeat(0, 0)

  const moveSeat = (dr, dc) => {
    const { rows, cols } = seating.gridConfig
    const r = cursor.r + dr
    const c = cursor.c + dc
    // 머리글 두 줄이 만나는 빈 모서리는 건너뛴다
    if (r === -1 && c === -1) {
      return dc < 0 ? focusIn('students', lastIdx.students) : focusIn('toolbar', lastIdx.toolbar)
    }
    if (c < -1) return focusIn('students', lastIdx.students)  // 행 머리글보다 왼쪽 → 명단
    if (r < -1) return focusIn('toolbar', lastIdx.toolbar)    // 열 머리글보다 위 → 툴바
    if (r >= rows || c >= cols) return                        // 오른쪽·아래쪽은 벽
    focusSeat(r, c)
  }

  // 비어 있는 구역은 건너뛰며 다음 구역으로
  const gotoZone = (dir) => {
    const from = ZONES.indexOf(zone.value)
    for (let n = 1; n <= ZONES.length; n++) {
      const z = ZONES[(((from + dir * n) % ZONES.length) + ZONES.length) % ZONES.length]
      if (z === 'seats') {
        if (enterSeats()) return
      } else if (focusIn(z, lastIdx[z])) return
    }
  }

  const closeMenu = () => menu.close()

  // 메뉴 → 진행 중인 지시 → 선택 순으로 하나씩 푼다
  const escape = () => {
    if (menu.isOpen.value) return closeMenu()
    seating.cancelPending()
  }

  // 다이얼로그가 열려 있거나 글자를 입력 중이면 손대지 않는다
  const busy = () => {
    const el = document.activeElement
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return true
    return !!document.querySelector('[role="dialog"][data-state="open"]')
  }

  const onKeydown = (e) => {
    if (busy() || e.ctrlKey || e.metaKey || e.altKey) return
    if (seating.isAnimating && e.key !== 'Escape') return

    const z = menu.isOpen.value ? 'menu' : zone.value

    switch (e.key) {
      case 'Tab':
        e.preventDefault()
        if (menu.isOpen.value) menu.close({ restoreFocus: false })
        gotoZone(e.shiftKey ? -1 : 1)
        return

      case 'Escape':
        e.preventDefault()
        escape()
        return

      case 'ArrowUp':
      case 'ArrowDown': {
        e.preventDefault()
        const d = e.key === 'ArrowDown' ? 1 : -1
        if (z === 'menu') stepMenu(d)
        else if (z === 'seats') moveSeat(d, 0)
        else if (z === 'students') step('students', d, () => { if (d < 0) focusIn('toolbar', lastIdx.toolbar) })
        else if (z === 'toolbar' && d > 0) enterSeats()       // 툴바 아래는 좌석
        return
      }

      case 'ArrowLeft':
      case 'ArrowRight': {
        e.preventDefault()
        const d = e.key === 'ArrowRight' ? 1 : -1
        if (z === 'menu') { if (d < 0) closeMenu() }          // ← 로 메뉴를 닫고 나온다
        else if (z === 'seats') moveSeat(0, d)
        else if (z === 'toolbar') step('toolbar', d, () => { if (d < 0) focusIn('students', lastIdx.students) })
        else if (z === 'students' && d > 0) enterSeats()      // 명단 오른쪽은 좌석
        return
      }

      case 'Enter':
      case ' ':
        // 버튼은 브라우저가 알아서 누른다. 좌석은 <div>라 여기서 처리한다.
        if (zone.value === 'seats' && !menu.isOpen.value && cursor.r >= 0 && cursor.c >= 0) {
          e.preventDefault()
          onActivate(cursor.r, cursor.c)
        }
        return
    }
  }

  // 마우스로 눌러도 커서가 따라오도록 실제 포커스를 그대로 반영한다
  const onFocusIn = (e) => {
    const root = e.target.closest?.('[data-zone]')
    if (!root) return
    const z = root.dataset.zone
    if (z === 'menu') { lastIdx.menu = items('menu').indexOf(e.target); return }
    zone.value = z
    if (z === 'seats') {
      const { seat, axis } = e.target.dataset
      if (seat) {
        const [r, c] = seat.split('-').map(Number)
        cursor.r = r
        cursor.c = c
      } else if (axis) {
        const [kind, i] = axis.split('-')
        if (kind === 'col') { cursor.r = -1; cursor.c = Number(i) }
        else { cursor.r = Number(i); cursor.c = -1 }
      }
    } else {
      lastIdx[z] = items(z).indexOf(e.target)
    }
  }

  navCursor.toSeats = () => enterSeats()
  navCursor.toStudents = () => focusIn('students', lastIdx.students)

  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('focusin', onFocusIn)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('focusin', onFocusIn)
  })

  return { zone, focusMenuFirst: () => focusIn('menu', 0), enterSeats }
}
