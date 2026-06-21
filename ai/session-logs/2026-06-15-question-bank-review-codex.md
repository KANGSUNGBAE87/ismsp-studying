# 2026-06-15 Question Bank Review Prep

Actor: codex

## User Request

- Check how far Claude progressed.
- Review the question-bank enhancement plan, especially the wrong-answer generation logic.
- Prepare what Codex should check later when asked to review the implementation, including possible improvements.

## Current Stage

- Stage: review / planning.
- No code or generated data was changed by Codex in this session.
- Codex updated review/session artifacts only.

## Findings

- Claude's 2026-06-13 three-mode app implementation remains verified. `npm test` passed 15/15.
- 2026-06-15 question-bank work has progressed beyond planning:
  - Family A synthesis script and output exist.
  - Family B source batches, generated candidates, one verified batch, and merged output exist.
  - The synthesized distractors are not yet integrated into the runtime app.
- Generated output snapshot:
  - `public/data/synth-family-a.json`: 2,286 Family A items.
  - `public/data/synth-distractors.json`: 2,442 total items, 2,286 Family A and 156 Family B.
  - No invalid criterion codes or duplicate statements were found in the merged output.
  - Family B verified output currently has 153 keep, 3 revise, 0 reject.

## Decisions / Review Direction

- Treat the current generated data as a candidate bank, not as production app data.
- Before runtime integration, clarify whether the target is 3,000 total false judgments or 3,000 synthesized distractors in addition to the original 1,143 workbook false items.
- Family B needs a separate explanation model because its wrongness is "this transformed statement is not a defect," not "this defect maps to a different criterion." Existing wrong-criterion explanations are not sufficient.

## Verification Run

- `npm test` -> 15/15 passed.
- JSON checks via `jq`/`node`:
  - merged total 2,382.
  - invalid criterion codes 0.
  - duplicate statements 0.
  - missing required core fields 0.

## Remaining Risks

- Family B verification may be under-strict because verified batches had no rejects.
- B6/B7 traps can accidentally turn into valid edge-case defects if the exception/approval condition is not actually enough under the ISMS-P requirement.
- Family A difficulty is heuristic-only and should be calibrated or at least sampled.
- The app has no tests yet for loading or sampling synthesized distractors.

## Next Steps

- Ask Claude to finish or explain Family B generation/verification for the remaining batches.
- Run a stratified manual/LLM review sample for A1/A2/A3 and B1-B10, weighted toward B6/B7/B10.
- Add runtime integration tests before merging the synthesized bank into the app.
- Project Graphify was refreshed after the review/session artifacts were written.

## Knowledge Store Promotion

- No cross-project knowledge promoted. Findings are project-specific and recorded in `ai/reviews/review.md`.
