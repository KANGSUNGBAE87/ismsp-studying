---
version: 1.0
status: final-draft
updated: 2026-06-16
canonical: false
author: codex
supersedes:
  - GPT "ISMS-P 오답노트 그래프화 로직 구현 기획안 초안"
  - ai/plans/2026-06-15-wrongnote-graph-plan-claude.md
---

# 결함판단 훈련 v2 + 오답노트 그래프 개인화 최종 기획안

## 1. 최종 방향

첫 번째 학습 모드인 `결함사항 판단문 공부`를 단순 랜덤 문제 풀이에서
`결함판단 훈련`으로 재정의한다.

핵심 변화는 다음과 같다.

1. 기존 `옳은 판단 2개 고르기`를 `틀린 판단 2개 고르기`로 바꾼다.
2. 오답노트와 앱 풀이기록을 Criteria 중심 그래프로 연결한다.
3. 그래프에서 취약 기준, 헷갈리는 기준쌍, 취약 개념을 계산한다.
4. `결함판단 훈련` 안에 `취약한 문제 보기` 서브메뉴를 둔다.
5. `취약한 문제 보기`는 광고 시청 또는 유료 기능 후보로 둔다.

이 방향의 목적은 "문제를 많이 푸는 앱"이 아니라, 사용자가 실제로 헷갈리는
기준 조합을 다시 출제하는 설명 가능한 개인화 학습 엔진을 만드는 것이다.

## 2. GPT 초안에서 수정해야 할 부분

GPT 초안의 Criteria 중심 그래프, WrongNoteEntry, Concept, SIMILAR_TO,
CONFUSED_WITH 방향은 유지한다. 다만 프로젝트 실제 상태와 이번 제품 방향에 맞게
아래를 수정한다.

| 초안 내용 | 최종 수정 |
|---|---|
| `(참고) 오답고도화` 시트를 입력으로 가정 | 현재 워크북에 해당 시트 없음. `ismsp-defect-bank.json`, `falsePool`, `synth-distractors.json`을 사용 |
| 문제 구성 `정답 2개 + 오답 3개` | 새 첫 모드는 `정답 판단 3개 + 틀린 판단 2개` |
| 오답노트 154/152행 전체를 데이터로 취급 | 번호만 있고 문장/코드가 빈 행 제외. 현재 importable row 기준 확인사항 47건, 결함 85건 |
| Neo4j 중심 가능성 | 정적 GitHub Pages 앱이므로 런타임은 JSON + 브라우저 인메모리 그래프. Neo4j는 선택 export |
| Concept 추출에 형태소/임베딩 포함 | MVP는 룰 기반 사전과 기존 keywords부터 시작. 임베딩은 V2 |
| 사용자 혼동을 오답노트만으로 계산 | 기존 오답노트에는 선택한 오답 보기가 없음. 오답노트는 초기 weak seed, 실제 혼동은 앱 Attempt에서 누적 |

## 3. 제품 구조

첫 번째 메뉴는 다음 구조로 변경한다.

```text
결함판단 훈련
  1. 기본 훈련
     - 틀린 심사원 판단 2개 고르기
     - 무료 핵심 기능

  2. 취약한 문제 보기
     - 오답노트 + 앱 풀이기록 기반 개인화 재조합
     - 광고 시청 또는 유료 기능 후보

  3. 오답 해설/진단
     - 틀린 판단 바로 아래에 해설 표시
     - 기준 오적용, 본문 변형, 유사 기준 차이를 분리 설명
```

기존 다른 모드인 `결함사항 기준맞추기`, `확인사항 기준맞추기`는 유지한다.

## 4. 그래프 모델

그래프의 중심은 `Criteria`다.

```text
WrongNoteEntry
  -> TARGETS
    -> CheckItem / DefectCase / JudgmentStatement
      -> CHECKS / VIOLATES / CLAIMS_CRITERIA
        -> Criteria
          -> CriteriaGroup
            -> Domain
```

모든 문장 노드는 Concept과 연결한다.

```text
CheckItem / DefectCase / JudgmentStatement / WrongNoteEntry
  -> MENTIONS
    -> Concept
```

기준 간 관계는 별도로 둔다.

```text
Criteria -[:SIMILAR_TO]-> Criteria
Criteria -[:CONFUSED_WITH]-> Criteria
```

## 5. 노드 타입

MVP 필수 노드:

```text
Domain
CriteriaGroup
Criteria
CheckItem
DefectCase
JudgmentStatement
WrongNoteEntry
Concept
Source
```

V2 노드:

```text
Attempt
LearningSession
Question
Option
UserProfile
```

## 6. 주요 속성

`Criteria`

```json
{
  "id": "criteria:2.7.1",
  "code": "2.7.1",
  "name": "암호정책 적용",
  "domain": "2.보호대책 요구사항",
  "groupCode": "2.7.",
  "groupName": "암호화 적용",
  "requirement": "인증기준 요구사항 원문",
  "checkItemCount": 0,
  "defectCaseCount": 0,
  "wrongNoteCount": 0,
  "weakScore": 0,
  "confusionScore": 0
}
```

`JudgmentStatement`

```json
{
  "id": "judgment:sha1",
  "statement": "판단문 전체",
  "defectCase": "결함사례 원문",
  "claimedCriteriaCode": "2.7.2",
  "claimedCriteriaName": "암호키 관리",
  "correctCriteriaCode": "2.7.1",
  "correctCriteriaName": "암호정책 적용",
  "isCorrect": false,
  "trapType": "criteria_misapplication",
  "family": "A",
  "trapAxis": "A1",
  "source": "workbook|synth",
  "wrongnessReason": "오답 이유"
}
```

`WrongNoteEntry`

```json
{
  "id": "wrongnote:check:4",
  "noteType": "check_item",
  "originalNo": 4,
  "text": "오답노트 문장",
  "correctCriteriaCode": "2.1.1",
  "correctCriteriaName": "정책의 유지관리",
  "matchType": "exact|normalized_exact|near|standalone|review_required",
  "matchedNodeId": "checkitem:sha1",
  "similarityScore": 1.0,
  "result": "wrong",
  "sourceFile": "isms 확인사항 오답노트.xlsx",
  "sourceSheet": "확인사항오답"
}
```

`Attempt`는 V2에서 추가한다.

```json
{
  "questionMode": "defect_error_hunt",
  "questionId": "q-001",
  "selectedOptionIds": ["f-1", "t-2"],
  "correctOptionIds": ["f-1", "f-3"],
  "selectedCriteriaCodes": ["2.7.2", "2.6.3"],
  "correctCriteriaCodes": ["2.7.1", "2.6.3"],
  "isCorrect": false,
  "elapsedMs": 18000,
  "attemptedAt": "2026-06-16T00:00:00+09:00"
}
```

## 7. 입력 데이터

MVP는 엑셀을 매번 다시 읽지 않고 이미 정규화된 앱 자산을 우선 사용한다.

| 데이터 | 소스 |
|---|---|
| Criteria 101개 | `public/data/ismsp-defect-bank.json.criteria` |
| CheckItem 496개 | `checkItemPool` |
| DefectCase 381개 | `defectCasePool` |
| 정답 판단문 381개 | `truePool` |
| 기존 오답 판단문 1,143개 | `falsePool` |
| 합성 오답 2,442개 | `public/data/synth-distractors.json` |
| 유사 기준 | `similarCriteriaByCode` |
| 기존 오답노트 | `isms 확인사항 오답노트.xlsx` |

오답노트는 번호만 있는 빈 행을 제외하고, 문장과 정답코드가 있는 행만 가져온다.
현재 확인된 importable row는 `확인사항오답 47건`, `결함오답 85건`이다.
빈 번호행은 `wrongnote_match_report.json`에 `blank_numbered_row`로 기록한다.

## 8. 오답 유형 분리

오답 판단문은 반드시 두 유형으로 나눈다.

```text
유형 1: 기준 오적용
claimedCriteriaCode != correctCriteriaCode
예: 2.7.1 결함사례를 2.7.2라고 판단
-> CONFUSED_WITH 생성

유형 2: 본문 변형 / 결함 성립 약화
claimedCriteriaCode == correctCriteriaCode 이지만 isCorrect=false
예: 원문 결함사례의 핵심 조건이 약하게 바뀜
-> CONFUSED_WITH 생성하지 않음
-> DEVIATES_FROM 또는 body_variant trapType으로 관리
```

이 분리가 중요하다. 유형 2를 기준 혼동으로 처리하면 `CONFUSED_WITH` 통계와
개인화 오답 생성이 오염된다.

## 9. 취약도 계산

단순 `wrongCount`만 쓰지 않는다. 많이 나온 항목이 불리해지기 때문이다.

MVP weakScore:

```text
weakScore =
  wrongNoteSeed
+ attemptWrongRate
+ recentWrongWeight
+ streakWrongWeight
+ confusionPairWeight
+ slowCorrectWeight
- recentCorrectRecovery
```

초기에는 Attempt가 없으므로 다음만 사용한다.

```text
wrongNoteSeed
confusionPairWeight from JudgmentStatement / synth-distractors
similarityWeight from SIMILAR_TO
```

앱 사용 후에는 localStorage Attempt를 누적해 실제 개인화 점수로 전환한다.

## 10. 새 첫 모드: 틀린 판단 2개 고르기

기본 구성:

```text
보기 5개
정답 판단문 3개
틀린 판단문 2개
사용자는 틀린 판단문 2개를 선택
```

판정:

```text
선택 수가 정확히 2개이고
선택한 2개가 모두 isCorrect=false이면 정답
```

피드백:

```text
선택한 틀린 판단: 왜 틀렸는지 설명
놓친 틀린 판단: 이것도 오적용/본문변형이라고 설명
맞는 판단을 틀렸다고 고른 경우: 왜 맞는 판단인지 짧게 설명
```

## 11. 그래프 기반 문제 재조합

문제 생성은 다음 순서로 한다.

```text
1. targetCriteria 선택
   - 기본 훈련: 전체 기준 균형 샘플링
   - 취약한 문제 보기: weakScore 높은 기준 우선

2. false option 2개 선택
   - 같은 결함사례의 기준 오적용
   - CONFUSED_WITH 상위 기준
   - SIMILAR_TO 상위 기준
   - 같은 group/domain 기준
   - 사용자가 최근 틀린 기준

3. true option 3개 선택
   - 너무 쉬운 랜덤 정답만 넣지 않음
   - false option과 같은 group/domain/concept를 일부 공유
   - 단, 문장 중복과 기준 과밀은 방지

4. 보기 5개 검증
   - false 정확히 2개
   - true 정확히 3개
   - 문장 중복 없음
   - 동일 defectCase 과도 반복 없음
   - 유형 2 body_variant는 해설 경로 별도 보장

5. 보기 순서 셔플
   - 세션마다 섞음
   - 한 문항 안에서는 제출/이동 후에도 순서 고정
```

## 12. 취약한 문제 보기

`결함판단 훈련`의 서브메뉴로 둔다.

기능:

```text
내 취약 기준 TOP 기준으로 문제 생성
내가 자주 헷갈린 기준쌍을 보기 후보로 우선 사용
기존 오답노트 문장과 같은 Criteria의 다른 결함사례를 섞어 출제
확인사항에서 틀린 기준은 결함사례 문제로 전환 출제 가능
결함사례에서 틀린 기준은 확인사항 문제로 전환 출제 가능
```

과금/광고 후보:

```text
무료:
  기본 결함판단 훈련
  기본 해설
  기본 오답 기록

광고 또는 유료:
  취약한 문제 보기
  오늘의 취약 세트 자동 생성
  헷갈리는 기준쌍 TOP 분석
  고난도 재조합 문제
  장기 취약도 추세
```

주의: 정답 해설 자체는 막지 않는다. 학습 앱에서 해설을 잠그면 기본 가치가 떨어진다.
광고/과금은 "추가 개인화 세션"과 "진단 분석"에 거는 편이 낫다.
실제 적용 전에는 Apps in Toss/Google Play 광고·결제 정책을 별도로 확인한다.

## 13. 저장 방식

정적 앱 기준으로 JSON이 1차 저장소다.

필수 산출물:

```text
public/data/wrongnote-graph.json
public/data/criteria-summary.json
public/data/wrongnote-match-report.json
scripts/concept-dictionary.yml
scripts/build-wrongnote-graph.py
```

선택 산출물:

```text
graph_import.cypher
graph_import.graphml
```

런타임:

```text
브라우저 fetch
인메모리 adjacency index 생성
localStorage에 Attempt 저장
빌드타임 summary + 런타임 attempt를 합쳐 weakScore 계산
```

## 14. 구현 단계

Phase 1. 그래프 빌더

```text
scripts/build-wrongnote-graph.py 생성
기존 JSON + 오답노트 xlsx 입력
nodes/edges/summary/report 생성
오답노트 매칭률 리포트 출력
```

Phase 2. 첫 모드 전환

```text
기존 결함판단 모드를 틀린 판단 2개 찾기로 변경
엔진은 true 3 + false 2 구성
평가 함수는 isCorrect=false 2개 선택 기준
해설은 선택/미선택 false 모두 표시
```

Phase 3. 그래프 기반 샘플링

```text
wrongnote-graph와 criteria-summary 로드
CONFUSED_WITH/SIMILAR_TO/weakScore 기반 후보 랭킹
기본 훈련과 취약 훈련의 샘플링 전략 분리
```

Phase 4. 취약한 문제 보기 UI

```text
결함판단 훈련 내부 서브메뉴 추가
취약 기준 TOP
헷갈리는 기준쌍 TOP
취약 문제 시작 버튼
광고/유료 잠금 상태는 adapter로 분리
```

Phase 5. Attempt 누적

```text
localStorage에 풀이기록 저장
selectedOptionIds / correctOptionIds / elapsedMs / questionMode 저장
weakScore에 실제 오답률 반영
```

## 15. 검증 기준

데이터:

```text
Criteria 101개 유지
DefectCase 381개 유지
CheckItem 496개 유지
JudgmentStatement 정답/오답 수 검증
오답노트 importable row 누락 없음
wrongnote-match-report에 blank/review_required 분리
```

문제 생성:

```text
보기 5개
틀린 판단 2개
맞는 판단 3개
선택 2개만 허용
정답 판정은 false option 2개 정확 선택
보기 순서 세션별 셔플, 문항 내 고정
```

해설:

```text
기준 오적용: 정답 기준 vs 표기 기준 requirement 대비
본문 변형: 원문 결함사례와 변형 포인트 설명
매칭 실패: 문제은행 기반 오답 후보임을 명시하고 유사 사례 보조 제시
```

## 16. 리스크

1. 오답노트는 선택 오답 정보가 없어 `진짜 혼동쌍`을 단독 계산할 수 없다.
   - 대응: 오답노트는 weak seed로만 쓰고, 앱 Attempt에서 선택 기준을 누적한다.
2. 본문 변형 오답을 기준 혼동으로 처리하면 그래프가 오염된다.
   - 대응: `criteria_misapplication`과 `body_variant`를 분리한다.
3. Concept 사전 품질이 낮으면 SIMILAR_TO 점수가 흔들린다.
   - 대응: Phase 1에서는 `similarCriteriaByCode`와 CONFUSED_WITH를 우선 사용한다.
4. 과금/광고를 너무 빨리 잠그면 학습 경험이 나빠질 수 있다.
   - 대응: 기본 훈련과 기본 해설은 무료, 개인화 세션/진단 분석을 과금 후보로 둔다.

## 17. 최종 결론

이 기능의 핵심은 `오답노트 그래프화` 자체가 아니라, 그래프를 이용해 첫 번째
결함판단 훈련을 개인화하는 것이다.

최종 구현 목표는 다음 문장으로 고정한다.

```text
결함판단 훈련은 사용자가 틀린 판단 2개를 찾아내는 방식으로 바꾸고,
오답노트와 풀이기록을 Criteria 중심 그래프로 연결해,
자주 헷갈리는 기준 조합을 다시 출제하는 개인화 학습 모드로 만든다.
```

## Change Log

- 2026-06-16: GPT 초안과 Claude 보정안을 검토한 뒤, 첫 번째 모드 전환
  (`틀린 판단 2개 찾기`), 그래프 기반 취약문제 생성, 과금/광고 후보, 정적 앱 저장 제약,
  오답노트 importable row 기준을 반영해 최종 기획안 작성.
