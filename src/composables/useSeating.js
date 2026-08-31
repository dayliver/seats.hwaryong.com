import { ref, reactive, computed, watch, onMounted } from 'vue'

function shuffleIndices(length) {
  const order = Array.from({ length }, (_, i) => i)
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

function buildShuffledPath(finalIndex, length) {
  if (length === 1) return [{ index: 0, delay: 400, countdown: 1 }]

  const order = shuffleIndices(length)
  const finalPos = order.indexOf(finalIndex)
  const minSteps = 20
  const maxSteps = 45

  let loops = Math.max(0, Math.round((minSteps - finalPos - 1) / length))
  let totalSteps = loops * length + finalPos + 1
  while (totalSteps < minSteps) {
    loops++
    totalSteps = loops * length + finalPos + 1
  }
  while (totalSteps > maxSteps && loops > 0) {
    loops--
    totalSteps = loops * length + finalPos + 1
  }

  const decelExp = 2 + Math.random() * 1.5
  const path = []
  for (let step = 0; step < totalSteps; step++) {
    const progress = step / (totalSteps - 1)
    path.push({
      index: order[step % length],
      delay: 30 + Math.pow(progress, decelExp) * (600 + Math.random() * 200),
      countdown: totalSteps - step,
    })
  }
  return path
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

  const loadData = () => {
    const saved = localStorage.getItem('seats-data')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        Object.assign(gridConfig, parsed.gridConfig)
        students.value = (parsed.students || []).map(s => ({ 
          ...s, 
          deniedSeatIds: s.deniedSeatIds || [] 
        }))
        seats.value = parsed.seats || []
      } catch (e) { initGrid() }
    } else { initGrid() }
  }

  const getStudentName = (id) => students.value.find(s => s.id === id)?.name || ''

  onMounted(loadData)
  watch([students, seats, gridConfig], () => {
    localStorage.setItem('seats-data', JSON.stringify({
      gridConfig, students: students.value, seats: seats.value
    }))
  }, { deep: true })

  return reactive({
    gridConfig, students, seats, isEditMode, isRestrictionMode, isAnimating,
    highlightedSeatId, selectedStudent, countdownValue,
    isSwapMode, swapSourceId,
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
    assignRandom: async (student) => {
      const available = seats.value
        .filter(s => s.status === 'available' && !student.deniedSeatIds.includes(s.id))
        .sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col)
      if (available.length === 0 || isAnimating.value) return
      isAnimating.value = true

      const finalIndex = Math.floor(Math.random() * available.length)
      const path = buildShuffledPath(finalIndex, available.length)

      for (const step of path) {
        countdownValue.value = step.countdown
        highlightedSeatId.value = available[step.index].id
        await new Promise(r => setTimeout(r, step.delay))
      }

      countdownValue.value = null
      await new Promise(r => setTimeout(r, 400))

      const finalSeat = available[finalIndex]
      const seatObj = seats.value.find(s => s.id === finalSeat.id)
      seatObj.studentId = student.id
      seatObj.status = 'occupied'
      student.isAssigned = true
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