# 2026-06-13 Three Study Modes Implementation

Actor: claude

## User Request

- After confirming the codex-built plan, implement the planned scope of
  `ai/plans/implementation-plan.md`: add the two criterion-choice study modes
  (`결함사항 기준맞추기`, `확인사항 기준맞추기`) on top of the existing defect-judgment quiz.

## Context Checks Before Coding

- Verified codex's ismsp session had paused (no project file changes for ~6 min)
  before editing the shared working tree, to avoid concurrent-edit conflicts.
- Confirmed source xlsx (incl. `ISMS-P_인증기준_셀프테스트_20240103.xlsx`) still in
  `~/Downloads/drive-download-20260613T123004Z-3-001/`.
- Installed `openpyxl` into the system python3 (was missing) to run extraction.

## Decisions Made

- Followed the plan's File Plan exactly: data → engine (TDD) → UI → i18n → styles.
- `defectCasePool` derived from confirmed `truePool` rows (one per unique defect case).
- `checkItemPool` from self-test `1.7 확인(통합)`; virtual-asset items detected as
  `1.3 확인(가상)` minus `1.1 확인(일반)` normalized question text, badged `가상자산`.
- `similarCriteriaByCode`: precomputed, deterministic, 12 per code. Signals:
  workbook false mappings for the same defect case (strongest), same group prefix,
  same domain, name/requirement char-bigram similarity. Runtime only samples 4.
- Single-answer modes share one criterion-question shape (`type: "single"`),
  option id = criterion code; `getQuestionStats`/`buildWeakAreaSummary` generalized
  to handle both multi and single questions.

## Files Changed

- `scripts/extract-defect-bank.py` (new pools + similar list; version 0.2.0)
- `public/data/ismsp-defect-bank.json` (regenerated)
- `src/core/quizEngine.js` (new session creators, single-answer eval/explain)
- `tests/quizEngine.test.mjs` (8 new tests)
- `public/app.js` (home mode selector, per-mode rendering, single-answer flow)
- `src/i18n.js` (mode labels, criterion prompts, single-answer copy; ko + en)
- `public/styles.css` (home selector, question body, criterion options, badge)
- `.claude/launch.json` (preview server config; new)
- `ai/plans/implementation-plan.md`, `ai/reviews/review.md` (updated)

## Commands And Verification

- `python3 scripts/extract-defect-bank.py` → 101 / 381 / 1143 / 381 / 496 / 56 / 0.
- `npm test` → 15/15 passed (TDD: red before engine, green after).
- `node --check public/app.js src/core/quizEngine.js` → OK.
- Live browser QA via Claude Preview (local static server): home 3 modes, mode 2
  single-answer + explanation + weak-area tally, mode 3 virtual-asset badge,
  mobile 375px no horizontal overflow, no console errors.

## Remaining Risks

- Question/body text stays Korean in English UI (by design; prompts/labels localized).
- `1.5 확인(금융)` finance variant not yet a separate mode.
- Local/static only; no backend, login, sync, ads, IAP, or native shell.

## Next Steps

- Monitor GitHub Pages deployment progress and verify the live URL.
- Optional: finance-variant mode/badge.

## Knowledge Store Promotion

- No new cross-project knowledge beyond the existing project platform note. The
  reusable detail (precompute distractor pools, sample at runtime) is recorded in
  `ai/plans/implementation-plan.md`.
