# FIT STEP - pt-solo

## 배포 구조
- **서비스 URL**: https://fitstep.co.kr
- **Railway 프로젝트**: 핏스텝 프로젝트 (Root Directory: `pt-solo`)
- **배포 브랜치**: `claude/fix-errors-jzSbz`
- **배포 방식**: 이 브랜치에 push하면 Railway가 자동 배포

## 중요 규칙
- `git push`만 하면 자동 배포됨 — Railway에서 수동 Redeploy 불필요
- Railway에서 수동 Redeploy를 하면 현재 브랜치 코드로 덮어씌워지므로 하지 말 것
- force push(`--force`)는 브랜치 리셋이 필요한 경우에만 사용
- 작업은 항상 `claude/fix-errors-jzSbz` 브랜치에서 진행

## 기술 스택
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express + tRPC + Drizzle ORM
- **DB**: PostgreSQL (Railway)
- **인증**: 세션 기반 + 카카오 OAuth (`/auth/kakao`)
- **빌드**: `npm run build` (pt-solo 루트에서 실행)

## 카카오 로그인
- 서버 라우트: `/auth/kakao`, `/auth/kakao/callback`
- 환경변수: `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `APP_URL`
- 카카오 개발자 콘솔 Redirect URI: `https://fitstep.co.kr/auth/kakao/callback`

## 주요 페이지 경로
- `/` — 랜딩 페이지 (비로그인 시)
- `/login` — 로그인
- `/register` — 트레이너 회원가입
- `/p/:username` — 트레이너 브랜드 공개 페이지
- `/fit-step-plus/:trainerId` — 회원 전용 앱
