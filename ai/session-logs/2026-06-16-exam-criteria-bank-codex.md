# 2026-06-16 Exam Criteria Bank Extraction

Actor: codex

## User Request

Check whether the Google Classroom and mock-exam PDFs can be turned into a
question bank for choosing ISMS-P certification criteria.

## Decisions Made

- Treat source PDFs as private analysis inputs, not public app data.
- Store extracted source questions under `ai/analysis/` so source provenance is
  preserved and release data can later be rewritten/reviewed separately.
- Start with Google Classroom answer PDFs because they have extractable text.
- Leave `win모의고사` for a later OCR pipeline because sampled pages returned
  almost no text.

## Files Changed

- Added `scripts/extract-exam-criteria-bank.py`.
- Added `tests/examCriteriaBank.test.mjs`.
- Generated `ai/analysis/google-classroom-criteria-question-bank.json`.

## Generated Data

- Sources parsed: 54 answer PDFs.
- Parsed questions: 534.
- Criteria-related questions: 212.
- Questions with inferred answer metadata: 85.
- Option-level criteria-selection candidate items: 345.
- Draft usable criteria-selection items: 252.
- Items needing review: 93.

## Notes

- The extractor supports both Google Forms option styles:
  - `1)` style used in earlier ISMS-P daily PDFs.
  - `1.` style used in later quiz PDFs.
- For auditor wrong-judgment questions, non-answer options with claimed criteria
  are transformed into draft criteria-selection candidates.
- Answer extraction is conservative. If the source answer cannot be inferred,
  derived criteria-selection candidates are marked `needs_review`.

## Verification

- `npm test`: 20/20 passing.
- `python3 -m py_compile scripts/extract-exam-criteria-bank.py`: passing.
- Real extraction with bundled Python completed successfully.

## Remaining Risks

- The generated file contains source-question text and should stay analysis-only
  unless copyright/reuse policy is settled.
- The usable candidate flag means "safe enough for draft training data from
  source labels", not "approved for release".
- OCR is still needed for `win모의고사` PDFs.

## Knowledge Store Promotion

- No cross-project promotion yet. This is project-specific extraction work.
