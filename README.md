# DOQ Frontend

ComfoziAI 구매 증빙 인박스 화면입니다. 인입(업로드·수기 입력) → 검수 인박스 → export 까지를
다룹니다.

| | |
|---|---|
| 구동 URL | <https://doq.siotman.work> (Basic Auth, 계정 별도 전달) |
| 백엔드 | <https://github.com/DOQ-2026-MVP/doq-backend> |
| 배포 구성 | <https://github.com/DOQ-2026-MVP/doq-deploy> |

전체 스택을 한 번에 띄우려면 배포 구성 저장소를 쓰시면 됩니다. 여기는 프론트엔드 단독 실행
방법입니다.

## 요구 사항

- Node.js 22 이상

## 실행

```bash
npm install
npm run dev
```

→ <http://localhost:5173>

API 는 같은 출처의 `/api` 로 호출합니다. 단독으로 띄우면 백엔드가 붙지 않으므로, `vite.config.ts`
의 프록시 설정(`/api` → `http://localhost:8080`)을 켜고 백엔드를 함께 띄우셔야 합니다.

## 빌드

```bash
npm run build
```

`dist/` 에 정적 번들이 생성됩니다. 배포는 이 결과물을 웹서버가 서빙하고, `/api` 경로는 앞단
프록시가 백엔드로 넘깁니다.

## 지원 범위

- 파일 업로드와 수기 입력, 세션 현황 실시간 표시
- 검수 인박스 목록·상세에서 편집·확정·반려
- 승인 항목 export 내려받기

## 미지원

- 사용자 계정·로그인이 없습니다. 공개 배포의 접근 제어는 앞단 Basic Auth 로만 합니다.
- 데스크톱 화면 기준입니다. 모바일 레이아웃은 다루지 않습니다.

## 알려진 오류 · 한계

- **업로드 직후에는 행이 비어 보일 수 있습니다.** 백엔드의 파싱·추출이 업로드 응답 뒤에
  이어지므로, 현황이 갱신될 때까지 처리 중 상태로 남습니다.
- **실시간 현황은 재연결 시 최신 스냅샷으로 갈아끼워집니다.** 끊긴 사이의 변화를 되짚어
  보여주지 않습니다.

## 기술 스택

| 항목 | 버전 |
|---|---|
| Language | TypeScript 6 |
| Framework | React 19 |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS 4 |
| Routing | React Router 7 |
| Data Fetching | TanStack Query 5 |
| Package Manager | npm |
