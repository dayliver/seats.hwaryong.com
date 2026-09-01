import { ref, reactive, computed, watch, onMounted } from 'vue'
import { applyTheme, DEFAULT_THEME, getTheme } from '@/lib/themes'
import * as store from '@/lib/snapshots'
import { readShareLink, clearShareHash } from '@/lib/share'

const STORE_KEY = 'seats-data'
const newId = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const blankRoster = (name) => ({
  id: newId('roster'), name,
  gridConfig: { rows: 6, cols: 6 },
  students: [],
  seats: []
})

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// 룰렛 셋을 돌린다.
//   ① 칸수     : 눈금이 '지금 앉을 수 있는 자리 수'만큼. 1~N이 후보를 정확히
//                한 번씩 덮으므로 어느 자리든 똑같은 확률로 나온다.
//   ② 첫 방향  : 줄을 따라 어느 쪽으로 세어 갈지 (상하좌우)
//   ③ 줄 끝 방향 : 줄이 끝났을 때 어느 줄로 넘어갈지
// ②와 ③은 서로 수직이어야 하므로, ②가 멈춘 뒤 ③의 눈금을 두 갈래로 좁힌다.
const DIR_FACES = ['→', '←', '↑', '↓']
const isHoriz = (d) => d === '→' || d === '←'
const crossFaces = (d) => (isHoriz(d) ? ['↑', '↓'] : ['←', '→'])

const pick = (list) => list[Math.floor(Math.random() * list.length)]

// 두 방향이 정하는 '세는 순서'대로 좌석에 매길 번호.
// 앞 방향이 줄 안에서의 진행, 뒷 방향이 줄과 줄 사이의 진행이다.
function orderKeyFactory(d1, d2, rows, cols) {
  const horiz = isHoriz(d1)
  const lineCount = horiz ? rows : cols   // 줄의 개수
  const posCount = horiz ? cols : rows    // 한 줄의 길이
  const lineAsc = d2 === '↓' || d2 === '→'
  const posAsc = d1 === '→' || d1 === '↓'

  return (seat) => {
    const line = horiz ? seat.row : seat.col
    const pos = horiz ? seat.col : seat.row
    const lineRank = lineAsc ? line : lineCount - 1 - line
    const posRank = posAsc ? pos : posCount - 1 - pos
    return lineRank * posCount + posRank
  }
}

const roll9 = () => 1 + Math.floor(Math.random() * 9)

// 한 칸씩 세어 이동할 때의 칸별 지연시간.
// 처음엔 촘촘하고 끝으로 갈수록 느려지며, 이동 칸수와 무관하게 총 길이를 일정하게 유지한다.
function buildHopDelays(steps) {
  const total = Math.min(8400, Math.max(2400, steps * 420))
  const weights = Array.from({ length: steps }, (_, k) => 0.12 + Math.pow((k + 1) / steps, 3))
  const sum = weights.reduce((a, b) => a + b, 0)
  return weights.map((w) => Math.min(1900, Math.max(48, (total / sum) * w)))
}

export function useSeating() {
  const gridConfig = reactive({ rows: 6, cols: 6 })
  const students = ref([])
  const seats = ref([])
  const isEditMode = ref(false)
  const isRestrictionMode = ref(false)
  const isAnimating = ref(false)
  const highlightedSeatId = ref(null)
  const selectedStudent = ref(null)
  const countdownValue = ref(null)
  
  // 교체(Swap) 관련 상태
  const isSwapMode = ref(false)
  const swapSourceId = ref(null)

  // 명단(반)별 작업공간. 각 명단은 학생·좌석·교실 구조를 따로 가진다.
  const rosters = ref([])
  const activeRosterId = ref(null)
  const themeId = ref(DEFAULT_THEME)

  // 이름 붙여 굳혀 둔 배치 (자동 저장과 별도 저장소)
  const snapshots = ref([])
  const saveError = ref(null)

  // 진행 중인 지시
  const placingStudentId = ref(null)   // '직접 배정' — 다음에 고르는 빈 자리에 앉힌다
  const pendingSeatId = ref(null)      // 빈 자리에서 '학생 고르기' — 다음에 고르는 학생을 앉힌다
  const lineSwapFrom = ref(null)       // 줄 교체 출발지 { type, index }

  // 룰렛/주사위 연출 상태 (직전 학생 자리가 다음 학생의 출발점이 된다)
  const lastAssignedSeatId = ref(null)
  const spin = reactive({
    active: false,
    phase: 'idle',   // intro | r1 | r2 | r3 | result
    studentName: '',
    n: null,                     // ① 칸수
    slots: [],                   // ① 눈금 (남은 자리 수만큼)
    d1: null, d2: null,          // ② 첫 방향 / ③ 줄 끝 방향
    d2Slots: DIR_FACES           // ③ 눈금 (②가 정해지면 두 갈래로 좁아진다)
  })

  const initGrid = () => {
    selectedStudent.value = null
    isSwapMode.value = false
    swapSourceId.value = null

    const newSeats = []
    for (let r = 0; r < gridConfig.rows; r++) {
      for (let c = 0; c < gridConfig.cols; c++) {
        newSeats.push({
          id: `seat-${r}-${c}`,
          row: r, col: c,
          status: 'available',
          studentId: null
        })
      }
    }
    seats.value = newSeats
    lastAssignedSeatId.value = null

    // 사라진 좌석을 가리키는 금지 설정은 함께 정리 (유령 제한 방지)
    const validIds = new Set(newSeats.map(s => s.id))
    students.value.forEach(s => {
      s.isAssigned = false
      s.deniedSeatIds = (s.deniedSeatIds || []).filter(id => validIds.has(id))
    })
  }

  // ★ 추가: 모든 학생의 금지 좌석 설정을 한 번에 해제
  const clearAllRestrictions = () => {
    students.value.forEach(s => { s.deniedSeatIds = [] })
    isRestrictionMode.value = false
  }

  // ★ 추가: 특정 학생의 금지 좌석만 해제
  const clearStudentRestrictions = (student) => {
    if (student) student.deniedSeatIds = []
  }

  // --- 줄(행/열) 단위 조작 ---
  const lineSeats = (type, index) =>
    seats.value
      .filter(s => (type === 'row' ? s.row === index : s.col === index))
      .sort((a, b) => (type === 'row' ? a.col - b.col : a.row - b.row))

  // 앉아 있는 자리는 건드리지 않는다 — 자리를 없애려면 먼저 배정을 풀어야 한다
  const setLineForbidden = (type, index, forbidden) => {
    lineSeats(type, index).forEach(s => {
      if (s.status === 'occupied') return
      s.status = forbidden ? 'forbidden' : 'available'
    })
  }

  const clearLineAssignments = (type, index) => {
    lineSeats(type, index).forEach(s => {
      if (s.status !== 'occupied') return
      const st = students.value.find(x => x.id === s.studentId)
      if (st) st.isAssigned = false
      s.studentId = null
      s.status = 'available'
    })
  }

  const startLineSwap = (type, index) => { lineSwapFrom.value = { type, index } }

  // 같은 종류(행↔행, 열↔열)끼리만 맞바꾼다. 길이가 달라질 일이 없고 방향도 헷갈리지 않는다.
  const executeLineSwap = (type, index) => {
    const from = lineSwapFrom.value
    lineSwapFrom.value = null
    if (!from || from.type !== type || from.index === index) return

    const a = lineSeats(from.type, from.index)
    const b = lineSeats(type, index)
    const n = Math.min(a.length, b.length)
    for (let i = 0; i < n; i++) {
      const sa = a[i], sb = b[i]
      if (sa.status === 'forbidden' || sb.status === 'forbidden') continue
      const t = sa.studentId
      sa.studentId = sb.studentId
      sb.studentId = t
      sa.status = sa.studentId ? 'occupied' : 'available'
      sb.status = sb.studentId ? 'occupied' : 'available'
    }
  }

  // 줄을 한 칸 민다.
  //   줄과 나란한 방향(행의 ←→, 열의 ↑↓)  : 줄 안에서 한 칸씩 밀고 끝은 처음으로 돌아온다
  //   줄을 가로지르는 방향(행의 ↑↓, 열의 ←→) : 옆 줄과 통째로 맞바꾼다
  const shiftIsAlong = (type, dir) =>
    type === 'row' ? (dir === '←' || dir === '→') : (dir === '↑' || dir === '↓')

  const shiftTarget = (type, index, dir) => {
    const max = type === 'row' ? gridConfig.rows : gridConfig.cols
    const next = index + (dir === '↓' || dir === '→' ? 1 : -1)
    return next >= 0 && next < max ? next : null
  }

  const canShiftLine = (type, index, dir) => {
    if (shiftIsAlong(type, dir)) {
      return lineSeats(type, index).filter(s => s.status !== 'forbidden').length >= 2
    }
    return shiftTarget(type, index, dir) !== null
  }

  const shiftLine = (type, index, dir) => {
    if (!canShiftLine(type, index, dir)) return

    if (shiftIsAlong(type, dir)) {
      // 없는 자리는 건너뛰고 남은 칸들만 돌린다
      const list = lineSeats(type, index).filter(s => s.status !== 'forbidden')
      const ids = list.map(s => s.studentId)
      const forward = dir === '→' || dir === '↓'
      const rotated = forward
        ? [ids[ids.length - 1], ...ids.slice(0, -1)]
        : [...ids.slice(1), ids[0]]
      list.forEach((seat, i) => {
        seat.studentId = rotated[i]
        seat.status = seat.studentId ? 'occupied' : 'available'
      })
      return
    }

    lineSwapFrom.value = { type, index }
    executeLineSwap(type, shiftTarget(type, index, dir))
  }

  // 메뉴 문구를 정할 때 쓰는 줄 요약
  const lineInfo = (type, index) => {
    const list = lineSeats(type, index)
    const sel = selectedStudent.value
    return {
      total: list.length,
      occupied: list.filter(s => s.status === 'occupied').length,
      forbidden: list.filter(s => s.status === 'forbidden').length,
      free: list.filter(s => s.status === 'available').length,
      allDenied: !!sel && list.length > 0 && list.every(s => sel.deniedSeatIds.includes(s.id))
    }
  }

  // 한 학생이 두 자리를 차지하지 않도록, 앉히기 전에 원래 자리를 비운다
  const releaseStudent = (studentId) => {
    seats.value.forEach(s => {
      if (s.studentId !== studentId) return
      s.studentId = null
      s.status = 'available'
      if (lastAssignedSeatId.value === s.id) lastAssignedSeatId.value = null
    })
  }

  // --- 좌석 단위 조작 ---
  const toggleSeatForbidden = (seat) => {
    if (!seat || seat.status === 'occupied') return
    seat.status = seat.status === 'forbidden' ? 'available' : 'forbidden'
  }

  const startPlacing = (student) => {
    selectedStudent.value = student
    pendingSeatId.value = null
    placingStudentId.value = student.id
  }

  const startPickingFor = (seatId) => {
    placingStudentId.value = null
    pendingSeatId.value = seatId
  }

  // 지시 하나를 취소한다. 안쪽 것부터 하나씩 푼다.
  const cancelPending = () => {
    if (lineSwapFrom.value) { lineSwapFrom.value = null; return true }
    if (isSwapMode.value) { isSwapMode.value = false; swapSourceId.value = null; return true }
    if (placingStudentId.value) { placingStudentId.value = null; return true }
    if (pendingSeatId.value) { pendingSeatId.value = null; return true }
    if (isRestrictionMode.value) { isRestrictionMode.value = false; return true }
    if (isEditMode.value) { isEditMode.value = false; return true }
    if (selectedStudent.value) { selectedStudent.value = null; return true }
    return false
  }

  // 금지로 지정된 좌석의 총 개수 (학생 전체 합산)
  const restrictionCount = computed(
    () => students.value.reduce((n, s) => n + (s.deniedSeatIds?.length || 0), 0)
  )

  // ★ 추가: 교실 구조는 유지하고 학생 배정만 모두 취소
  const clearAllAssignments = () => {
    students.value.forEach(s => s.isAssigned = false)
    seats.value.forEach(seat => {
      if (seat.status === 'occupied') {
        seat.status = 'available'
        seat.studentId = null
      }
    })
    selectedStudent.value = null
    isSwapMode.value = false
    swapSourceId.value = null
    lastAssignedSeatId.value = null
    placingStudentId.value = null
    pendingSeatId.value = null
    lineSwapFrom.value = null
  }

  // ★ 추가: 개별 배정 취소
  const cancelAssignment = (seatId) => {
    const seat = seats.value.find(s => s.id === seatId)
    if (!seat || !seat.studentId) return

    const student = students.value.find(s => s.id === seat.studentId)
    if (student) student.isAssigned = false

    seat.studentId = null
    seat.status = 'available'
  }

  // ★ 추가: 자리 교체 로직
  const startSwap = (seatId) => {
    isSwapMode.value = true
    swapSourceId.value = seatId
  }

  const executeSwap = (targetId) => {
    const sourceSeat = seats.value.find(s => s.id === swapSourceId.value)
    const targetSeat = seats.value.find(s => s.id === targetId)

    if (!sourceSeat || !targetSeat || targetSeat.status === 'forbidden') return

    // 학생 ID 백업
    const sourceStudentId = sourceSeat.studentId
    const targetStudentId = targetSeat.studentId

    // 좌석 주인 바꾸기
    sourceSeat.studentId = targetStudentId
    targetSeat.studentId = sourceStudentId

    // 상태 업데이트 (빈 자리로 옮길 경우 대응)
    sourceSeat.status = sourceSeat.studentId ? 'occupied' : 'available'
    targetSeat.status = targetSeat.studentId ? 'occupied' : 'available'

    // 모드 종료
    isSwapMode.value = false
    swapSourceId.value = null
  }

  const normalizeStudents = (list) =>
    (list || []).map(s => ({ ...s, deniedSeatIds: s.deniedSeatIds || [] }))

  // 활성 명단의 내용을 화면이 쓰는 살아있는 상태로 옮긴다
  const openRoster = (roster) => {
    Object.assign(gridConfig, roster.gridConfig || { rows: 6, cols: 6 })
    students.value = normalizeStudents(roster.students)
    seats.value = roster.seats || []
    activeRosterId.value = roster.id
    selectedStudent.value = null
    isSwapMode.value = false
    swapSourceId.value = null
    isRestrictionMode.value = false
    isEditMode.value = false
    lastAssignedSeatId.value = null
    if (!seats.value.length) initGrid()
  }

  // 살아있는 상태를 지금 명단 항목에 되돌려 담는다
  const stash = () => {
    const cur = rosters.value.find(r => r.id === activeRosterId.value)
    if (!cur) return
    cur.gridConfig = { rows: gridConfig.rows, cols: gridConfig.cols }
    cur.students = students.value
    cur.seats = seats.value
  }

  const loadData = () => {
    let doc = null
    try { doc = JSON.parse(localStorage.getItem(STORE_KEY) || 'null') } catch (e) { doc = null }

    if (doc && Array.isArray(doc.rosters) && doc.rosters.length) {
      rosters.value = doc.rosters
      themeId.value = doc.theme || DEFAULT_THEME
      const target = doc.rosters.find(r => r.id === doc.activeId) || doc.rosters[0]
      openRoster(target)
    } else if (doc && (doc.students || doc.seats)) {
      // 예전 단일 명단 저장본을 명단 하나로 옮겨 담는다
      const r = blankRoster('우리 반')
      r.gridConfig = doc.gridConfig || { rows: 6, cols: 6 }
      r.students = normalizeStudents(doc.students)
      r.seats = doc.seats || []
      rosters.value = [r]
      openRoster(r)
    } else {
      const r = blankRoster('우리 반')
      rosters.value = [r]
      openRoster(r)
    }

    applyTheme(themeId.value)
    snapshots.value = store.listSnapshots()
  }

  // 주소에 공유 링크가 붙어 있으면 새 명단으로 받아 연다.
  // 기존 명단을 덮지 않으므로 실수로 링크를 열어도 잃는 게 없다.
  const openSharedLink = async () => {
    const shared = await readShareLink()
    if (!shared) return false
    clearShareHash()
    stash()
    const r = blankRoster(shared.name)
    r.gridConfig = shared.gridConfig
    r.students = shared.students
    r.seats = shared.seats
    rosters.value.push(r)
    openRoster(r)
    return true
  }

  // --- 명단 관리 ---
  const switchRoster = (id) => {
    if (isAnimating.value || id === activeRosterId.value) return
    const next = rosters.value.find(r => r.id === id)
    if (!next) return
    stash()
    openRoster(next)
  }

  const addRoster = (name) => {
    if (isAnimating.value) return
    stash()
    const r = blankRoster((name || '').trim() || `명단 ${rosters.value.length + 1}`)
    rosters.value.push(r)
    openRoster(r)
  }

  // 교실 구조는 그대로 두고 학생만 복사할지, 통째로 복사할지 고를 수 있게 한다
  const duplicateRoster = (id, { withStudents = true } = {}) => {
    if (isAnimating.value) return
    stash()
    const src = rosters.value.find(r => r.id === id)
    if (!src) return
    const copy = blankRoster(`${src.name} 사본`)
    copy.gridConfig = { ...(src.gridConfig || { rows: 6, cols: 6 }) }
    // 좌석 구조(있는 자리 / 없는 자리)만 물려받고 배정은 비운다
    copy.seats = (src.seats || []).map(s => ({
      ...s,
      status: s.status === 'forbidden' ? 'forbidden' : 'available',
      studentId: null
    }))
    copy.students = withStudents
      ? (src.students || []).map(s => ({ ...s, id: newId('std'), isAssigned: false, deniedSeatIds: [...(s.deniedSeatIds || [])] }))
      : []
    rosters.value.push(copy)
    openRoster(copy)
  }

  const renameRoster = (id, name) => {
    const r = rosters.value.find(x => x.id === id)
    const trimmed = (name || '').trim()
    if (r && trimmed) r.name = trimmed
  }

  const removeRoster = (id) => {
    if (isAnimating.value || rosters.value.length <= 1) return
    const idx = rosters.value.findIndex(r => r.id === id)
    if (idx === -1) return
    const wasActive = id === activeRosterId.value
    rosters.value.splice(idx, 1)
    if (wasActive) openRoster(rosters.value[Math.min(idx, rosters.value.length - 1)])
  }

  // --- 저장된 배치 ---
  const snapshotOfNow = (name) => ({
    name,
    rosterName: rosters.value.find(r => r.id === activeRosterId.value)?.name || '',
    gridConfig: { rows: gridConfig.rows, cols: gridConfig.cols },
    students: JSON.parse(JSON.stringify(students.value)),
    seats: JSON.parse(JSON.stringify(seats.value))
  })

  const defaultSnapshotName = () => {
    const r = rosters.value.find(x => x.id === activeRosterId.value)
    const d = new Date()
    return `${r?.name || '배치'} · ${d.getMonth() + 1}월 ${d.getDate()}일`
  }

  const apply = (res) => {
    if (res.ok) { snapshots.value = res.snapshots; saveError.value = null; return true }
    saveError.value = res.reason === 'quota'
      ? '저장 공간이 가득 찼습니다. 오래된 배치를 지우거나 파일로 내보낸 뒤 다시 시도하세요.'
      : '저장하지 못했습니다.'
    return false
  }

  const saveSnapshot = (name) => apply(store.addSnapshot(snapshotOfNow((name || '').trim() || defaultSnapshotName())))
  const deleteSnapshot = (id) => apply(store.removeSnapshot(id))
  const renameSnapshot = (id, name) => apply(store.renameSnapshot(id, name))

  // 배치를 되돌린다. 지금 명단을 덮어쓰거나, 새 명단으로 들여온다.
  const restoreSnapshot = (id, { asNew = false } = {}) => {
    const snap = snapshots.value.find(s => s.id === id)
    if (!snap || isAnimating.value) return false

    const payload = {
      gridConfig: { ...(snap.gridConfig || { rows: 6, cols: 6 }) },
      students: JSON.parse(JSON.stringify(snap.students || [])),
      seats: JSON.parse(JSON.stringify(snap.seats || []))
    }
    // 좌석과 학생의 배정 표시가 어긋나 있을 수 있으니 좌석을 기준으로 다시 맞춘다
    const seated = new Set(payload.seats.filter(s => s.status === 'occupied').map(s => s.studentId))
    payload.students.forEach(st => { st.isAssigned = seated.has(st.id) })

    if (asNew) {
      stash()
      const r = blankRoster(snap.name)
      Object.assign(r, payload)
      rosters.value.push(r)
      openRoster(r)
    } else {
      const cur = rosters.value.find(r => r.id === activeRosterId.value)
      if (!cur) return false
      Object.assign(cur, payload)
      openRoster(cur)
    }
    return true
  }

  // --- 파일로 주고받기 ---
  const exportFile = ({ withRosters = true, snapshotId = null } = {}) => {
    stash()
    const picked = snapshotId ? snapshots.value.filter(s => s.id === snapshotId) : snapshots.value
    const doc = store.buildExport({
      rosters: withRosters ? JSON.parse(JSON.stringify(rosters.value)) : [],
      snapshots: JSON.parse(JSON.stringify(picked))
    })
    store.downloadJson(doc, `교실좌석배치-${store.fileStamp()}.json`)
  }

  const importFile = (text) => {
    const res = store.parseImport(text)
    if (!res.ok) {
      saveError.value = res.reason === 'kind'
        ? '이 앱에서 내보낸 파일이 아닙니다.'
        : '파일을 읽지 못했습니다.'
      return false
    }
    if (res.snapshots.length) {
      apply(store.putSnapshots([
        ...res.snapshots.map(s => ({ ...s, id: newId('snap') })),
        ...snapshots.value
      ]))
    }
    if (res.rosters.length) {
      stash()
      const added = res.rosters.map(r => ({ ...r, id: newId('roster') }))
      rosters.value.push(...added)
      openRoster(added[0])
    }
    saveError.value = null
    return true
  }

  const setTheme = (id) => {
    themeId.value = applyTheme(id).id
  }

  const getStudentName = (id) => students.value.find(s => s.id === id)?.name || ''

  onMounted(async () => { loadData(); await openSharedLink() })

  // 저장할 때 rosters를 건드리면 watcher가 다시 돌므로, 쓰기용 사본만 만든다
  watch([rosters, activeRosterId, students, seats, gridConfig, themeId], () => {
    if (!activeRosterId.value) return
    localStorage.setItem(STORE_KEY, JSON.stringify({
      version: 2,
      theme: themeId.value,
      activeId: activeRosterId.value,
      rosters: rosters.value.map(r => r.id === activeRosterId.value
        ? {
            id: r.id, name: r.name,
            gridConfig: { rows: gridConfig.rows, cols: gridConfig.cols },
            students: students.value,
            seats: seats.value
          }
        : r)
    }))
  }, { deep: true })

  return reactive({
    gridConfig, students, seats, isEditMode, isRestrictionMode, isAnimating,
    highlightedSeatId, selectedStudent, countdownValue,
    isSwapMode, swapSourceId, spin, lastAssignedSeatId,
    placingStudentId, pendingSeatId, lineSwapFrom,
    lineSeats, lineInfo, setLineForbidden, clearLineAssignments,
    startLineSwap, executeLineSwap, shiftLine, canShiftLine,
    toggleSeatForbidden, startPlacing, startPickingFor, cancelPending, releaseStudent,
    rosters, activeRosterId, themeId,
    snapshots, saveError, defaultSnapshotName,
    saveSnapshot, deleteSnapshot, renameSnapshot, restoreSnapshot,
    exportFile, importFile, openSharedLink,
    switchRoster, addRoster, duplicateRoster, renameRoster, removeRoster, setTheme,
    activeRoster: computed(() => rosters.value.find(r => r.id === activeRosterId.value) || null),
    initGrid, clearAllAssignments, cancelAssignment, startSwap, executeSwap,
    clearAllRestrictions, clearStudentRestrictions, restrictionCount,
    getStudentName,
    getSeatCode: (id) => {
      const parts = id.split('-')
      return `${String.fromCharCode(65 + parseInt(parts[2]))}${parseInt(parts[1]) + 1}`
    },
    getStudentSeatCode: (studentId) => {
      const seat = seats.value.find(s => s.studentId === studentId)
      return seat ? `${String.fromCharCode(65 + seat.col)}${seat.row + 1}` : ''
    },
    toggleRestriction: (student, seatId) => {
      const idx = student.deniedSeatIds.indexOf(seatId)
      if (idx > -1) student.deniedSeatIds.splice(idx, 1)
      else student.deniedSeatIds.push(seatId)
    },
    toggleBatchRestriction: (type, index) => {
      if (!selectedStudent.value) return
      const targetSeats = seats.value.filter(s => type === 'row' ? s.row === index : s.col === index)
      const allDenied = targetSeats.every(s => selectedStudent.value.deniedSeatIds.includes(s.id))
      targetSeats.forEach(s => {
        const idx = selectedStudent.value.deniedSeatIds.indexOf(s.id)
        if (allDenied) { if (idx > -1) selectedStudent.value.deniedSeatIds.splice(idx, 1) }
        else { if (idx === -1) selectedStudent.value.deniedSeatIds.push(s.id) }
      })
    },
    getStudentSeatId: (studentId) => seats.value.find(s => s.studentId === studentId)?.id || null,
    placeStudentAt: (student, seatId) => {
      const seat = seats.value.find(s => s.id === seatId)
      if (!seat || seat.status !== 'available' || student.deniedSeatIds.includes(seat.id)) return false
      releaseStudent(student.id)
      seat.studentId = student.id
      seat.status = 'occupied'
      student.isAssigned = true
      selectedStudent.value = null
      placingStudentId.value = null
      pendingSeatId.value = null
      return true
    },
    assignManual: (student, seat) => {
      if (seat.status !== 'available' || student.deniedSeatIds.includes(seat.id)) return
      releaseStudent(student.id)
      seat.studentId = student.id
      seat.status = 'occupied'
      student.isAssigned = true
      selectedStudent.value = null
    },
    assignBySpin: async (student) => {
      if (isAnimating.value) return

      // 후보는 '이 학생이 앉을 수 있는 빈 자리'뿐이다.
      // 목록 길이로 순환시키므로 몇 칸이 나오든 항상 유효한 자리에 착지한다.
      const free = seats.value.filter(
        s => s.status === 'available' && !student.deniedSeatIds.includes(s.id)
      )
      if (free.length === 0) return

      isAnimating.value = true

      // --- 오버레이 연출 ---
      Object.assign(spin, {
        active: true, phase: 'intro', studentName: student.name,
        n: null, slots: Array.from({ length: free.length }, (_, i) => i + 1),
        d1: null, d2: null, d2Slots: DIR_FACES
      })
      await wait(600)

      spin.phase = 'r1'
      spin.n = 1 + Math.floor(Math.random() * free.length)
      await wait(2200)

      spin.phase = 'r2'
      spin.d1 = pick(DIR_FACES)
      await wait(2200)

      spin.phase = 'r3'
      spin.d2Slots = crossFaces(spin.d1)   // 앞 방향과 수직인 두 갈래만 남는다
      await wait(250)
      spin.d2 = pick(spin.d2Slots)
      await wait(2200)

      spin.phase = 'result'
      await wait(1500)

      spin.active = false
      spin.phase = 'idle'
      await wait(400)

      // --- 격자 위 이동 ---
      // 주사위가 정한 순서대로 후보를 줄 세운다
      const orderOf = orderKeyFactory(spin.d1, spin.d2, gridConfig.rows, gridConfig.cols)
      const candidates = [...free].sort((a, b) => orderOf(a) - orderOf(b))
      const N = candidates.length

      // 출발점은 직전 학생 자리 바로 다음 후보. 첫 학생은 맨 앞부터.
      const prev = lastAssignedSeatId.value
        ? seats.value.find(s => s.id === lastAssignedSeatId.value)
        : null
      const prevOrder = prev ? orderOf(prev) : -1
      let startIdx = candidates.findIndex(s => orderOf(s) > prevOrder)
      if (startIdx === -1) startIdx = 0

      // 출발 칸에 전체 칸수를 띄우고 그만큼 이동한다 → 도착 칸에는 0이 뜬다.
      const steps = spin.n
      const dir = 1
      const seatAt = (k) => candidates[(((startIdx + dir * k) % N) + N) % N]
      const targetIdx = (((startIdx + dir * steps) % N) + N) % N

      if (N === 1) {
        // 남은 자리가 하나뿐이면 같은 칸을 수십 번 깜빡일 이유가 없다
        highlightedSeatId.value = candidates[0].id
        countdownValue.value = null
        await wait(900)
      } else {
        const delays = buildHopDelays(steps + 1)
        for (let k = 0; k <= steps; k++) {
          highlightedSeatId.value = seatAt(k).id
          countdownValue.value = steps - k
          await wait(delays[k])
        }
        await wait(400)          // 도착 칸의 '0'을 잠깐 더 보여준다
        countdownValue.value = null
        await wait(450)
      }

      const seatObj = seats.value.find(s => s.id === candidates[targetIdx].id)
      releaseStudent(student.id)
      seatObj.studentId = student.id
      seatObj.status = 'occupied'
      student.isAssigned = true
      lastAssignedSeatId.value = seatObj.id

      highlightedSeatId.value = null
      isAnimating.value = false
      selectedStudent.value = null
    },
    importStudents: (text) => {
      const names = text.split(/[\n\r\t,;]+/).map(n => n.trim()).filter(Boolean)
      students.value = names.map((name, idx) => ({ id: `std-${Date.now()}-${idx}`, name, isAssigned: false, deniedSeatIds: [] }))
    }
  })
}