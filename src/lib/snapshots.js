// 이름 붙여 굳혀 둔 자리 배치.
//
// 평소 작업 내용은 useSeating이 'seats-data'에 계속 자동 저장한다.
// 여기 저장소는 그것과 별개로, 사용자가 직접 "이 배치를 남겨두자"고 정한 순간만 담는다.
// 키를 나눠 두어 한쪽이 망가져도 다른 쪽은 살아남는다.
//
// 한 스냅샷이 학생 40명 + 좌석 36칸 기준 약 7KB라 localStorage 5MB면 수백 개가 들어간다.
// IndexedDB는 이 크기에서 얻을 게 없어 쓰지 않았다.

const KEY = 'seats-snapshots'
const FILE_KIND = 'seats-export'

const newId = () => `snap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export function listSnapshots() {
  try {
    const doc = JSON.parse(localStorage.getItem(KEY) || 'null')
    return Array.isArray(doc?.snapshots) ? doc.snapshots : []
  } catch (e) {
    return []
  }
}

function writeAll(snapshots) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, snapshots }))
    return { ok: true }
  } catch (e) {
    // 저장 공간이 찼을 때 조용히 실패하면 사용자가 저장된 줄 안다
    return { ok: false, reason: e?.name === 'QuotaExceededError' ? 'quota' : 'unknown' }
  }
}

export function addSnapshot(snap) {
  const item = { ...snap, id: newId(), savedAt: new Date().toISOString() }
  const next = [item, ...listSnapshots()]
  const res = writeAll(next)
  return res.ok ? { ok: true, snapshots: next, id: item.id } : res
}

export function removeSnapshot(id) {
  const next = listSnapshots().filter(s => s.id !== id)
  return writeAll(next).ok ? { ok: true, snapshots: next } : { ok: false }
}

export function renameSnapshot(id, name) {
  const trimmed = (name || '').trim()
  if (!trimmed) return { ok: false }
  const next = listSnapshots().map(s => (s.id === id ? { ...s, name: trimmed } : s))
  return writeAll(next).ok ? { ok: true, snapshots: next } : { ok: false }
}

export function putSnapshots(snapshots) {
  return writeAll(snapshots).ok ? { ok: true, snapshots } : { ok: false }
}

// --- 파일로 주고받기 ---
// localStorage는 "인터넷 사용 기록 삭제" 한 번이면 사라진다. 파일이 진짜 안전장치다.

export function buildExport({ rosters = [], snapshots = [] } = {}) {
  return {
    app: 'seats.hwaryong.com',
    kind: FILE_KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    rosters,
    snapshots
  }
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 넉넉히 기다렸다 해제한다 (즉시 풀면 일부 브라우저에서 저장이 취소된다)
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function parseImport(text) {
  let doc
  try { doc = JSON.parse(text) } catch (e) { return { ok: false, reason: 'json' } }
  if (doc?.kind !== FILE_KIND) return { ok: false, reason: 'kind' }
  return {
    ok: true,
    rosters: Array.isArray(doc.rosters) ? doc.rosters : [],
    snapshots: Array.isArray(doc.snapshots) ? doc.snapshots : []
  }
}

export const fileStamp = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
