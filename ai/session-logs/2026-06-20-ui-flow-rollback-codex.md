---
version: 1
status: complete
updated: 2026-06-20
canonical: false
actor: codex
---

# 2026-06-20 UI Flow Rollback

## User Request

- The local app opened to the wrong project first, then ISMS-P showed a failed
  Landing/Qualification-style design.
- Roll back changes from other agents while preserving Codex's graph-based
  wrong-answer logic.

## Decisions

- Restored the live app surface to the previous three-mode ISMS-P study UI.
- Removed the failed Studio pipeline, ad/analytics, Korean-only QA, and
  visual-design artifacts that were tied to the broken four-screen flow.
- Preserved the graph-based runtime false-option generation in
  `src/core/quizEngine.js` and the required wrong-note graph data.
- Re-added only the thin UI changes needed by the preserved engine:
  `wrongnote-graph.json` loading, "two incorrect judgments" copy, answer-target
  marking, and selected-vs-correct answer summary.

## Files Changed

- Restored/cleaned: `public/styles.css`, `src/platform/adapters.js`,
  `ai/plans/design-plan.md`, `.claude/CLAUDE.md`, `ai/plans/product-plan.md`.
- Updated: `public/app.js`, `src/i18n.js`,
  `ai/plans/implementation-plan.md`, `ai/reviews/review.md`.
- Removed untracked failed-flow artifacts under `stages/`, ad/analytics tests,
  `src/analytics.js`, root Studio decision notes, and related session logs.

## Verification

- `node --check public/app.js`
- `node --check src/i18n.js`
- `node --check src/core/quizEngine.js`
- `npm test`: 28 tests passed.
- Browser check at `http://127.0.0.1:4181/`:
  - no Landing/Qualification text;
  - mode cards are `결함사항 판단문 공부`, `결함사항 기준맞추기`, `확인사항 기준맞추기`;
  - first mode renders five options with two `rtf-*` runtime graph false options;
  - visible instruction says `틀린 판단문 2개를 선택하세요.`

## Remaining Risks

- The generated wrong-note graph still needs quality review for semantic
  plausibility; this rollback only removed the bad UI flow.
- Several analysis/OCR/question-bank artifacts remain because they are separate
  from the failed UI design and are used by the current graph/data work.

## Knowledge Store Promotion

- No cross-project reusable knowledge promoted.
