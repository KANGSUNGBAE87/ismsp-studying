# 2026-06-21 Criterion Graph Explanations

Actor: codex

## User Request

- Improve criterion-choice distractors so unrelated certification criteria are not attached only because of weak word overlap.
- Use certification criteria, defect cases, and check items together when selecting similar criteria.
- Split criterion-choice feedback into correct-answer explanation and wrong-option explanations.
- Deploy the result to GitHub Pages.

## Decisions

- Criterion-choice distractors are now ranked from combined evidence:
  - source question body,
  - certification criterion requirement,
  - same group/domain,
  - check-item examples,
  - defect-case examples,
  - wrong-note graph relationship as a small boost.
- A single weak token is not allowed to dominate over same-group/domain context.
- Criterion-choice review now renders:
  - `정답 해설` for the actual correct criterion,
  - `오답 해설` for the other offered criteria,
  - `선택한 오답` badge when the user picked a wrong criterion.

## Files Changed

- `src/core/quizEngine.js`
- `public/app.js`
- `public/styles.css`
- `src/i18n.js`
- `tests/quizEngine.test.mjs`
- `tests/mobileLayoutSource.test.mjs`

## Verification

- `node --test tests/quizEngine.test.mjs`
- `node --test tests/mobileLayoutSource.test.mjs`
- `node --check src/core/quizEngine.js && node --check public/app.js && node --check src/i18n.js`
- `npm test`
- `npm run build`
- Local Chrome CDP mobile verification at `http://127.0.0.1:4173/`

## Result

- The `1.2.1 정보자산 식별` sample that previously admitted weak cross-domain candidates now offers nearby `1.1.4`, `1.2.2`, `1.2.3`, `1.2.4` candidates.
- Criterion-choice feedback shows separate correct and wrong-option explanation sections.

## Remaining Risks

- The ranking is deterministic lexical/graph scoring, not semantic embedding. It is stricter than before but still may need more curated concept synonyms for edge cases.

## Knowledge Promotion

- No cross-project durable knowledge promotion needed.
