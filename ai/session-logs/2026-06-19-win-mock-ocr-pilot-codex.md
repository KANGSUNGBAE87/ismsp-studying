# 2026-06-19 Win Mock OCR Pilot

Actor: codex

## User Request

Proceed with the reordered plan for using subagents, Antigravity/Gemini, Claude, and Codex to build a `win모의고사` OCR pilot for ISMS-P criteria-related question-bank extraction.

## Decisions Made

- Keep the Win mock-exam pipeline separate from the existing Google Classroom text-PDF extractor.
- Use analysis-only output first under `ai/analysis/`; do not wire data into `public/data` or the app runtime yet.
- Use bundled Poppler `pdftoppm` for PDF page rendering and macOS Vision for local OCR.
- Use Antigravity/Gemini for OCR feasibility checks and page-kind sampling, not as the main permanent batch pipeline.
- Mark answers with explanations but no answer marker as `explanation_only`.

## Files Changed

- `.gitignore`
  - Added `tmp/` for local OCR/rendering scratch files.
- `scripts/vision-ocr.swift`
  - Added macOS Vision OCR helper for rendered images.
- `scripts/extract-win-mock-exam-criteria-bank.py`
  - Added selected-page Win mock-exam extraction pilot.
- `tests/winMockExamExtraction.test.mjs`
  - Added fixture-based parser regression tests.
- `ai/analysis/win-mockexam-criteria-question-bank.json`
  - Generated first real pilot output.
- `ai/plans/implementation-plan.md`
  - Recorded the implemented pilot and next step.

## Commands And Verification

- Antigravity auth/model check:
  - `/Users/kangsungbae/.local/bin/agy -p 'Reply with exactly: AGY_AUTH_OK' --print-timeout 45s`
  - `/Users/kangsungbae/.local/bin/agy models`
- OCR feasibility:
  - Rendered sample pages from `2025_F_공개(총2회).pdf`.
  - Antigravity/Gemini successfully identified cover, question, and answer-explanation pages.
- TDD verification:
  - First test failed because `scripts/extract-win-mock-exam-criteria-bank.py` did not exist.
  - Added implementation and reran tests.
- Final verification:
  - `npm test`: 23/23 passing after review fixes.
  - `python3 -m py_compile scripts/extract-win-mock-exam-criteria-bank.py`: passing.
- Real pilot generation:
  - `python3 scripts/extract-win-mock-exam-criteria-bank.py --pdf '/Users/kangsungbae/Downloads/win모의고사/2025_F_공개(총2회).pdf' --pages 82-83,150-151 --output ai/analysis/win-mockexam-criteria-question-bank.json`
  - Result: 3 questions, 3 answer-explanation blocks, 2 matched answers, 2 criteria-related questions.

## Review Fixes

- A reviewer subagent initially blocked the pilot for two P1 issues:
  - count-type question body being absorbed into option 1,
  - OCR failures being silently ignored.
- Fixed those and related P2 issues:
  - count-type question bodies are restored to `stem`, while option 1 remains a short count choice such as `0개`;
  - `ocrError` now fails fast;
  - criteria labels added from explanations stay aligned with official labels;
  - OCR copyright/footer suffixes are removed;
  - stale rendered PNGs are deleted before rerendering selected pages;
  - generated source summaries store only PDF basenames, not local absolute paths.
- Regenerated `ai/analysis/win-mockexam-criteria-question-bank.json`.
- Verified the regenerated pilot has no local `/Users/...` path and no copyright boilerplate text.
- Reviewer subagent rechecked the fixes and reported no remaining blocker.

## Remaining Risks

- The current pilot requires manual page ranges.
- Full extraction needs automatic exam-set and answer-section boundary detection.
- Some question layouts place criterion claims inside the body rather than ordinary answer options.
- OCR may damage markers such as `[ 해설 ]`, circled numbers, or Korean text. Current code handles one observed explanation-marker variant but more variants will appear.
- Generated Win data remains analysis-only until reviewed.

## Next Steps

1. Detect per-PDF exam sections and answer sections automatically.
2. Add confidence flags and `needsReview` rows.
3. Extract a larger sample from one full PDF.
4. Ask Claude/reviewer to inspect sample quality before app integration.
5. Only after review, transform selected rows into runtime `public/data`.

## Knowledge Promotion

No global knowledge-store promotion yet. This is still project-specific implementation evidence.
