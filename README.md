# DOQ Frontend

React + Vite 기반 프론트엔드 서비스.

## 요구 사항

- Node.js 22 이상
- npm (Node.js 포함)

## 패키지 설치

```bash
npm install
```

## 실행

```bash
npm run dev
```

기본적으로 Vite 개발 서버가 실행됩니다.

- 기본 주소: `http://localhost:5173`

## 빌드

```bash
npm run build
```

- TypeScript 타입 검사를 수행한 후 프로덕션 번들을 생성합니다.
- 결과물은 `dist/` 디렉터리에 생성됩니다.

## 미리보기

```bash
npm run preview
```

빌드된 결과물을 로컬에서 확인할 수 있습니다.

## 코드 검사

```bash
npm run lint
```

- ESLint를 이용한 코드 스타일 및 오류 검사

## 프로젝트 구조

```
src/
├── app/        # 앱 초기화
├── assets/     # 정적 리소스
├── entities/   # 도메인 엔티티
├── features/   # 기능 단위 모듈
├── pages/      # 페이지 컴포넌트
└── shared/     # 공통 컴포넌트 및 유틸
```

## Path Alias

| Alias       | 경로            |
| ----------- | --------------- |
| `@`         | `src/`          |
| `@app`      | `src/app`       |
| `@assets`   | `src/assets`    |
| `@entities` | `src/entities`  |
| `@features` | `src/features`  |
| `@pages`    | `src/pages`     |
| `@shared`   | `src/shared`    |
| `@package`  | `../../package` |

## 기술 스택

| 항목            | 버전             |
| --------------- | ---------------- |
| Language        | TypeScript 6     |
| Framework       | React 19         |
| Build Tool      | Vite 8           |
| Styling         | Tailwind CSS 4   |
| Routing         | React Router 7   |
| Data Fetching   | TanStack Query 5 |
| Lint            | ESLint 10        |
| Package Manager | npm              |
