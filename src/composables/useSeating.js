import { ref, reactive, computed, watch, onMounted } from 'vue'
import { applyTheme, DEFAULT_THEME, getTheme } from '@/lib/themes'

const STORE_KEY = 'seats-data'
const newId = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const blankRoster = (name) => ({
  id: newId('roster'), name,
  gridConfig: { rows: 6, cols: 6 },
  students: [],
  seats: []
})

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// 주사위 6면: +, -, × 2면씩.
// 빼기가 나오면 값이 음수가 될 수 있고, 그때는 뒤쪽으로 이동한다.
const DICE_FACES = ['+', '-', '×', '+', '-', '×']

const applyOp = (a, op, b) => (op === '+' ? a + b : op === '-' ? a - b : a * b)

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

  // 룰렛/주사위 연출 상태 (직전 학생 자리가 다음 학생의 출발점이 된다)
  const lastAssignedSeatId = ref(null)
  const spin = reactive({
    active: false,
    phase: 'idle',   // intro | roulette1 | dice | roulette2 | formula
    studentName: '',
    a: null, op: null, b: null, value: null
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

  const setTheme = (id) => {
    themeId.value = applyTheme(id).id
  }

  const getStudentName = (id) => students.value.find(s => s.id === id)?.name || ''

  onMounted(loadData)

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
    rosters, activeRosterId, themeId,
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
    assignManual: (student, seat) => {
      if (seat.status !== 'available' || student.deniedSeatIds.includes(seat.id)) return
      seat.studentId = student.id
      seat.status = 'occupied'
      student.isAssigned = true
      selectedStudent.value = null
    },
    assignBySpin: async (student) => {
      if (isAnimating.value) return

      // 이동은 '이 학생이 앉을 수 있는 빈 자리' 위에서만 센다.
      // 목록 길이로 순환시키므로 몇 칸이 나오든 항상 유효한 자리에 착지한다.
      const orderOf = (s) => s.row * gridConfig.cols + s.col
      const candidates = seats.value
        .filter(s => s.status === 'available' && !student.deniedSeatIds.includes(s.id))
        .sort((a, b) => orderOf(a) - orderOf(b))
      if (candidates.length === 0) return

      isAnimating.value = true
      const N = candidates.length

      // --- 오버레이 연출 ---
      Object.assign(spin, {
        active: true, phase: 'intro', studentName: student.name,
        a: null, op: null, b: null, value: null
      })
      await wait(600)

      spin.phase = 'roulette1'
      spin.a = roll9()
      await wait(2100)

      spin.phase = 'dice'
      await wait(350)
      spin.op = DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)]
      await wait(3350)   // 슬롯 회전 + 넘어갈 듯 말 듯 멈칫거리는 시간

      spin.phase = 'roulette2'
      spin.b = roll9()
      await wait(2100)

      spin.phase = 'formula'
      spin.value = applyOp(spin.a, spin.op, spin.b)
      await wait(1800)

      spin.active = false
      spin.phase = 'idle'
      await wait(400)

      // --- 격자 위 이동 ---
      // 출발점은 직전 학생 자리 바로 다음 후보. 첫 학생은 A1부터.
      const prev = lastAssignedSeatId.value
        ? seats.value.find(s => s.id === lastAssignedSeatId.value)
        : null
      const prevOrder = prev ? orderOf(prev) : -1
      let startIdx = candidates.findIndex(s => orderOf(s) > prevOrder)
      if (startIdx === -1) startIdx = 0

      // 출발 칸에 전체 칸수를 띄우고 그만큼 이동한다 → 도착 칸에는 0이 뜬다.
      // 값이 음수면 뒤쪽으로, 0이면 출발 칸이 그대로 도착 칸이 된다.
      const steps = Math.abs(spin.value)
      const dir = spin.value < 0 ? -1 : 1
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