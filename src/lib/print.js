// 인쇄용 새 창을 열어 좌석표를 그린다. 실제 인쇄는 사용자가 Ctrl+P로 수행.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
))

// 좌석 한 칸
function renderCell(seating, r, c) {
  const seat = seating.seats.find((s) => s.row === r && s.col === c)

  // 책상이 없는 자리는 아예 비워 둔다 (교실 모양이 그대로 드러나도록)
  if (!seat || seat.status === 'forbidden') return '<div class="cell void"></div>'

  if (seat.status === 'occupied') {
    return `<div class="cell taken">${esc(seating.getStudentName(seat.studentId))}</div>`
  }
  return '<div class="cell empty"></div>'
}

// flipped=true 이면 행/열을 모두 역순으로 (교사 시점 ↔ 학생 시점은 180° 회전)
function renderGrid(seating, flipped) {
  const { rows, cols } = seating.gridConfig
  const rowIdx = Array.from({ length: rows }, (_, i) => (flipped ? rows - 1 - i : i))
  const colIdx = Array.from({ length: cols }, (_, i) => (flipped ? cols - 1 - i : i))

  const cells = rowIdx
    .map((r) => colIdx.map((c) => renderCell(seating, r, c)).join(''))
    .join('')

  return `<div class="grid">${cells}</div>`
}

export function openPrintView(seating) {
  const { rows, cols } = seating.gridConfig

  // 화면에 적용된 테마 색을 그대로 가져다 쓴다
  const css = getComputedStyle(document.documentElement)
  const v = (name, fallback) => (css.getPropertyValue(name).trim() || fallback)
  const C = {
    primary: v('--c-primary', '#f40752'),
    primaryDeep: v('--c-primary-deep', '#c40340'),
    accentSoft: v('--c-accent-soft', '#ffe9e0'),
    ink: v('--c-ink', '#452722'),
    muted: v('--c-muted', '#c0a79d'),
    line: v('--c-line', '#f1e1d8')
  }

  // A4 세로 한 장에 배치도 2개가 들어가도록 칸 크기를 행 수에 맞춰 조절
  const gap = 2
  const cellH = Math.max(10, Math.min(18, (101 - (rows - 1) * gap) / rows))
  const nameSize = cellH >= 15 ? 12.5 : cellH >= 12 ? 11 : 9.5

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>자리 배치도</title>
<style>
  @font-face {
    font-family: 'A2Z';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2601-6@1.0/%EC%97%90%EC%9D%B4%ED%88%AC%EC%A7%80%EC%B2%B4-4Regular.woff2') format('woff2');
    font-weight: 400;
  }
  @font-face {
    font-family: 'A2Z';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2601-6@1.0/%EC%97%90%EC%9D%B4%ED%88%AC%EC%A7%80%EC%B2%B4-7Bold.woff2') format('woff2');
    font-weight: 700;
  }
  @font-face {
    font-family: 'A2Z';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2601-6@1.0/%EC%97%90%EC%9D%B4%ED%88%AC%EC%A7%80%EC%B2%B4-9Black.woff2') format('woff2');
    font-weight: 900;
  }

  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'A2Z', "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
    color: ${C.ink};
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet { width: 186mm; margin: 0 auto; padding: 6mm 0; }

  .hint {
    margin: 0 0 6mm;
    padding: 3mm 4mm;
    border-radius: 3mm;
    background: ${C.accentSoft};
    color: ${C.primaryDeep};
    font-size: 10pt;
    font-weight: 700;
  }

  h1 { margin: 0; font-size: 16pt; font-weight: 900; letter-spacing: -0.02em; }
  h1 span { color: ${C.primary}; }
  .date { margin: 1.5mm 0 7mm; font-size: 8.5pt; color: ${C.muted}; font-weight: 700; }

  section + section { margin-top: 9mm; }
  h2 {
    margin: 0 0 3mm;
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: #94a3b8;
    text-transform: uppercase;
  }

  .podium {
    width: 56mm;
    margin: 4mm auto;
    border-radius: 999px;
    background: ${C.primary};
    color: #fff;
    text-align: center;
    font-size: 9.5pt;
    font-weight: 700;
    letter-spacing: 0.5em;
    text-indent: 0.5em;
    padding: 2mm 0;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(${cols}, 1fr);
    gap: ${gap}mm;
  }
  .cell {
    height: ${cellH.toFixed(1)}mm;
    border-radius: 2.5mm;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0 1mm;
    word-break: keep-all;
    line-height: 1.15;
  }
  .cell.taken {
    border: 1.1pt solid ${C.ink};
    font-size: ${nameSize}pt;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .cell.empty { border: 0.8pt dashed ${C.line}; }
  .cell.void { border: none; }

  @media print { .hint { display: none; } .sheet { padding: 0; } }
</style>
</head>
<body>
  <div class="sheet">
    <p class="hint">Ctrl + P (Mac은 ⌘ + P) 를 눌러 인쇄하세요. 이 안내문은 인쇄되지 않습니다.</p>

    <h1>${esc(seating.activeRoster?.name || '')} 자리 <span>배치도</span></h1>
    <p class="date">${esc(today)}</p>

    <section>
      <h2>교사 시점</h2>
      ${renderGrid(seating, false)}
      <div class="podium">교탁</div>
    </section>

    <section>
      <h2>학생 시점</h2>
      <div class="podium">교탁</div>
      ${renderGrid(seating, true)}
    </section>
  </div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert('팝업이 차단되었습니다. 이 사이트의 팝업을 허용한 뒤 다시 시도해 주세요.')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
}
