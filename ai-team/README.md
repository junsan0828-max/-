# 자이언트짐 AI 운영팀 (M1)

내 PC에서 24시간 상주하는 **총괄 AI "제이"** 데스크톱 앱.
마인드맵(사업 구조)과 ZIANTGYM+ 데이터(회원·매출·리드)를 분석해
**필요한 업무를 도출·배분하고 리포트**를 만든다. 캐릭터가 상태에 따라 움직인다.

## 지금 되는 것 (M1)
- 총괄 AI 제이가 데이터를 분석 → 우선순위 업무 도출(재등록·이탈·미수금·전환율) → 주간 브리핑
- Electron 캐릭터 UI (대기/분석/보고 상태 애니메이션)
- 매일 정해진 시간 자동 분석 + 트레이 상주(창 닫아도 백그라운드 유지)
- 키·DB 없이도 **샘플 데이터 + 규칙 기반**으로 즉시 동작

## 아직 안 된 것 (다음 마일스톤)
- 팀원 AI(미나/데이터/루나/리포) 개별 캐릭터·실행
- 문자/콘텐츠 실제 발송·반자동 연동
- Live2D 등 고급 애니메이션

## 실행 방법 (내 PC)
```bash
cd ai-team
cp .env.example .env      # 키와 DATABASE_URL 입력 (선택)
npm install
npx playwright --version  # (불필요) — 참고: 이 앱은 playwright 사용 안 함

# 1) 뇌만 터미널로 확인 (GUI 없이)
npm run brain:dry         # 키 없이 규칙 기반으로 동작
npm run brain             # ANTHROPIC_API_KEY 있으면 AI 분석

# 2) 데스크톱 앱 실행 (캐릭터 UI)
npm start
```

## 구글 드라이브 연동
매출/분석 스프레드시트 등 드라이브에 저장된 파일을 AI팀이 읽어서 분석할 수 있다 (읽기 전용).
유튜브 업로드와 같은 구글 클라우드 프로젝트/OAuth 클라이언트(`config/youtube-client-secret.json`)를 그대로 쓰되,
스코프가 달라 최초 1회 별도 브라우저 승인이 필요하다.

1. 구글 클라우드 콘솔에서 해당 프로젝트에 **Google Drive API**, **Google Sheets API**를 사용 설정
2. `npm run drive -- search <검색어>` 로 파일 검색 (최초 실행 시 브라우저 승인 창이 뜸)
3. `npm run drive -- sheet <스프레드시트ID> [시트이름]` 로 스프레드시트 내용 읽기
   (스프레드시트 ID는 URL의 `/d/`와 `/edit` 사이 문자열)

## 환경변수(.env)
| 변수 | 설명 |
|---|---|
| `ANTHROPIC_API_KEY` | 총괄 AI 분석용. 없으면 규칙 기반으로 동작 |
| `AI_TEAM_MODEL` | 분석 모델 (기본 `claude-sonnet-4-6`) |
| `DATABASE_URL` | ZIANTGYM+ Neon/Postgres. 없으면 샘플 데이터 |
| `DAILY_CRON` | 자동 분석 시간 (기본 `0 9 * * *` = 매일 09:00) |

## 24시간 운영 메모
- PC가 켜져 있고 절전이 아니어야 스케줄이 돈다.
- 창을 닫아도 트레이에 남아 백그라운드로 유지된다. 완전 종료는 트레이 → 종료.
- 진짜 무중단은 안 쓰는 미니PC 상시 가동을 권장.
