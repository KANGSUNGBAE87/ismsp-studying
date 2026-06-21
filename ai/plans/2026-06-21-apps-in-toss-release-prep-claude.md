---
version: 0.1
status: draft
updated: 2026-06-21
canonical: false
author: claude
---

# 앱인토스 배포 준비 체크리스트 (ISMS-P 학습앱)

플랫폼 표준: `지식저장소/docs/tools/apps-in-toss-platform.md`,
`docs/workflows/apps-in-toss-release-gate.md`, 비게임 수익화 원칙.
이 앱은 **비게임 학습 앱** → 앱인토스 직접 출시가 기본 경로.

## 1. 현재 상태

- runtime: 바닐라 JS 정적 웹앱(ES modules, fetch), GitHub Pages 배포 중
- 빌드: `node scripts/build.mjs` → `dist/`
- 광고: `AdsAdapter`가 `globalThis.AppsInToss.showFullScreenAd({adGroupId, onEvent})`
  + `userEarnedReward` 경로를 이미 갖춤(앱인토스 광고 API 형태와 일치). 웹은 스텁.
  현재 placement id는 **임시 문자열**(`AD_PLACEMENTS`).
- 배너: 현재 자체 `#ad-banner`(스텁). 앱인토스 BannerAd 연결 필요.
- 로그인/IAP: 미사용(IAP는 다음 단계). 로그인 불필요(로컬 학습).
- 백엔드: 없음(localStorage). 광고 보상 서버검증은 웹 코호트 스텁(추후 Supabase).
- i18n: ko 단일. 앱인토스 ko 기본 OK.

## 2. 런타임 판단

- `runtime = WebView` 가 적합(정적 SPA → 변환 비용 최소).
- `projectType = 비게임 학습 앱`, `releaseOrder = 앱인토스 직접 출시`.
- `platformServices = 광고`(IAP/로그인/토스페이/프로모션은 현재 없음).
- `businessRequired = 예` — **광고 사용 → 사업자 등록 필요**.
- `serverRequired = 아직 아님`(보상 서버검증은 V2).

## 3. 코드 작업 (내가 진행)

1. 앱인토스 WebView SDK(`@apps-in-toss/web-framework` 류) 설치 + 앱 초기화
   - 정확한 패키지/초기화/Safe Area/뒤로가기·닫기 API는 공식 WebView 시작 문서 확인 후.
2. `AdsAdapter` 실제 연결 마무리
   - 전면/리워드: `showFullScreenAd` + `userEarnedReward`(이미 구조 있음)
   - 배너: 앱인토스 `BannerAd` 마운트로 교체(현재 자체 슬롯)
   - `AD_PLACEMENTS`를 콘솔에서 발급한 실제 광고그룹 ID로 치환(값은 env, 코드에 하드코딩 금지)
3. 빌드 파이프라인: `npx ait build`. 산출물 레이아웃이 `dist/index.html` →
   `dist/web/index.html`로 바뀔 수 있으니 정적 체크를 양쪽 허용.
4. Safe Area / 화면 닫기 / 뒤로가기·스와이프 / 권한을 SDK 레퍼런스대로 처리.
5. 출시 전 UX 리스크 제거: 진입 직후 가로막는 광고성 바텀시트 금지, 예측 불가
   전면광고 금지(현재 홈 복귀 3분 cap은 OK), 광고/콘텐츠 오인 배치 금지.

## 4. 외부 작업 (성배님 — 앱인토스 콘솔/계정 필요)

1. 앱인토스 콘솔에 미니앱 등록(앱 이름/아이콘/카테고리/심사 정보)
2. **사업자 등록**(광고 수익화 전제)
3. 광고 그룹 생성 → 전면/리워드/배너용 광고 ID 발급 → 코드 env로 전달
   (개발 중에는 테스트 광고 ID만 사용)
4. 필요 시 `APPS_IN_TOSS_CONSOLE_API_KEY` 발급(서버/CI 전용 secret, 코드 저장 금지)
5. 샌드박스 테스트 → 토스앱 QR/스킴 테스트(최소 1회) → 검토 요청 → 승인 → 출시

## 5. 배포 전 게이트(요약, 출시 직전 원문 재확인)

- [ ] 샌드박스 기능 검증
- [ ] 토스앱 테스트 1회 이상(QR/스킴)
- [ ] 비게임 출시 체크리스트(app-nongame) 확인
- [ ] UX 가이드/외부링크·자사앱 설치 제한/저작권·홍보 제한
- [ ] 권한·세션·실제 광고·CORS·라이브 도메인(HTTPS) 재검증
- [ ] 광고: 명시적 opt-in, 정상 보상 경로, 예측 가능 배치(현재 충족)
- [ ] 출시 후 모니터링/롤백/핫픽스 계획

## 6. 지금 결정 필요

- (a) SDK 통합 코드부터 시작(공식 WebView 문서 확인하며) — 단 ait 빌드/실광고는
  콘솔 광고 ID가 있어야 끝까지 검증 가능
- (b) 콘솔 앱 등록 + 사업자 등록 + 광고 ID 발급(외부)부터 진행 후 코드 연결

## Change Log

- 2026-06-21 [claude]: 배포 준비 진단/로드맵 초안. 새 세션 2/2 리필은 이미 구현 확인.
