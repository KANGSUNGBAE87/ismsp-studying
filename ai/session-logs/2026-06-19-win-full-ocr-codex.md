# 2026-06-19 Win Mock Full OCR Extraction

Actor: codex

## User Request

Use subagents and start full extraction for all `win모의고사` problem PDFs so the app can later build an ISMS-P criteria-selection question bank.

## Decisions Made

- Treat `win모의고사` extraction as analysis data only for now.
- Keep generated artifacts under `ai/analysis/`; do not wire them into app runtime data yet.
- Use local macOS Vision OCR plus bundled Poppler rendering.
- Reuse the previous reviewer subagent for blocker review before the full run.
- Preserve the raw OCR page warehouse so later parser improvements can reuse `--ocr-input` without rerunning OCR.

## Files Changed

- `scripts/extract-win-mock-exam-criteria-bank.py`
  - Added whole-PDF and whole-directory OCR flow with `--ocr-all`.
  - Added `--ocr-input` reuse flow.
  - Added OCR JSONL and page-index outputs.
  - Added repeated exam-set `setIndex` handling and unique question/answer IDs.
  - Prevented notice/legal numbered bullets from becoming fake questions.
  - Prevented zero-option questions from being treated as matched or draft-usable.
  - Added `optionCount` and `answerOptions` to candidate items for validation.
- `tests/winMockExamExtraction.test.mjs`
  - Added regression coverage for notice bullets, repeated question numbers, reference pages, and candidate item metadata.
- `ai/analysis/win-mockexam-ocr-pages.jsonl`
  - Generated raw OCR page warehouse for all 12 PDFs.
- `ai/analysis/win-mockexam-page-index.json`
  - Generated page-kind index for all OCR pages.
- `ai/analysis/win-mockexam-criteria-question-bank.json`
  - Generated parsed Win mock-exam candidate question bank.
- `.graphifyignore`
  - Excluded bulky generated OCR/page-index/question-bank analysis outputs from Graphify source scans.

## Subagent Review

- Initial reviewer subagent blocked full extraction because numbered notice/reference lines and repeated `1.` questions could create fake questions and ID collisions.
- Fixed the blockers and reran tests.
- Reviewer then returned `APPROVE_FULL_RUN`.
- After the full run, reviewer was asked for final artifact sanity review.

## Commands And Verification

```bash
python3 -m py_compile scripts/extract-win-mock-exam-criteria-bank.py
npm test
time python3 scripts/extract-win-mock-exam-criteria-bank.py \
  --ocr-all \
  --source-dir '/Users/kangsungbae/Downloads/win모의고사' \
  --ocr-output ai/analysis/win-mockexam-ocr-pages.jsonl \
  --page-index-output ai/analysis/win-mockexam-page-index.json \
  --output ai/analysis/win-mockexam-criteria-question-bank.json \
  --batch-size 24
wc -l ai/analysis/win-mockexam-ocr-pages.jsonl
python3 -m py_compile scripts/extract-win-mock-exam-criteria-bank.py && npm test
/Users/kangsungbae/.codex/bin/graphify update . --no-cluster
```

## Final Counts

- Runtime: 1:00:22.66.
- Source PDFs: 12.
- OCR rows: 2,480.
- OCR errors: 0.
- Parsed questions: 867.
- Answer/explanation blocks: 1,437.
- Criteria-related questions: 307.
- Matched-answer questions: 394.
- Candidate items: 596.
- Draft-usable candidate items: 191.
- Needs-review candidate items: 405.

## Quality Checks

- Unique question IDs: 867/867.
- Unique answer IDs: 1,437/1,437.
- Unique candidate IDs: 596/596.
- Zero-option matched questions: 0.
- Zero-option draft-usable candidates: 0.
- Minimum option count among draft-usable candidates: 2.
- Local absolute path leakage in generated bank/index: false.
- Copyright boilerplate leakage in generated bank/index: false.
- Final tests: 25/25 passing.
- Project Graphify refresh: completed with 1,890 nodes and 42,751 edges.

## Remaining Risks

- This is OCR-derived and heuristic-parsed data, not a hand-verified final question bank.
- `draft_usable` means structurally usable as a candidate source; it still needs domain review before being treated as exam-quality content.
- `needs_review` rows are intentionally retained for later manual/AI filtering.
- Some pages are classified as `other` or `reference_material`; those may contain useful material but are not yet converted into problem items.

## Next Steps

1. Review `draft_usable` candidate samples by year/type.
2. Create a curated runtime bank from selected candidate rows only.
3. Add a UI mode for Win mock-exam criteria-selection practice after curation.
4. Keep `ai/analysis/win-mockexam-ocr-pages.jsonl` as the raw source for future parser refinements.

## Knowledge Promotion

Project-specific session evidence only. No global knowledge-store promotion yet.
