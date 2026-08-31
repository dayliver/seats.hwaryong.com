// 테마 팔레트. 여기가 색의 단일 출처이고, CSS 변수로 주입해 화면과 인쇄가 같은 색을 쓴다.
//
// primary  : 주 강조 (버튼, 강조 글자) — 흰 글자를 얹으므로 대비 3:1 이상으로 고른다
// accent   : 그라데이션의 두 번째 색 (primary보다 밝고 부드러운 톤)
// strong   : 배정된 좌석처럼 넓게 칠하는 어두운 면 (ink보다 한 단계 밝게)
// bg       : 화면(캔버스) 바탕
// shell    : 캔버스 바깥 레터박스 — bg보다 한 단계 진하게 두어 화면 경계가 보이게 한다

export const THEMES = [
  {
    id: 'choco', label: '초코',
    primary: '#f40752', primaryDeep: '#c40340', primarySoft: '#ff5c86',
    accent: '#f9ab8f', accentSoft: '#ffe9e0',
    ink: '#452722', strong: '#5a332c', inkSoft: '#8c655a',
    muted: '#c0a79d', line: '#f1e1d8', bg: '#fdf5f2', shell: '#e8d5cd'
  },
  {
    id: 'lime', label: '연두',
    primary: '#4f9e12', primaryDeep: '#3c7c0a', primarySoft: '#7cc63c',
    accent: '#c6e86b', accentSoft: '#eef8d8',
    ink: '#2c3a1c', strong: '#3d5026', inkSoft: '#697a52',
    muted: '#aab894', line: '#e6efd6', bg: '#f8fcf0', shell: '#dbe7c6'
  },
  {
    id: 'orange', label: '주황',
    primary: '#e05f00', primaryDeep: '#b34a00', primarySoft: '#ff8c33',
    accent: '#ffc48a', accentSoft: '#ffeeda',
    ink: '#452c19', strong: '#5c3c20', inkSoft: '#8d6a49',
    muted: '#c6ab90', line: '#f4e6d5', bg: '#fdf8f1', shell: '#eddac2'
  },
  {
    id: 'sky', label: '하늘',
    primary: '#0a86d8', primaryDeep: '#0067ad', primarySoft: '#3fabee',
    accent: '#8fd6f9', accentSoft: '#ddf1fd',
    ink: '#1d3244', strong: '#2b4459', inkSoft: '#587287',
    muted: '#9db4c4', line: '#dbe9f2', bg: '#f2f9fe', shell: '#c9dcea'
  },
  {
    id: 'mint', label: '민트',
    primary: '#0e9d89', primaryDeep: '#0b7d6d', primarySoft: '#3fc7b3',
    accent: '#93e2d2', accentSoft: '#dcf6ef',
    ink: '#1d3a35', strong: '#2b524c', inkSoft: '#5a7d76',
    muted: '#9dbdb6', line: '#d9f0ea', bg: '#f1fbf8', shell: '#c7e7de'
  }
]

export const DEFAULT_THEME = 'choco'

export const getTheme = (id) => THEMES.find(t => t.id === id) || THEMES[0]

const rgb = (hex) => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ')
}

// 팔레트를 :root의 CSS 변수로 밀어 넣는다. 그림자 색은 팔레트에서 파생시킨다.
export function applyTheme(id) {
  const t = getTheme(id)
  const s = document.documentElement.style

  s.setProperty('--c-primary', t.primary)
  s.setProperty('--c-primary-deep', t.primaryDeep)
  s.setProperty('--c-primary-soft', t.primarySoft)
  s.setProperty('--c-accent', t.accent)
  s.setProperty('--c-accent-soft', t.accentSoft)
  s.setProperty('--c-ink', t.ink)
  s.setProperty('--c-strong', t.strong)
  s.setProperty('--c-ink-soft', t.inkSoft)
  s.setProperty('--c-muted', t.muted)
  s.setProperty('--c-line', t.line)
  s.setProperty('--c-bg', t.bg)
  s.setProperty('--c-shell', t.shell)

  s.setProperty('--grad', `linear-gradient(135deg, ${t.primary} 0%, ${t.accent} 100%)`)
  s.setProperty('--shadow-sm', `0 2px 8px -2px rgba(${rgb(t.ink)}, 0.12)`)
  s.setProperty('--shadow-md', `0 12px 32px -12px rgba(${rgb(t.ink)}, 0.22)`)
  s.setProperty('--shadow-hot', `0 14px 34px -10px rgba(${rgb(t.primary)}, 0.52)`)
  s.setProperty('--overlay', `rgba(${rgb(t.strong)}, 0.94)`)

  document.documentElement.dataset.theme = t.id
  return t
}
