# 핏스텝 안드로이드 TWA → 플레이스토어 출시 가이드

## 준비물

- [ ] Google Play 개발자 계정 ($25 일회성 등록비)
  - https://play.google.com/console/signup
- [ ] Node.js 18+ 설치된 로컬 PC (Mac/Windows/Linux)
- [ ] Android Studio 또는 Java JDK 17+ (키스토어 생성용)
- [ ] Railway 앱 URL (예: `https://your-app.up.railway.app`)

---

## 1단계: Railway URL 확인 및 환경변수 설정

Railway 대시보드에서 앱 URL 확인 후:

```
TWA_PACKAGE_NAME=com.fitstep.app
TWA_SHA256_CERT_FINGERPRINT=  ← 3단계에서 채워넣을 값
```

Railway 환경변수에 위 두 값 추가 (3단계 완료 후).

---

## 2단계: 로컬 PC에서 bubblewrap 설치

```bash
npm install -g @bubblewrap/cli
```

---

## 3단계: 키스토어(서명 키) 생성

```bash
keytool -genkeypair -v \
  -keystore android.keystore \
  -alias fitstep \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

비밀번호 설정 후 SHA-256 지문 확인:

```bash
keytool -list -v -keystore android.keystore -alias fitstep
```

출력에서 `SHA256:` 으로 시작하는 줄 복사 (예: `AB:CD:EF:...`).

→ Railway 환경변수 `TWA_SHA256_CERT_FINGERPRINT` 에 붙여넣기  
→ Railway 재배포 후 `https://YOUR_URL/.well-known/assetlinks.json` 접속해서 fingerprint 값 확인

---

## 4단계: twa-manifest.json 수정

`twa/twa-manifest.json` 파일에서 `YOUR_RAILWAY_URL` 을 실제 URL로 교체:

```json
"host": "your-app.up.railway.app",
"iconUrl": "https://your-app.up.railway.app/icons/icon-512.png",
"webManifestUrl": "https://your-app.up.railway.app/manifest.json",
"fullScopeUrl": "https://your-app.up.railway.app/"
```

---

## 5단계: bubblewrap으로 안드로이드 프로젝트 초기화

```bash
cd twa/
bubblewrap init --manifest https://YOUR_URL/manifest.json
```

또는 twa-manifest.json을 직접 사용:

```bash
bubblewrap build
```

처음 실행 시 JDK/SDK 경로를 물어봄 → Android Studio 설치 경로 입력.

---

## 6단계: AAB 빌드

```bash
bubblewrap build
```

완료 후 `app-release-bundle.aab` 파일 생성됨.

---

## 7단계: 플레이 콘솔에 앱 등록

1. https://play.google.com/console 접속
2. "앱 만들기" 클릭
3. 앱 이름: **핏스텝**, 언어: 한국어, 앱 유형: 앱, 무료
4. "내부 테스트" → AAB 파일 업로드
5. 필수 입력: 스크린샷 2장 이상, 아이콘 512×512 PNG, 짧은 설명, 전체 설명
6. 내부 테스터 이메일 추가 → 테스트 링크 공유

---

## 8단계: assetlinks 검증

앱 배포 전 Digital Asset Links 검증:
```
https://developers.google.com/digital-asset-links/tools/generator
```

Site domain: `your-app.up.railway.app`  
Package name: `com.fitstep.app`  
→ "Test statement" 클릭하여 초록불 확인

---

## 패키지 이름 변경 원할 시

`twa/twa-manifest.json`의 `packageId` 수정 후 bubblewrap 재초기화.  
추천 형식: `com.fitstep.trainer` 또는 회사 도메인 기반

---

## 도움말

- bubblewrap 공식 문서: https://github.com/GoogleChromeLabs/bubblewrap
- TWA 가이드: https://developer.chrome.com/docs/android/trusted-web-activity
