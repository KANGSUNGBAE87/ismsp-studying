# 2026-06-16 Wrong-Note Graph Implementation

Actor: codex

## User Request

Implement the wrong-note graph logic from the final plan. Convert the first
defect-judgment mode from choosing two correct judgments to choosing two
incorrect judgments. Prepare the weak-problem follow-up feature, but keep it
hidden until after launch. Check whether subagents can be used and use them
where appropriate.

## Subagent Usage

- Spawned one read-only `code-mapper` subagent.
- Subagent confirmed the correct implementation boundary:
  - `scripts/build-wrongnote-graph.py` as a new graph-builder script.
  - `public/data/wrongnote-graph.json` and match/summary JSON as generated
    runtime data.
  - Keep weak-problem review out of `public/app.js` mode buttons.
  - Add engine/test coverage for hidden behavior.

## Decisions Made

- First visible defect-judgment mode now uses the error-hunt rule:
  - 3 true judgment statements.
  - 2 false judgment statements.
  - User must select exactly the 2 false statements.
- `isCorrect` continues to mean whether the auditor judgment statement is true.
  The new `answerTarget: "incorrect"` field determines which options are the
  answer targets.
- Hidden weak-problem support is implemented as
  `createWeakDefectJudgmentSession(...)`, but it is not exposed in the home UI.
- Wrong-note graph runtime storage uses static JSON, not Neo4j.
- Family B synthetic distractors with missing `criteriaCode` are recovered from
  the statement text and original defect-case mapping.

## Files Changed

- `src/core/quizEngine.js`
- `public/app.js`
- `src/i18n.js`
- `tests/quizEngine.test.mjs`
- `tests/wrongnoteGraph.test.mjs`
- `scripts/build-wrongnote-graph.py`
- `scripts/concept-dictionary.yml`
- `public/data/wrongnote-graph.json`
- `public/data/criteria-summary.json`
- `public/data/wrongnote-match-report.json`
- `ai/plans/implementation-plan.md`

## Generated Data

- `public/data/wrongnote-graph.json`
  - 5,127 nodes
  - 30,468 edges
  - 101 Criteria nodes
  - 496 CheckItem nodes
  - 381 DefectCase nodes
  - 3,966 JudgmentStatement nodes
  - 132 WrongNoteEntry nodes
- `public/data/wrongnote-match-report.json`
  - imported wrong-note rows: 132
  - exact matches: 132
  - blank numbered rows: 174

## Verification

- `npm test`: 18/18 passing.
- `python3 -m py_compile scripts/build-wrongnote-graph.py`: passing.
- `node --check public/app.js`: passing.
- `node --check src/core/quizEngine.js`: passing.
- Ran the real graph builder with the local wrong-note workbook and generated
  the runtime graph/summary/report files.
- `graphify update . --no-cluster`: passing; project code graph updated to
  1,685 nodes and 18,862 edges.
- Browser plugin verification attempted against `http://127.0.0.1:4173/`.
  The local static server started successfully, but the in-app browser webview
  attach timed out, so CLI/static verification was used instead.

## Remaining Risks

- `취약한 문제 보기` is intentionally hidden and not release-ready UI.
- Attempt/localStorage tracking is not implemented yet, so weak scoring still
  uses wrong-note seed and judgment/confusion data rather than live user
  behavior.
- Monetization/ad unlock policy must be checked later before exposing the
  hidden weak-problem mode.
- Understand-Anything has project config but no generated
  `.understand-anything/knowledge-graph.json` yet. Full UA analysis was left for
  a later architecture-mapping pass because this turn only required the
  wrong-note graph implementation and Graphify was refreshed successfully.

## Knowledge Store Promotion

- No cross-project knowledge promotion required. This is project-specific
  implementation detail.
