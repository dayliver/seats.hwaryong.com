// 룰렛 '방향' — 격자를 지그재그로 훑는 스네이크 경로 8종.
//
// 이름은 숫자패드(7 8 9 / 4 5 6 / 1 2 3) 위에서 3×3 격자를 지나는 순서다.
// 예) 136479 = 1→3, 6→4, 7→9 : 왼쪽 아래에서 오른쪽으로 출발해 한 줄씩 위로.
//
// 이동 순서(snakeCells)와 룰렛 아이콘(snakeIcon)이 같은 함수에서 나오므로
// 아이콘이 그리는 길과 실제로 움직이는 길이 어긋날 수 없다.

const SNAKES = {
  136479: { axis: 'row', v: 'bottom', h: 'left' },
  796413: { axis: 'row', v: 'top', h: 'left' },
  314697: { axis: 'row', v: 'bottom', h: 'right' },
  974631: { axis: 'row', v: 'top', h: 'right' },
  178239: { axis: 'col', v: 'bottom', h: 'left' },
  712893: { axis: 'col', v: 'top', h: 'left' },
  398217: { axis: 'col', v: 'bottom', h: 'right' },
  932871: { axis: 'col', v: 'top', h: 'right' }
}

export const SNAKE_IDS = Object.keys(SNAKES)
export const isSnake = (id) => id != null && Object.hasOwn(SNAKES, id)

const range = (n, reversed) => Array.from({ length: n }, (_, i) => (reversed ? n - 1 - i : i))

// 경로 순서대로 늘어놓은 칸 목록. 출발 모서리(v, h)에서 axis 방향으로 첫 줄을 가고,
// 줄이 끝나면 옆 줄로 넘어가 반대로 돌아온다.
export function snakeCells(id, rows, cols) {
  const s = SNAKES[id] || SNAKES[SNAKE_IDS[0]]
  const rowSeq = range(rows, s.v === 'bottom')
  const colSeq = range(cols, s.h === 'right')
  const out = []

  if (s.axis === 'row') {
    rowSeq.forEach((r, i) => {
      const line = colSeq.map(c => ({ row: r, col: c }))
      out.push(...(i % 2 ? line.reverse() : line))
    })
  } else {
    colSeq.forEach((c, i) => {
      const line = rowSeq.map(r => ({ row: r, col: c }))
      out.push(...(i % 2 ? line.reverse() : line))
    })
  }
  return out
}

// 좌석 → 경로상의 순번
export function snakeOrderKey(id, rows, cols) {
  const map = new Map(snakeCells(id, rows, cols).map((s, i) => [`${s.row}-${s.col}`, i]))
  return (seat) => map.get(`${seat.row}-${seat.col}`) ?? Number.MAX_SAFE_INTEGER
}

// 아이콘 도형. 줄 수의 홀짝이 실제 격자와 같아야 도착 모서리와 마지막 진행 방향이 맞으므로
// 홀수면 3줄, 짝수면 4줄로 그린다 (1~2줄짜리 격자는 그 수 그대로).
// 줄 간격은 항상 6이고, 4줄이면 그림판(viewBox)이 24 → 30으로 커진다.
export function snakeIcon(id, rows, cols) {
  const s = SNAKES[id] || SNAKES[SNAKE_IDS[0]]
  const isRow = s.axis === 'row'
  const count = isRow ? rows : cols
  const n = count <= 1 ? 1 : Math.min(count, count % 2 ? 3 : 4)

  const size = Math.max(24, 12 + 6 * (n - 1))
  const off = (size - 6 * (n - 1)) / 2
  const ai = isRow ? 0 : 1          // 줄과 나란한 축이 x(0)인지 y(1)인지

  const pts = snakeCells(id, isRow ? n : 2, isRow ? 2 : n).map(({ row, col }) => {
    const along = (isRow ? col : row) ? size - 4 : 4
    const cross = off + 6 * (isRow ? row : col)
    return isRow ? [along, cross] : [cross, along]
  })

  const last = pts[pts.length - 1]
  const prev = pts[pts.length - 2]
  const d = [Math.sign(last[0] - prev[0]), Math.sign(last[1] - prev[1])]
  const move = (p, k) => [p[0] + d[0] * k, p[1] + d[1] * k]

  // 화살촉 쪽 꺾임은 안으로 당겨 화살촉과 붙지 않게 한다
  const edge = last[ai]
  const line = pts.map((p, i) => {
    if (i === pts.length - 1) return move(p, -4)
    return p[ai] === edge ? move(p, -5) : p
  })

  const base = move(last, -4.5)
  const tip = move(last, 1)
  const wing = (k) => [base[0] - d[1] * k, base[1] + d[0] * k]

  return {
    size,
    strokeWidth: (2 * size) / 24,
    path: 'M' + line.map(p => p.join(' ')).join(' L'),
    head: [tip, wing(3.5), wing(-3.5)].map(p => p.join(' ')).join(' ')
  }
}
