# 2026-06-19 Binary Defect Judgment Modes

Actor: codex

## User Request

Hide the existing defect judgment training mode and add two separate judgment modes:

- Find the one correct defect judgment.
- Find the one incorrect defect judgment.

The user also suggested deriving two judgment statements per defect case from analyzed/newly generated mappings.

## Decisions Made

- Keep the old five-option/two-incorrect mode in the engine for compatibility and hidden weak-review logic.
- Remove the old mode from the home screen.
- Add two visible two-option modes:
  - `defect-judgment-correct`
  - `defect-judgment-incorrect`
- Generate each binary item from one true defect-case anchor and one runtime false judgment derived from similar criteria.
- Keep `isCorrect` as the semantic truth of the judgment and use `answerTarget` to decide whether the selected answer should be the correct or incorrect judgment.

## Files Changed

- `src/core/quizEngine.js`
  - Added new study modes.
  - Added binary defect judgment session builders.
  - Updated single-answer evaluation to honor `answerTarget`.
- `public/app.js`
  - Replaced the old visible defect judgment mode with two new binary modes.
  - Rendered binary judgment questions as defect-case body plus two judgment statements.
  - Added judgment-specific review behavior.
- `src/i18n.js`
  - Added Korean/English labels and prompts for the two new modes.
- `tests/quizEngine.test.mjs`
  - Added TDD coverage for both binary modes and dispatch behavior.

## Verification

- TDD red phase:
  - New tests failed because the modes did not exist and `createStudySession` fell back to `defect-judgment`.
- Green phase:
  - `npm test`: 27/27 passing.
- Browser QA:
  - Opened `http://127.0.0.1:4173/`.
  - Confirmed home now shows four modes:
    - correct defect judgment
    - incorrect defect judgment
    - defect-to-criterion
    - check-item-to-criterion
  - Confirmed the old five-option defect judgment mode is hidden from home.
  - Confirmed correct-judgment mode shows one defect case and two judgment statements.
  - Confirmed incorrect-judgment mode accepts the generated false judgment as the answer and shows explanation.
- Project Graphify refresh:
  - Completed with `graphify update . --no-cluster`.

## Remaining Risks

- The false judgment is derived from graph/similar criteria heuristics. It is useful for training but should still be treated as generated content.
- The old `ismsp-defect-bank` remains the runtime source for now; this change changes the visible training mode, not the whole data-layer migration.

## Knowledge Promotion

Project-specific implementation evidence only. No global knowledge-store promotion yet.
