# 2026-06-19 Win Full OCR Planning

Actor: codex

## User Request

After confirming completed extractions and the Win OCR pilot, produce the final plan for how to restart and proceed with full `win모의고사` extraction.

## Decisions Made

- Extract all Win mock-exam pages locally with OCR first, but do not send all pages to an LLM.
- Store full OCR as a private analysis warehouse.
- Classify pages and extract ISMS-P candidates after OCR.
- Use Claude/Gemini only for ambiguous candidate review or OCR disputes.
- Do not wire Win-derived content into `public/data` until review and rewrite policy are settled.
- Start with one full PDF before all 12 PDFs.

## Files Changed

- `ai/plans/2026-06-19-win-full-ocr-extraction-plan.md`
  - Added the final implementation plan for full Win OCR extraction.

## Verification

- Plan persisted under project-local `ai/plans/`.
- No code changes were made in this planning-only step.

## Next Step

Implement Task 1 through Task 5 from the plan:

1. Add full OCR warehouse mode.
2. Add page classification.
3. Pair questions with answer explanations.
4. Extract ISMS-P candidate items.
5. Run one full PDF, `2025_F_공개(총2회).pdf`, before all 12 PDFs.

## Knowledge Promotion

No global knowledge-store promotion yet. This is project-specific execution planning.
