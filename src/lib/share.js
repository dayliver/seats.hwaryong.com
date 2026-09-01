// 배치를 링크 하나로 주고받기.
//
// 저장 형식을 그대로 담으면 30명 기준 4.9KB → 압축해도 1,052자라 QR에 넣기 버겁다.
// 그래서 공유용으로만 쓰는 최소 형식을 따로 만들었다. 같은 학급이 390B → 394자가 되어
// 링크 전체가 424자로 떨어지고, QR·카카오톡·이메일 어디에도 들어간다.
//
//   1|행|열|명단이름|이름,이름,...|좌석.좌석.좌석...
//
// 좌석 한 칸은 '-'(빈자리) 'x'(없는 자리) 또는 36진수 학생 번호.

const VERSION = '1'
const SEP = '|'

const b64u = {
  encode: (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  decode: (str) => {
    const s = str.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(s + '='.repeat((4 - s.length % 4) % 4))
    return Uint8Array.from(bin, c => c.charCodeAt(0))
  }
}

const squeeze = async (bytes, mode) => {
  const stream = mode === 'deflate' ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw')
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}

export function toCompact(roster) {
  const { rows, cols } = roster.gridConfig
  const students = roster.students || []
  const index = new Map(students.map((s, i) => [s.id, i]))

  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seat = (roster.seats || []).find(s => s.row === r && s.col === c)
      if (!seat || seat.status === 'forbidden') cells.push('x')
      else if (seat.status === 'occupied' && index.has(seat.studentId)) cells.push(index.get(seat.studentId).toString(36))
      else cells.push('-')
    }
  }

  // 이름에 쓰인 구분자는 비운다 (되돌릴 때 어긋나지 않도록)
  const safe = (t) => String(t || '').replace(/[|,.]/g, ' ').trim()
  return [VERSION, rows, cols, safe(roster.name), students.map(s => safe(s.name)).join(','), cells.join('.')].join(SEP)
}

export function fromCompact(text) {
  const parts = text.split(SEP)
  if (parts[0] !== VERSION || parts.length < 6) return null
  const [, r, c, name, nameList, cellList] = parts
  const rows = Number(r), cols = Number(c)
  if (!(rows > 0 && cols > 0 && rows <= 30 && cols <= 30)) return null

  const names = nameList ? nameList.split(',') : []
  const students = names.map((n, i) => ({
    id: `std-${Date.now().toString(36)}-${i}`, name: n, isAssigned: false, deniedSeatIds: []
  }))

  const cells = cellList ? cellList.split('.') : []
  const seats = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const token = cells[row * cols + col] ?? '-'
      const seat = { id: `seat-${row}-${col}`, row, col, status: 'available', studentId: null }
      if (token === 'x') seat.status = 'forbidden'
      else if (token !== '-') {
        const st = students[parseInt(token, 36)]
        if (st) { seat.status = 'occupied'; seat.studentId = st.id; st.isAssigned = true }
      }
      seats.push(seat)
    }
  }
  return { name: name || '가져온 배치', gridConfig: { rows, cols }, students, seats }
}

export async function makeShareLink(roster, origin = location.origin) {
  const text = toCompact(roster)
  const bytes = new TextEncoder().encode(text)
  const packed = await squeeze(bytes, 'deflate')
  return `${origin}/#s=${b64u.encode(packed)}`
}

// 주소의 #s= 를 읽어 배치로 되돌린다
export async function readShareLink(hash = location.hash) {
  const m = /[#&]s=([A-Za-z0-9\-_]+)/.exec(hash || '')
  if (!m) return null
  try {
    const bytes = await squeeze(b64u.decode(m[1]), 'inflate')
    return fromCompact(new TextDecoder().decode(bytes))
  } catch (e) {
    return null
  }
}

export const clearShareHash = () => {
  history.replaceState(null, '', location.pathname + location.search)
}

export function mailtoLink(rosterName, url) {
  const subject = `자리 배치 — ${rosterName}`
  const body = [
    `${rosterName} 자리 배치입니다.`,
    '',
    '아래 링크를 열면 그대로 보입니다.',
    url,
    '',
    '— 교실 좌석 배치 (seats.hwaryong.com)'
  ].join('\n')
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
