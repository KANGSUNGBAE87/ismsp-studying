# 2026-06-16 Graph Distractor Logic Recheck

Actor: codex

## User Request

사용자가 그래프 기반 오답 생성 로직을 재검토 요청했다. 원래 의도는 원문 문장을 그대로 가져와 기준만 바꾸는 것이 아니라, 그래프에서 단어/개념 유사도를 보고 문장을 섞어 더 그럴듯한 오답을 만드는 것이었다.

## Findings

- `scripts/synthesize-family-a.py`는 현재 결함사례 본문을 그대로 두고 `criteriaCode`와 `criteriaName`만 바꾸는 Family A 오답을 만든다.
- `similarCriteriaByCode`는 같은 그룹, 같은 도메인, 기준명/요구사항의 표면 텍스트 유사도, 기존 false 매핑을 기준으로 유사 기준을 고른다. 문장 내부 개념 슬롯을 섞는 생성 로직은 아니다.
- `scripts/build-wrongnote-graph.py`는 `synth-distractors.json`을 `JudgmentStatement`와 `CONFUSED_WITH` 가중치 소스로 흡수한다. 그래프가 합성 오답을 생성하는 것이 아니라, 이미 만들어진 합성 오답을 진단/개인화 그래프에 연결하는 구조다.
- 따라서 현재 구현은 "그래프 기반 문장 혼합 생성" 목표에는 미달한다. 그래프의 현재 가치는 혼동쌍 분석, 취약 기준 진단, 출제 우선순위 개인화에 더 가깝다.

## Decision

Family A 대량 합성은 고난도 문제은행의 핵심 자산으로 보지 않고 baseline 또는 폐기 후보로 낮춰야 한다. 다음 생성 로직은 그래프에서 `asset`, `control`, `failure_mode`, `context`, `actor`, `evidence`, `scope`, `timing` 같은 슬롯을 추출하고, 공유 개념은 유지하되 핵심 슬롯 1-2개만 이웃 사례에서 가져와 섞는 방식으로 재설계해야 한다.

## Next Steps

- 원문 그대로 복사 + 코드 교체 후보를 자동 reject한다.
- 후보별로 `sourceCaseId`, `donorCaseId`, `sharedConcepts`, `changedConcepts`, `mixedSlots`, `semanticSimilarity`, `plausibilityScore`, `obviousnessScore`, `wrongnessReason`을 저장한다.
- "왜 틀렸는지"는 단순히 다른 기준이라서가 아니라, 어떤 개념 슬롯이 해당 기준의 결함 성립 조건과 충돌하는지 설명해야 한다.
- 이 로그는 판단 기록용이며, 코드/그래프는 아직 수정하지 않았다.

## Graph Refresh

스펙 재검토 로그만 추가했고 생성 로직 구현은 변경하지 않아 Graphify refresh는 보류했다.

## Follow-up: Answer Feedback and Explanation Copy

### User Request

사용자가 오답 생성은 기존 오답원문을 참고용으로만 쓰고, 유사도 높은 항목의 일부 표현만 약하게 섞어야 한다고 재확인했다. 또한 풀이 후에는 사용자가 선택한 선지, 선택이 맞았는지, 원래 정답, 해설을 명확하게 보여주고 "문제은행에서 확인되지 않습니다", "유사결함을 찾지 못했습니다" 같은 문구는 제거하라고 요청했다.

### Files Changed

- `src/core/quizEngine.js`
  - 다중 선택 평가 결과에 `selectedOptionIds`와 `correctOptionIds`를 추가했다.
  - 오답 해설의 매칭 실패 문구를 제거하고, 해당 기준의 요구사항/확인사항/결함사례 범위를 보여주도록 바꿨다.
  - 판단 옵션에 `correctAnswer`, `family`, `trapAxis`, `wrongnessReason` 메타데이터를 보존하도록 했다.
  - falsePool 샘플링 전에 주장 기준의 핵심 범위와 사례 본문이 전혀 닿지 않는 저품질 오답 후보를 제외하도록 했다.
- `public/app.js`
  - 결과 상태줄과 오른쪽 해설 패널에 사용자가 선택한 선지와 원래 정답 선지를 표시하도록 했다.
  - 정답 선지 목록에는 해당 오답 판단의 요약 해설을 함께 보여주도록 했다.
- `src/i18n.js`
  - "원문 미발견"류 라벨을 "기준 범위" 중심 표현으로 바꿨다.
- `tests/quizEngine.test.mjs`
  - 새 평가 메타데이터와 기준 범위 해설 동작을 검증하도록 수정했다.
- `ai/reviews/review.md`
  - 그래프 기반 오답 생성 acceptance criteria를 추가했다.

### Verification

- `npm test`: 18/18 passed.
- `/Users/kangsungbae/.codex/bin/graphify update . --no-cluster`: code graph updated to 1,720 nodes and 23,129 edges after the low-overlap false-option filter. The CLI reported that semantic document re-extraction requires an AI-assisted `/graphify --update` flow, so document semantic refresh was deferred.
- Browser QA with local Chrome at `http://127.0.0.1:4174/`: first mode rendered 5 options; after selecting two options and checking the answer, the page included selected-option feedback, original answer feedback, and explanation text. Forbidden learner-facing phrases were not present in the rendered body text.
- 추가 필터 검증: `f-235`(관리체계 문제점 → 2.11.2 취약점 점검)과 `f-880`(로그 기록 대상 → 2.9.3 백업 및 복구관리)은 실제 데이터 100개 seed, 50문항 세션에서 0회 등장했다.

### Remaining Risks

- 생성기 자체는 아직 "유사 항목 일부 슬롯 혼합" 방식으로 재작성되지 않았다.
- UI 변경은 자동 테스트와 headless Chrome text-level QA로 검증했다. Visual pixel-level review is still optional.

## Follow-up: Runtime Graph Distractor Generation

### User Request

사용자가 원본 오답뱅크를 런타임 보기 생성에 사용하지 말고, 그래프를 활용해 유사도가 있는 오답 판단문을 만들라고 재지시했다. 브라우저 런타임에서 LLM 수준의 새 문장 작문은 어렵지만, 그래프의 유사 기준을 활용해 결정론적으로 오답 판단문을 생성하는 방향으로 구현했다.

### Files Changed

- `src/core/quizEngine.js`
  - `createSession`과 취약영역 세션이 원본 `falsePool`을 샘플링하지 않고 `buildRuntimeFalsePool(bank)` 결과만 사용하도록 변경했다.
  - 런타임 오답 ID를 `rtf-<sourceTrueId>-<wrongCriteriaCode>` 형식으로 생성한다.
  - 오답 후보는 `wrongnote-graph.json`의 `SIMILAR_TO`와 `similarCriteriaByCode`에서 고르되, 같은 도메인, 기준 범위 토큰 겹침, 주장 기준명 앵커 겹침, 결함 본문과 주장 기준 범위 겹침을 통과해야 한다.
  - `hasClaimedCriteriaScopeOverlap`에 정답 source의 `isCorrect:true`가 전달되어 본문-기준 겹침 검사를 우회하던 버그를 수정했다.
  - 짧은 기준명 앵커는 본문 토큰과 정확히 맞을 때만 인정하고, 긴 앵커만 부분 포함을 허용하도록 조정했다.
- `public/app.js`
  - 앱 로딩 시 `wrongnote-graph.json`을 함께 로드해 런타임 생성 로직에서 사용할 수 있게 했다.
- `tests/quizEngine.test.mjs`
  - 원본 `falsePool`을 직접 뽑지 않고 `rtf-*` 런타임 오답만 생성되는지 검증한다.
  - 테스트 fixture를 의미 있는 결함 본문으로 바꿔 새 유사도 필터를 검증한다.

### Verification

- `npm test`: 19/19 passed.
- Real-data seed check with `createSession(bank, { count: 50, seed: 20260616 })`:
  - questions: 50
  - false options: 100
  - original `f-*` ID hits: 0
  - original false statement text hits: 0
- Headless Chrome QA at `http://127.0.0.1:4174/`:
  - first rendered defect-judgment question had 2 runtime false options and 0 original false IDs.
  - selecting the two runtime false options showed selected-option feedback, original answer feedback, and per-option criterion-scope explanation.

### Remaining Risks

- 현재 방식은 브라우저 런타임에서 LLM처럼 자연어를 새로 쓰는 것이 아니라, 원본 정답 결함 본문과 그래프 유사 기준을 조합해 판단문을 결정론적으로 만드는 방식이다.
- 더 높은 난도의 "살짝 섞은" 문장을 만들려면 오프라인 생성/검증 파이프라인에서 슬롯 추출, donor case 선택, 사람이 볼 수 있는 `wrongnessReason` 검증을 추가하는 편이 더 안전하다.
