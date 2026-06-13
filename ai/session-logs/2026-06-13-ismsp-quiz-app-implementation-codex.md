# 2026-06-13 ISMS-P Quiz App Implementation

Actor: codex

## User Request

- Implement a quiz app based on the understood logic of `ISMS-P 인증기준 결함 테스트_240712v2.xlsx`.

## Decisions Made

- Built a static web app first to minimize setup and make the problem-generation logic immediately testable.
- Kept the core quiz engine separate from UI and platform adapters.
- Implemented i18n from the first version with Korean default and English selectable.
- Did not install React Bits because the project is not a React project.
- Used a restrained study-tool palette after design preflight.

## Files Changed

- `package.json`
- `index.html`
- `src/core/quizEngine.js`
- `src/i18n.js`
- `src/platform/adapters.js`
- `public/app.js`
- `public/styles.css`
- `public/data/ismsp-defect-bank.json`
- `scripts/extract-defect-bank.py`
- `scripts/serve-static.mjs`
- `tests/quizEngine.test.mjs`
- `ai/plans/design-plan.md`
- `ai/plans/implementation-plan.md`
- `ai/reviews/review.md`
- `ai/session-logs/2026-06-13-ismsp-quiz-app-implementation-codex.md`
- `/Users/kangsungbae/Documents/지식저장소/projects/ismsp-studying/platform.md`

## Commands And Verification

- `npm test`
- `node --check public/app.js`
- `node --check src/core/quizEngine.js`
- `python3 scripts/extract-defect-bank.py`
- Browser QA through Playwright with local Chrome at `http://127.0.0.1:4173/`.
- `/Users/kangsungbae/.codex/bin/graphify update . --no-cluster`
- `node /Users/kangsungbae/.understand-anything/repo/understand-anything-plugin/skills/understand/scan-project.mjs . .understand-anything/intermediate/scan-result.json`

## Results

- Extracted 101 criteria, 381 true judgment rows, and 1,143 false judgment rows with 0 unknown criteria codes.
- Verified quiz generation, exact-two-answer scoring, session size capping, and stats.
- Verified UI renders 50-question navigation, five options, review panel, locale switching, and no mobile horizontal overflow.
- Refreshed Graphify structural graph with 740 nodes and 1,552 edges.
- Generated an Understand-Anything deterministic scan for 67 files.

## Remaining Risks

- Confirmation-question self-test mode is not implemented yet.
- The app is local/static and has no backend, login, cloud sync, ads, IAP, or native shell yet.
- Full Understand-Anything knowledge graph generation was not completed because the available skill flow requires subagent phases not exposed in this tool session.

## Knowledge Store Promotion

- Project-specific platform note was created at `/Users/kangsungbae/Documents/지식저장소/projects/ismsp-studying/platform.md`.

## 2026-06-13 Inline False-Option Explanation Update

### User Request

- When a false judgment candidate is shown, explain why it is not the answer directly under that option.
- If the exact original mapping is not found, say that the combination was generated as a false candidate and then supplement with similar defect-case search.
- For modified false candidates, show the original sentence or closest original sentence and explain the criteria mismatch.

### Decisions Made

- Added `explainIncorrectOption` to the quiz engine.
- The explanation flow is:
  1. exact normalized defect-case match against confirmed true mappings
  2. similar original defect-case fallback
  3. explicit no-original-mapping fallback
- Correct options are not given extra explanation; false options receive inline explanations after answer check.
- The right review panel no longer lists correct options as a separate answer explanation area.

### Files Changed

- `src/core/quizEngine.js`
- `tests/quizEngine.test.mjs`
- `public/app.js`
- `public/styles.css`
- `src/i18n.js`
- `ai/plans/implementation-plan.md`
- `ai/reviews/review.md`
- `ai/session-logs/2026-06-13-ismsp-quiz-app-implementation-codex.md`

### Commands And Verification

- `npm test`
- `node --check public/app.js`
- `node --check src/core/quizEngine.js`
- Direct JSON check for MD5, retired-access/VPN, and promotional/sales outsourcing false candidates.
- In-app Browser QA was attempted at `http://127.0.0.1:4173/` but was blocked by Browser Use URL policy before reload/interaction.
- `/Users/kangsungbae/.codex/bin/graphify update . --no-cluster`

### Results

- 7 tests passed.
- MD5 wrong `2.7.2` maps back to `2.7.1 암호정책 적용`.
- Retired-access/VPN wrong `2.6.6` maps back to `2.2.5 퇴직 및 직무변경 관리`.
- Promotional/sales outsourcing wrong `3.5.1` maps back to `3.3.2 개인정보 처리 업무 위탁`.
- Refreshed Graphify structural graph with 760 nodes and 3,322 edges.

### Remaining Risks

- Inline explanation UI needs one live visual check in a browser context that can access the local URL.

## 2026-06-13 Dual Study Mode Planning (Superseded)

### User Request

- Treat `https://github.com/KANGSUNGBAE87/ismsp-studying.git` as the repository for this project.
- Plan a home screen with two study buttons:
  - `결함사항공부`
  - `확인사항공부`
- Add confirmation/check-item study like the self-test workbook:
  - show a confirmation item/question
  - learner chooses the matching `2.2.2 ...` style criterion
  - show five similar criterion options so the learner does not type manually

### Decisions Made

- Added local git remote:
  - `origin https://github.com/KANGSUNGBAE87/ismsp-studying.git`
- Keep the current defect-case quiz as `결함사항공부`.
- Add a separate `확인사항공부` mode instead of mixing question types in one session.
- Use `ISMS-P_인증기준_셀프테스트_20240103.xlsx` sheet `1.7 확인(통합)` as the primary confirmation-item pool.
- Keep `ISMS-P_인증기준_세부점검항목(2023.10.31).xlsx` as the authoritative criteria basis.
- Generate five criterion choices per confirmation item:
  - one correct criterion
  - four deterministic similar distractors using same group/domain and text similarity

### Source Checks

- Official 2023 criteria workbook:
  - 101 criteria
  - 328 official major check items
- Self-test workbook:
  - `1.7 확인(통합)`: 499 rows, 496 unique question texts, 100 criterion codes
  - `1.8 (통합) 문제`: 50 already-generated sample questions, not suitable as the full source pool

### Files Changed

- `ai/plans/implementation-plan.md`
- `ai/session-logs/2026-06-13-ismsp-quiz-app-implementation-codex.md`
- `.git/config` remote configuration

### Next Steps

- Implement the data extraction update first.
- Add check-item quiz engine tests before production code.
- Add the home/mode UI after the engine behavior is covered.
- Run browser QA after implementation if local URL access is available in the active browser surface.

## 2026-06-13 Three Study Mode Planning Correction

### User Correction

- The app should have three study modes, not two:
  - current mixed full-judgment defect quiz
  - defect-case criterion-choice quiz
  - confirmation/check-item criterion-choice quiz
- Virtual-asset-specialized confirmation questions must be labeled `(가상자산)`.

### Corrected Decisions

- Replace the two-mode plan with a three-mode home screen:
  1. `결함사항 판단문 공부`
     - Current mode.
     - Five full judgment statements.
     - Two correct answers.
  2. `결함사항 기준맞추기`
     - Show the original defect-case text.
     - Learner chooses the matching criterion from five `code + name` options.
     - Use `truePool` as the source and same-defect false mappings from `falsePool` as first-priority distractors.
  3. `확인사항 기준맞추기`
     - Show the confirmation/check item.
     - Learner chooses the matching criterion from five `code + name` options.
     - Show `(가상자산)` badge for virtual-asset-specific confirmation items.

### Source Checks

- `1.1 확인(일반)`:
  - 325 unique general confirmation items.
- `1.3 확인(가상)`:
  - 381 virtual-asset confirmation items.
  - 56 items are virtual-asset-specific compared with `1.1 확인(일반)`.
- `1.7 확인(통합)`:
  - Contains all rows from `1.3 확인(가상)`.
  - Use this as the main confirmation pool and tag virtual-asset-specific items by comparing normalized question text against `1.3 확인(가상)` and `1.1 확인(일반)`.

### Files Changed

- `ai/plans/implementation-plan.md`
- `ai/session-logs/2026-06-13-ismsp-quiz-app-implementation-codex.md`

### Next Steps

- Implement `defectCasePool` extraction and `checkItemPool` extraction together.
- Implement three session creators:
  - `createDefectJudgmentSession`
  - `createDefectCriterionSession`
  - `createCheckItemSession`
- Add tests before changing UI.

## 2026-06-13 Precomputed Distractor Decision (Superseded)

### User Clarification

- For modes 2 and 3, the four similar wrong criteria should be selected ahead of time.
- When the same item appears again later, the five option order should be shuffled.

### Decision

- Store four precomputed wrong criteria on each item as `distractorCriteriaCodes`.
- Apply this to both:
  - `defectCasePool`
  - `checkItemPool`
- Runtime question creation combines the correct criterion with the four stored distractors and shuffles only the display order.
- The same source item keeps the same five candidate criteria for consistency, but the answer position changes across new sessions or new attempts.
- Once a question is created, the option order stays fixed during selection, checking, and navigation.

### Files Changed

- `ai/plans/implementation-plan.md`
- `ai/session-logs/2026-06-13-ismsp-quiz-app-implementation-codex.md`

## 2026-06-13 Similar Criteria List Decision

### User Clarification

- A source question does not need only four fixed wrong options.
- It is better to precompute a broader similar list for each criterion and sample four from that list whenever that criterion is the correct answer.

### Decision

- Replace per-question `distractorCriteriaCodes` with top-level `similarCriteriaByCode`.
- Example:

```json
{
  "similarCriteriaByCode": {
    "2.2.2": ["2.2.4", "2.2.5", "2.2.1", "2.1.2", "2.5.1", "1.3.2"]
  }
}
```

- Runtime behavior for modes 2 and 3:
  1. read `similarCriteriaByCode[correctCriteriaCode]`
  2. sample four criteria from that precomputed list using the session/question seed
  3. combine the correct criterion and sampled criteria
  4. shuffle display order
- Runtime does not perform semantic similarity judgment; it only samples from the precomputed list.
- A criterion can therefore produce varied wrong options across sessions while still using vetted similar candidates.
- Once a question is created, option order remains fixed during selection, checking, and navigation.

### Files Changed

- `ai/plans/implementation-plan.md`
- `ai/session-logs/2026-06-13-ismsp-quiz-app-implementation-codex.md`

## 2026-06-13 Defect Case Rewrite Sample

### User Request

- Before implementing the full rewrite pipeline, generate about 20 sample rewritten defect-case study sentences for review.

### Decisions Made

- Do not include original defect-case text in the review artifact.
- Keep only `sourceId`, `sourceRow`, and `sourceHash` for internal traceability.
- Generate new study sentences from concept fields:
  - `defectPattern`
  - `controlFailure`
  - `auditContext`
  - `riskPoint`
- Mark samples as `needsReview` when rough source similarity is too high.

### Files Created

- `ai/generated/defect-case-rewrite-samples-2026-06-13.md`
- `ai/generated/defect-case-rewrite-samples-2026-06-13.json`

### Verification

- Generated 20 samples.
- All 20 samples are `draft`.
- `needsReview`: 0.
- Maximum rough source similarity: 0.326.

### Remaining Risks

- Similarity score is only a rough text-overlap guard, not a legal judgment.
- The next step should be human style review before using generated text in the app.

## 2026-06-13 Subtle Statement Mutation Rule Tuning

### User Request

- Make rewrite sentences less explicit and more confusing in a subtle way for quiz use.

### Decisions Made

- Added a generator script: `scripts/generate_subtle_defect_case_rewrites.py`.
- Replaced hard/obvious negation-only rewrites with controlled micro-noise rules:
  - quantifier softening (모두→대부분, 항상→대체로 등),
  - boundary wording shifts (`일부만 없다`, `완전히 안 하지 않았음`),
  - scoped uncertainty clauses (`다만` 패턴) with bounded reuse.
- Kept `sourceTextIncluded: false` and traceability (`sourceRow`, `sourceId`, `sourceHash`).
- Added text normalization for odd quote characters before output.

### Files Changed

- `scripts/generate_subtle_defect_case_rewrites.py`
- `ai/generated/defect-case-rewrite-samples-2026-06-13.md`
- `ai/generated/defect-case-rewrite-samples-2026-06-13.json`

### Verification

- Re-generated 20 samples with current rules.
- Similarity range: min `0.566`, max `0.920`.

### Remaining Risks

- Some samples are still close to originals due source constraint.
- For production quiz export, we may need a stricter minimum mutation policy to avoid accidental high overlap.
