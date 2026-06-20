# 2026-06-21 Criteria Similarity Graph

Actor: codex

## User Request

- Build a real criteria similarity graph now instead of relying only on runtime lexical scoring.
- Use certification criteria, defect cases, check items, and existing wrong-note graph relationships to choose semantically similar criteria.
- Deploy the result to GitHub Pages.

## Decisions

- Added a generated `public/data/criteria-similarity.json` artifact.
- The artifact contains:
  - `Criteria` nodes,
  - `Concept` nodes extracted from criteria/check-item/defect-case text,
  - `HAS_CONCEPT` edges,
  - `SIMILAR_CRITERIA` edges,
  - `similarCriteriaByCode` top-N lists for runtime option selection.
- Runtime criterion-choice distractors now prefer `bank.criteriaSimilarity.similarCriteriaByCode` before legacy `similarCriteriaByCode`.
- Legacy runtime lexical/source matching remains as a second-stage re-ranker inside the prebuilt semantic candidate set.

## Files Changed

- `scripts/build-criteria-similarity.mjs`
- `public/data/criteria-similarity.json`
- `public/app.js`
- `src/core/quizEngine.js`
- `scripts/build.mjs`
- `package.json`
- `tests/criteriaSimilarity.test.mjs`
- `tests/appModeSource.test.mjs`
- `tests/quizEngine.test.mjs`

## Verification

- `node --test tests/criteriaSimilarity.test.mjs`
- `node --test tests/criteriaSimilarity.test.mjs tests/appModeSource.test.mjs tests/quizEngine.test.mjs`
- `node --check scripts/build-criteria-similarity.mjs && node --check public/app.js && node --check src/core/quizEngine.js`
- `npm test`
- `npm run build`
- Local Chrome CDP check confirmed `public/data/criteria-similarity.json` loads in the browser.

## Result

- `1.2.1 정보자산 식별` sample now yields nearby criteria such as `1.2.2`, `1.1.4`, `1.2.4`, `1.2.3` instead of weakly related cross-domain options.
- Criteria-choice mode is now driven by a prebuilt semantic criteria graph artifact.

## Remaining Risks

- This is a deterministic semantic graph built from token/concept evidence and existing graph relations. It does not use external embedding vectors yet.

## Knowledge Promotion

- No cross-project durable knowledge promotion needed.
