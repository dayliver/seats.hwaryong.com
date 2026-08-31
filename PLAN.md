# seats.hwaryong.com — 작업 계획

교실 자리 배치 앱. 1920×1080 캔버스를 `zoom`으로 화면에 맞춰 띄우는 프레젠테이션 방식.

## 다음 할 일

### 좌석 그리드를 쉽게 그리기

**문제.** 지금 `gridConfig.rows` / `cols`를 바꿀 방법이 UI에 없다. 값은
`useSeating.js`에 있고 `initGrid()`가 그 값으로 격자를 만들지만, 화면에서 행·열 수를
조절할 수 없어 6×6에 고정돼 있다. "구조 설정" 모드는 이미 만들어진 칸을 없애고
되살리는 것만 가능하다.

**넣을 곳은 두 군데.**

1. **설정 다이얼로그** (`SettingsDialog.vue`) — 테마·명단 옆에 "교실" 항목을 추가한다.
   - 행/열 수 조절 (스테퍼 또는 슬라이더)
   - 바꾼 결과를 작게 미리보기로 보여주기
   - 행·열을 줄이면 그 자리에 앉은 학생의 배정이 사라지므로 확인 절차 필요
   - `initGrid()`가 이미 사라진 좌석을 가리키는 금지 설정을 정리하고 있으니 그 경로를 탄다
   - 흔한 교실 모양(4×5, 5×6, 6×6, 3열 짝지어 앉기 등)을 프리셋 버튼으로 두면 대부분
     해결될 것 같다

2. **첫 사용자 튜토리얼** — 명단이 비어 있는 첫 실행에서 순서대로 안내한다.
   - ① 교실 크기 정하기 → ② 명단 붙여넣기 → ③ 학생 고르고 룰렛 돌리기
   - 지금은 빈 화면에 떨어지면 무엇부터 해야 할지 알기 어렵다
   - 명단이 하나도 없을 때만 뜨고, 완료하면 다시 안 뜨게 (localStorage에 표시)

## 남겨둔 것 (필요하면)

- **연출 건너뛰기.** 룰렛 12초 + 이동 최대 8.8초로 한 명당 약 20초. 30명이면 10분이다.
  클릭으로 남은 연출을 건너뛰는 장치가 있으면 좋겠다.
- **속도 조절.** 위 시간을 설정에서 조절할 수 있게.
- `src/components/HelloWorld.vue` 는 Vite 템플릿 잔재. 아무 데서도 안 쓴다.

## 현재 구조

```
src/
  composables/useSeating.js   상태와 규칙 전부 (명단·좌석·배정·룰렛·저장)
  lib/themes.js               테마 팔레트. 색의 단일 출처, CSS 변수로 주입
  lib/print.js                인쇄용 새 창 HTML 생성
  components/
    StudentPanel.vue          왼쪽 명단
    SeatGrid.vue              좌석 격자 + 헤더 + 햄버거 메뉴
    SettingsDialog.vue        테마 / 명단 관리
    SpinOverlay.vue           배정 연출 오버레이
    SpinWheel.vue             원형 룰렛 (숫자 1~9)
    SpinDice.vue              셈 기호 슬롯머신
```

### 저장 형식 (localStorage `seats-data`, version 2)

```jsonc
{
  "version": 2,
  "theme": "choco",
  "activeId": "roster-...",
  "rosters": [
    { "id": "...", "name": "우리 반",
      "gridConfig": { "rows": 6, "cols": 6 },
      "students": [{ "id", "name", "isAssigned", "deniedSeatIds": [] }],
      "seats":    [{ "id": "seat-r-c", "row", "col", "status", "studentId" }] }
  ]
}
```

`status` 는 `available` / `occupied` / `forbidden`.
version 1(명단 하나짜리 평면 구조)은 첫 실행 때 자동으로 명단 하나로 옮겨진다.

### 배정 규칙

룰렛(1~9) → 주사위(`+` `-` `×` 각 2면) → 룰렛(1~9) 를 셈한 값만큼 이동한다.

- 이동은 **그 학생이 앉을 수 있는 빈 자리 목록** 위에서만 센다. 목록 길이로 순환하므로
  몇 칸이 나오든 항상 유효한 자리에 착지한다 — 재추첨이 없다.
- 출발점은 직전 학생 자리 바로 다음 후보. 첫 학생은 A1.
- 출발 칸에 전체 칸수를 띄우고 도착 칸에 0이 뜬다. 음수면 뒤로, 0이면 제자리.

## 외부 자원

- 폰트: 에이투지체 (jsdelivr CDN, 눈누). `_headers` 의 COEP `require-corp` 아래에서도
  CDN이 CORS·CORP 헤더를 보내므로 로드된다.
- 배포: `yarn build && yarn sync` (rsync → `home:/projects/seats.hwaryong.com`)
