---
version: 0.13
status: implemented
updated: 2026-06-19
canonical: true
---

# Implementation Plan

## Objective

Build a first usable ISMS-P defect-judgment quiz app from `ISMS-P 인증기준 결함 테스트_240712v2.xlsx`.

## Implemented Scope

- Extracted app-ready JSON from source spreadsheets.
- Implemented quiz engine that originally reproduced the workbook logic, then
  revised the first mode on 2026-06-16 to the v2 error-hunt behavior:
  - two false judgment statements
  - three true judgment statements
  - shuffled five-option question
  - exactly two incorrect judgments must be selected
- Built static web UI with session controls, question navigation, answer review, weak-area summary, and question-bank metadata.
- Added inline false-option explanations:
  - exact original defect-case mapping
  - similar original defect-case fallback
  - criteria-scope fallback without learner-facing missing-source phrasing
  - original correct judgment sentence and criteria mismatch reason
- Added Korean/English UI locale switching.
- Added platform adapter seam for storage, locale, and haptics.
- Added local static server.

## Ten-Question Incorrect-Judgment Default (Implemented 2026-06-19)

> Status: implemented and verified. The app now starts from the lower-friction
> `결함판단 틀린거 1개 찾기` drill and uses 10-question sessions by default.

### Implemented

- Added `DEFAULT_SESSION_COUNT = 10` to the quiz engine and applied it across
  default session creation paths.
- Changed `createStudySession(...)` with no explicit mode to create
  `defect-judgment-incorrect` sessions.
- Updated the browser home state so stale saved `50`-question preferences are
  normalized back to 10.
- Reordered the home cards so `결함판단 틀린거 1개 찾기` appears first.
- Kept `결함판단 올바른거 1개 찾기` as a secondary visible drill.
- Kept the older five-option/two-wrong-answer defect judgment mode hidden for
  compatibility and future experiments.

### Verification

- TDD red check: the new default-session test failed against the previous
  `defect-judgment`/50-oriented default.
- `npm test`: 28/28 passing.
- Browser QA at `http://127.0.0.1:4173/`:
  - first home card is `결함판단 틀린거 1개 찾기`;
  - session-size select contains and selects `10`;
  - starting the first mode renders `문항 1 / 10` with two judgment options.

## Defect Judgment Graph Foundation (Implemented 2026-06-16)

> Status: implemented as a hidden foundation. The first visible defect-judgment
> mode now asks the learner to select the two incorrect auditor judgments.
> The personalized weak-problem session API exists but is not wired into the
> home UI, so `취약한 문제 보기` remains hidden until after launch.

### Implemented

- Added `scripts/build-wrongnote-graph.py`.
  - Inputs: `public/data/ismsp-defect-bank.json`,
    `public/data/synth-distractors.json`, and the existing wrong-note workbook.
  - Outputs:
    - `public/data/wrongnote-graph.json`
    - `public/data/criteria-summary.json`
    - `public/data/wrongnote-match-report.json`
- Added `scripts/concept-dictionary.yml` as the seed concept taxonomy.
- Generated the first wrong-note graph from the real source files:
  - 5,127 nodes
  - 30,468 edges
  - 101 Criteria nodes
  - 496 CheckItem nodes
  - 381 DefectCase nodes
  - 3,966 JudgmentStatement nodes
  - 132 WrongNoteEntry nodes
  - 132/132 imported wrong-note rows exact matched
  - 174 blank numbered rows recorded separately
- Added hidden engine API `createWeakDefectJudgmentSession(...)` for future
  weak-problem sessions. It prioritizes false/true judgment pools by
  criteria-summary weak scores but is not exposed in `public/app.js`.
- Updated first-mode UI copy and answer marking so `isCorrect=false` judgment
  statements are the answer targets while the statement truth value remains
  available for explanation.
- Updated the first defect-judgment mode to stop sampling original `falsePool`
  rows for displayed false options. Runtime false options are now generated from
  source true cases plus graph-similar claimed criteria:
  - candidate criteria come from `wrongnote-graph.json` `SIMILAR_TO` edges and
    `similarCriteriaByCode`.
  - candidates must pass same-domain, criterion-scope overlap, claimed
    criterion-name anchor overlap, and body-to-claimed-criteria overlap checks.
  - generated false options use `rtf-<trueId>-<wrongCriteriaCode>` IDs and keep
    `correctAnswer`, `correctAnswerName`, and `wrongnessReason` metadata.
- Updated `public/app.js` to load `wrongnote-graph.json` alongside the base
  question bank.

### Verification

- `npm test`: 19/19 passing.
- `python3 -m py_compile scripts/build-wrongnote-graph.py`: passing.
- `node --check public/app.js`: passing.
- `node --check src/core/quizEngine.js`: passing.
- Real-data runtime generation check: 50 questions, 100 false options, 0
  original `f-*` ID hits, and 0 original false-statement text hits.
- Headless Chrome QA at `http://127.0.0.1:4174/`: first rendered question had
  two `rtf-*` false options and no original false IDs; answer feedback displayed
  selected options, original answer options, and criterion-scope explanations.

## Win Mock Exam OCR Pilot (Implemented 2026-06-19)

> Status: implemented as an analysis-only pilot. The generated data is not yet
> wired into the app runtime.

### Implemented

- Added `scripts/vision-ocr.swift` for macOS Vision OCR over rendered PDF pages.
- Added `scripts/extract-win-mock-exam-criteria-bank.py`.
  - Supports OCR text fixtures for testable parsing.
  - Supports selected real PDF page ranges via bundled Poppler `pdftoppm`.
  - Extracts question blocks, option markers, answer-explanation blocks, answer
    markers, ISMS-P criteria codes, and match status.
  - Treats answer explanations with no answer marker as `explanation_only`
    instead of over-trusting them as matched answers.
  - Handles OCR-damaged explanation markers such as `{ 해설 ]`.
  - Fails fast on OCR page errors.
  - Repairs observed count-type OCR ordering where the question body is read
    after `① 0개`.
  - Removes OCR footer/copyright suffix noise and avoids local absolute paths in
    generated source summaries.
- Added `tests/winMockExamExtraction.test.mjs`.
- Generated the first real pilot output:
  - `ai/analysis/win-mockexam-criteria-question-bank.json`
  - Source: `2025_F_공개(총2회).pdf`
  - Pages: `82-83,150-151`
  - Result: 3 questions, 3 answer-explanation blocks, 2 matched answers, 2
    criteria-related questions.

### Next Step

- Expand from page-range pilot to full-per-PDF segmentation:
  - identify exam-set boundaries,
  - pair question pages with matching answer pages,
  - keep low-confidence rows in `needsReview`,
  - only then transform reviewed rows into `public/data`.

## Three Study Modes (Implemented 2026-06-13)

> Status: implemented and verified. Data, engine, UI, i18n, and styles for all
> three modes are in place. 15/15 unit tests pass; desktop + mobile browser QA
> verified (no horizontal overflow, no console errors). See `ai/reviews/review.md`.

### Goal

Add a home mode selector with three study paths:

- `결함사항 판단문 공부`: keep the current mixed judgment quiz.
- `결함사항 기준맞추기`: show the original defect case and ask the learner to choose the matching ISMS-P criterion from five similar criterion options.
- `확인사항 기준맞추기`: show one major confirmation/check item and ask the learner to choose the matching ISMS-P criterion from five similar criterion options.

### Data Sources

- Keep `ISMS-P_인증기준_세부점검항목(2023.10.31).xlsx` as the authoritative criteria basis.
  - 101 criteria.
  - 328 official major check items.
- Add `ISMS-P_인증기준_셀프테스트_20240103.xlsx` as the self-test source for confirmation-item study.
  - Use sheet `1.7 확인(통합)` as the main confirmation pool.
  - Observed pool size: 499 rows, 496 unique question texts, 100 criterion codes.
  - Use sheet `1.3 확인(가상)` to identify virtual-asset-specific confirmation items.
    - Observed 381 virtual-asset confirmation rows.
    - 56 rows are virtual-asset-specific compared with `1.1 확인(일반)`.
    - All virtual-asset confirmation rows are represented in `1.7 확인(통합)`.
    - Display virtual-asset-specific questions with a `(가상자산)` badge.
  - Do not use only `1.8 (통합) 문제` as the source pool because it is already a 50-question generated sample.

### Target Data Model

Extend `public/data/ismsp-defect-bank.json` into a broader study bank while keeping backward compatibility:

```json
{
  "criteria": {
    "2.2.2": {
      "code": "2.2.2",
      "name": "...",
      "domain": "...",
      "groupCode": "...",
      "groupName": "...",
      "requirement": "...",
      "checkItemCount": 0
    }
  },
  "similarCriteriaByCode": {
    "2.2.2": ["2.2.4", "2.2.5", "2.2.1", "2.1.2", "2.5.1", "1.3.2"]
  },
  "truePool": [],
  "falsePool": [],
  "defectCasePool": [
    {
      "id": "d-1",
      "defectCase": "결함사례 원문",
      "criteriaCode": "2.7.1",
      "criteriaName": "암호정책 적용",
      "sourceRow": 2532
    }
  ],
  "checkItemPool": [
    {
      "id": "c-1",
      "question": "확인사항 문장",
      "criteriaCode": "2.2.2",
      "criteriaName": "인식제고 및 교육훈련",
      "groupCode": "2.2.",
      "groupName": "인적 보안",
      "domain": "2.보호대책 요구사항",
      "sourceSheet": "1.7 확인(통합)",
      "sourceRow": 1,
      "sourceVariant": "virtualAsset",
      "displayBadge": "가상자산",
      "keywords": "셀프테스트 G열 요약 키워드"
    }
  ]
}
```

### Precomputed Similar Criteria Policy

- For modes 2 and 3, do not store only four wrong options per source question.
- Instead, precompute a ranked similar-criteria list per criterion code and store it as `similarCriteriaByCode`.
- Each criterion should have a reasonably broad list, preferably 8-15 candidate criteria when available.
- The list is generated ahead of time during data extraction/build from:
  - same group prefix
  - same domain
  - criteria name/requirement/check-item text similarity
  - defect-test workbook false mappings when available
- The generated list should be deterministic and persisted in JSON so it can later be manually reviewed or edited.
- At runtime, do not judge semantic similarity again.
- Runtime option generation should only do:
  1. read `similarCriteriaByCode[correctCriteriaCode]`
  2. sample four criteria from that precomputed list with the session/question seed
  3. combine `[correctCriteriaCode, ...sampledSimilarCriteriaCodes]`
  4. resolve each criterion code to `code + name`
  5. shuffle the five options with the session/question seed
- The same criterion can therefore produce different four-option distractor sets across sessions while still drawing only from vetted similar criteria.
- The order must also change across new sessions/attempts, so a repeated item does not always show the correct answer in the same position.
- Within one rendered question, option order must stay fixed after selection/checking/navigation so the learner's selected answer does not move.

### Similar Option Strategy

For each defect-case criterion-choice question:

1. Correct option is the true defect row's `criteriaCode`.
2. Build or reuse `similarCriteriaByCode[criteriaCode]`.
3. While building the similar list, give strong priority to wrong criteria already generated in the workbook for the same `defectCase` from `falsePool`.
4. Fill and rank the list with deterministic similar criteria:
   - same group prefix, e.g. `2.7.x`
   - same domain, e.g. `2.보호대책 요구사항`
   - text similarity between defect case and candidate criterion requirement/name
5. Runtime samples four criteria from `similarCriteriaByCode[criteriaCode]`.
6. Shuffle option display order only when creating a quiz session/question.

For each confirmation-item criterion-choice question:

1. Correct option is the item's `criteriaCode`.
2. Build or reuse `similarCriteriaByCode[criteriaCode]`.
3. While building the similar list, rank candidate criteria from:
   - same group prefix, e.g. `2.2.x`
   - same domain, e.g. `2.보호대책 요구사항`
   - text similarity between the check item and candidate criterion requirement/name
4. Score candidates with a deterministic similarity function using normalized Korean text and n-gram overlap.
5. Exclude the correct criterion.
6. If the same group has too few candidates, fill from same domain, then global high-similarity criteria.
7. Runtime samples four criteria from `similarCriteriaByCode[criteriaCode]`.
8. Shuffle option display order only when creating a quiz session/question.

### Question Behavior

- `결함사항 판단문 공부`
  - Updated behavior as of 2026-06-16: 5 options, 2 incorrect judgment statements.
  - Inline false-option explanation remains for judgment statements the learner incorrectly selects.
- `결함사항 기준맞추기`
  - Prompt: `다음 결함사례는 어떤 ISMS-P 인증기준 결함에 해당하나요?`
  - Display only the original defect-case text, not the already-completed judgment sentence.
  - Show five criterion options as `code + name`.
  - Exactly one answer is correct.
  - After checking:
    - Correct criterion is marked.
    - Wrong selected criterion gets an explanation using the current wrong-candidate explanation logic where possible.
- `확인사항 기준맞추기`
  - Prompt: `다음 확인사항은 어떤 ISMS-P 인증기준에 해당하나요?`
  - Display the confirmation/check item as the main question.
  - If the question is virtual-asset-specific, show `(가상자산)` near the question metadata.
  - Show five criterion options as `code + name`.
  - Exactly one answer is correct.
  - After checking:
    - Correct option is marked.
    - Wrong selected option gets a short explanation:
      - selected criterion requirement
      - correct criterion requirement
      - why the check item belongs to the correct criterion

### UI Plan

- First screen becomes a compact study-mode home:
  - Three primary buttons:
    - `결함사항 판단문 공부`
    - `결함사항 기준맞추기`
    - `확인사항 기준맞추기`
  - Keep session size and language controls in the side panel or top controls.
- After entering a mode:
  - Add a `홈` or mode-switch button.
  - Reuse the existing study layout: side progress, question body, options, review/meta panel.
  - Change text and stats labels based on active mode.

### File Plan

- Modify `scripts/extract-defect-bank.py`
  - Add `defectCasePool` from confirmed `truePool` rows.
  - Add `load_check_item_pool()`.
  - Read `ISMS-P_인증기준_셀프테스트_20240103.xlsx` sheet `1.7 확인(통합)`.
  - Read `1.1 확인(일반)` and `1.3 확인(가상)` to tag virtual-asset-specific confirmation items.
  - Add `similarCriteriaByCode`.
  - Generate a ranked similar criteria list for each criterion code, not just four options per question.
  - Use defect workbook false mappings as strong signal when computing criterion similarity.
  - Add `checkItemPool` and counts to the JSON payload.
- Modify `src/core/quizEngine.js`
  - Keep existing defect functions stable.
  - Add generic `createStudySession(bank, { mode, count, seed })`.
  - Add `createDefectJudgmentSession()` wrapper around current logic or preserve `createSession()` for compatibility.
  - Add `createDefectCriterionSession()`.
  - Add `createCheckItemSession()`.
  - Add `evaluateSingleAnswer()`.
  - Add `explainDefectCriterionAnswer()`.
  - Add `explainCheckItemAnswer()`.
  - Reuse or extract text normalization and similarity helpers.
- Modify `tests/quizEngine.test.mjs`
  - Add tests for 5-option defect criterion-choice generation.
  - Add tests that defect criterion-choice uses same-defect false mappings before generic distractors.
  - Add tests for 5-option check-item generation.
  - Add tests that check-item generation samples from `similarCriteriaByCode`.
  - Add tests that the same source item can appear with a different sampled distractor set or display order under a different seed.
  - Add tests that an already-created question keeps option order stable after answer checking.
  - Add tests that distractors prefer same group/domain.
  - Add tests that virtual-asset-specific check items carry a display badge.
  - Add tests for one-answer scoring.
  - Add tests for wrong-answer explanation.
- Modify `public/app.js`
  - Add `state.mode` and `state.screen`.
  - Render home screen with three mode buttons.
  - Route session creation by mode.
  - Render current mixed defect judgment questions with current behavior.
  - Render defect criterion-choice questions with single-answer behavior.
  - Render check-item questions with single-answer behavior.
- Modify `src/i18n.js`
  - Add mode labels and check-item prompt/status copy in Korean and English.
- Modify `public/styles.css`
  - Add home mode selector layout.
  - Add single-answer criterion option styling.
  - Keep mobile no-overflow constraints.
- Update docs/logs:
  - `ai/plans/implementation-plan.md`
  - `ai/reviews/review.md`
  - `ai/session-logs/2026-06-13-ismsp-quiz-app-implementation-codex.md`

### Test Plan

- Red-green unit tests:
  - `npm test`
  - `node --check public/app.js`
  - `node --check src/core/quizEngine.js`
- Data extraction check:
  - `python3 scripts/extract-defect-bank.py`
  - Expected includes nonzero `checkItemPool`, no invalid criterion codes, existing `truePool`/`falsePool` counts unchanged.
- Browser QA:
  - Open `http://127.0.0.1:4173/`.
  - Home screen shows three buttons.
  - `결함사항 판단문 공부` enters current defect judgment quiz.
  - `결함사항 기준맞추기` enters five-criterion-option defect quiz.
  - `확인사항 기준맞추기` enters five-criterion-option check-item quiz.
  - Virtual-asset-specific check item questions show `(가상자산)`.
  - Selecting one option and checking marks correct/wrong.
  - Mobile viewport has no horizontal overflow.

### GitHub Plan

- Local remote is `origin https://github.com/KANGSUNGBAE87/ismsp-studying.git`.
- Committed all files to `main` branch and successfully pushed to origin.
- Enabled GitHub Pages deployment pointing to `/` (root) on `main` branch.

## Key Files

- `src/core/quizEngine.js`
- `src/i18n.js`
- `src/platform/adapters.js`
- `public/app.js`
- `public/styles.css`
- `public/data/ismsp-defect-bank.json`
- `scripts/extract-defect-bank.py`
- `scripts/serve-static.mjs`
- `tests/quizEngine.test.mjs`

## Change Log

- 2026-06-19 [codex]: Implemented Win mock-exam OCR pilot using Poppler page rendering plus macOS Vision OCR. Added analysis-only extractor, tests, and first sample JSON. Full test suite passes; data is not yet wired into the app.
- 2026-06-13 [claude]: Committed and pushed to Git main branch. Configured and deployed to GitHub Pages at `https://kangsungbae87.github.io/ismsp-studying/`.
- 2026-06-13 [claude]: Implemented all three study modes. Extended `extract-defect-bank.py` (defectCasePool 381, checkItemPool 496, 56 virtual-asset items, similarCriteriaByCode for 101 codes, 0 unknown). Added `createStudySession`/`createDefectCriterionSession`/`createCheckItemSession`/`evaluateSingleAnswer`/`explainDefectCriterionAnswer`/`explainCheckItemAnswer` to the engine; home mode selector + single-answer rendering in `public/app.js`; mode/criterion copy in `src/i18n.js`; home/criterion/badge styles in `public/styles.css`. 15/15 tests pass; browser QA verified on desktop + mobile.
- 2026-06-13: Replaced per-question four-distractor storage with broader precomputed similar-criteria lists sampled at runtime.
- 2026-06-13: Superseded the per-question four-distractor plan.
- 2026-06-13: Corrected the planned mode model from two modes to three modes and added virtual-asset confirmation badges.
- 2026-06-13: Initially planned two study modes; superseded by the three-mode plan above.
- 2026-06-13: Added inline explanations for generated false judgment candidates.
- 2026-06-13: Implemented first static quiz app and test suite.
