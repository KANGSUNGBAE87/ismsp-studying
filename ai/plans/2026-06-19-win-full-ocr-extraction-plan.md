# Win Mock Exam Full OCR Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract all 12 `win모의고사` scanned PDFs into a local OCR text warehouse, then derive ISMS-P criteria-related question-bank candidates from that warehouse.

**Architecture:** Keep raw OCR, classified pages, extracted question/answer candidates, and app runtime data as separate stages. Use local OCR for the full 2,480 pages, then use AI only for ambiguous candidate review instead of sending every page to an LLM. Nothing from Win mock exams is wired into `public/data` until review and rewrite policy are settled.

**Tech Stack:** Python 3, bundled Poppler `pdftoppm`, macOS Vision OCR via Swift, Node test runner, existing `ai/analysis/` analysis-data convention.

---

## Current State

- Existing core workbook extraction is complete:
  - `public/data/ismsp-defect-bank.json`
  - 101 criteria
  - 381 correct defect cases
  - 1,143 false judgment statements
  - 496 check items
  - 56 virtual-asset-specific check items
- Google Classroom PDF extraction is complete:
  - `ai/analysis/google-classroom-criteria-question-bank.json`
  - 54 answer PDFs
  - 534 questions
  - 212 criteria-related questions
  - 345 criteria-selection candidates
  - 252 usable draft candidates
  - 93 review-needed candidates
- Win mock-exam OCR pilot is complete:
  - `ai/analysis/win-mockexam-criteria-question-bank.json`
  - pilot source: `2025_F_공개(총2회).pdf`
  - pilot pages: `82-83,150-151`
  - 3 questions
  - 3 answer-explanation blocks
  - 2 matched answers
  - 2 criteria-related questions
- Remaining Win source volume:
  - 12 PDFs
  - 2,480 total pages
  - 4 pages already used for real extraction pilot
  - 2,476 pages remain for full OCR extraction

## Product Decision

Do not try to immediately turn every extracted question into app content.

The first product value is a private analysis warehouse:

1. Preserve page-level OCR text with provenance.
2. Classify pages into question, answer-explanation, cover/notice, reference/material, and other.
3. Extract only structured candidates likely to help ISMS-P learning.
4. Keep low-confidence candidates in `needsReview`.
5. Use Claude/Gemini only on candidates, not all pages.
6. Rewrite or transform reviewed candidates before public app release.

## Target Artifacts

- Create: `ai/analysis/win-mockexam-ocr-pages.jsonl`
  - One JSON object per OCR page.
  - Fields:
    - `sourceId`
    - `fileName`
    - `pageNumber`
    - `text`
    - `textChars`
    - `ocrError`
    - `renderDpi`
    - `generatedAt`
- Create: `ai/analysis/win-mockexam-page-index.json`
  - One summarized page record per page.
  - Fields:
    - `sourceId`
    - `fileName`
    - `pageNumber`
    - `pageKind`
    - `questionNumbers`
    - `answerNumbers`
    - `criteriaCodes`
    - `hasCriteriaCode`
    - `hasAuditorJudgmentTerms`
    - `confidence`
- Create or extend: `ai/analysis/win-mockexam-criteria-question-bank.json`
  - Candidate-level extraction output.
  - Fields:
    - `sources`
    - `counts`
    - `questions`
    - `answers`
    - `candidateItems`
    - `needsReview`
- Modify: `scripts/extract-win-mock-exam-criteria-bank.py`
  - Keep existing pilot behavior.
  - Add full OCR and page-index modes without breaking selected-page pilot mode.
- Modify: `tests/winMockExamExtraction.test.mjs`
  - Add tests for OCR JSONL generation from fixture page text.
  - Add tests for page classification.
  - Add tests for question-answer pairing.
  - Add tests for `needsReview` classification.

## Execution Plan

### Task 1: Add Full OCR Warehouse Mode

**Files:**
- Modify: `scripts/extract-win-mock-exam-criteria-bank.py`
- Test: `tests/winMockExamExtraction.test.mjs`

- [ ] Add CLI options:
  - `--ocr-all`
  - `--ocr-output ai/analysis/win-mockexam-ocr-pages.jsonl`
  - `--page-index-output ai/analysis/win-mockexam-page-index.json`
  - `--source-dir /Users/kangsungbae/Downloads/win모의고사`
- [ ] Keep `--pdf --pages` pilot mode working.
- [ ] Render each page to PNG, OCR it, append one JSONL row, then allow temporary PNG cleanup.
- [ ] Fail fast on OCR errors unless `--allow-ocr-errors` is explicitly passed.
- [ ] Test that fixture OCR rows produce stable JSONL-style objects.
- [ ] Run:
  - `npm test -- tests/winMockExamExtraction.test.mjs`
  - `python3 -m py_compile scripts/extract-win-mock-exam-criteria-bank.py`

### Task 2: Add Page Classification

**Files:**
- Modify: `scripts/extract-win-mock-exam-criteria-bank.py`
- Test: `tests/winMockExamExtraction.test.mjs`

- [ ] Classify each OCR page into:
  - `question`
  - `answer_explanation`
  - `cover_or_notice`
  - `reference_material`
  - `blank_or_low_text`
  - `other`
- [ ] Extract page signals:
  - `questionNumbers`
  - `answerNumbers`
  - `criteriaCodes`
  - `hasCriteriaCode`
  - `hasAuditorJudgmentTerms`
  - `confidence`
- [ ] Test representative fixture pages:
  - cover page
  - question page with `①②③④⑤`
  - answer page with `N번 정답`
  - reference/material page
  - low-text page
- [ ] Run:
  - `npm test -- tests/winMockExamExtraction.test.mjs`

### Task 3: Pair Questions With Answer Explanations

**Files:**
- Modify: `scripts/extract-win-mock-exam-criteria-bank.py`
- Test: `tests/winMockExamExtraction.test.mjs`

- [ ] Use question numbers and answer numbers as the primary pairing key.
- [ ] Pair within the same `sourceId`.
- [ ] Mark pairing status:
  - `matched`
  - `explanation_only`
  - `question_only`
  - `needs_review`
- [ ] Keep answer marker extraction conservative:
  - exact circled markers first,
  - numeric marker fallback only before explanation marker,
  - never infer answer from explanation body alone.
- [ ] Test:
  - question and answer on separate pages,
  - multiple answers on one page,
  - answer explanation with damaged `{ 해설 ]` marker,
  - answer block with no answer marker.
- [ ] Run:
  - `npm test -- tests/winMockExamExtraction.test.mjs`

### Task 4: Extract ISMS-P Candidate Items

**Files:**
- Modify: `scripts/extract-win-mock-exam-criteria-bank.py`
- Test: `tests/winMockExamExtraction.test.mjs`

- [ ] Create `candidateItems` only when a question or its explanation has at least one of:
  - ISMS-P criteria code such as `2.5.1`
  - words: `인증기준`, `결함`, `심사원`, `적절하지 않은`
  - answer explanation referencing a criteria code
- [ ] Assign candidate type:
  - `criteria_choice`
  - `auditor_judgment`
  - `defect_count`
  - `policy_or_law`
  - `needs_review`
- [ ] Assign review status:
  - `draft_usable`
  - `needs_review`
  - `ignore_non_criteria`
- [ ] Keep original source text in analysis output only.
- [ ] Do not write anything to `public/data`.
- [ ] Run:
  - `npm test`

### Task 5: Run One Full PDF Before All 12

**Files:**
- Generate: `ai/analysis/win-mockexam-ocr-pages.jsonl`
- Generate: `ai/analysis/win-mockexam-page-index.json`
- Generate/Update: `ai/analysis/win-mockexam-criteria-question-bank.json`

- [ ] Run full OCR on `2025_F_공개(총2회).pdf` first.
- [ ] Check counts:
  - total pages should be 216 for that PDF.
  - OCR rows should equal 216 unless fail-fast stops.
  - page index rows should equal OCR rows.
- [ ] Inspect candidate counts:
  - questions extracted
  - answers extracted
  - matched pairs
  - criteria-related candidates
  - needs-review candidates
- [ ] Ask reviewer subagent to inspect the one-PDF result before all 12 PDFs.

### Task 6: Run All 12 PDFs

**Files:**
- Update: `ai/analysis/win-mockexam-ocr-pages.jsonl`
- Update: `ai/analysis/win-mockexam-page-index.json`
- Update: `ai/analysis/win-mockexam-criteria-question-bank.json`
- Update: `ai/session-logs/YYYY-MM-DD-win-full-ocr-codex.md`

- [ ] Run full OCR over `/Users/kangsungbae/Downloads/win모의고사`.
- [ ] Confirm:
  - source PDFs: 12
  - total pages: 2,480
  - OCR rows: 2,480 or explicit failed-page list
  - no local absolute paths in JSON outputs
  - no temporary PNG files committed
- [ ] Run summary script or inline check:
  - count by `pageKind`
  - count by `candidateType`
  - count by `reviewStatus`
  - top criteria codes found
- [ ] Run reviewer subagent on summary and sampled candidates.

### Task 7: AI Review Only On Candidates

**Files:**
- Create: `ai/analysis/win-mockexam-review-sample.json`
- Create: `ai/analysis/win-mockexam-review-report.md`

- [ ] Sample candidates by type and confidence:
  - 20 `draft_usable`
  - 20 `needs_review`
  - 10 low-confidence OCR cases
- [ ] Use Claude for correctness review:
  - Does this candidate really relate to ISMS-P criteria?
  - Is the answer mapping reliable?
  - Should it be usable, review-needed, or ignored?
- [ ] Use Antigravity/Gemini only for visual/OCR disputes:
  - compare page image with OCR text,
  - fix OCR reading where local Vision fails.
- [ ] Keep the review report in `ai/analysis/`.

### Task 8: Runtime App Integration Later

**Files:**
- Not in this phase:
  - `public/data/*`
  - `src/core/quizEngine.js`
  - `public/app.js`

- [ ] Do not integrate Win raw text into the app yet.
- [ ] Later, create a separate transformation/rewrite step:
  - source candidate -> rewritten app-safe question
  - reviewed answer -> app explanation
  - source provenance retained privately
- [ ] Only reviewed/reworked content moves into `public/data`.

## Success Criteria

- Full OCR warehouse exists for all 12 PDFs.
- OCR row count equals 2,480 or failed pages are explicitly listed.
- Page index classifies every page.
- Candidate extraction separates app-relevant ISMS-P items from general/security/law/reference material.
- No app runtime behavior changes.
- No local absolute paths in generated tracked JSON.
- No temporary PNGs are tracked.
- `npm test` passes.
- Reviewer subagent reports no blocker on the one-PDF full run before all-12 execution.

## Non-Goals

- Do not immediately publish Win mock-exam text in the app.
- Do not send 2,480 full pages to Claude/Gemini.
- Do not rely on AI for deterministic page-by-page extraction.
- Do not manually compare every page.

## Final Recommendation

Start with Task 1 through Task 5 only.

The next concrete milestone is:

> Run one full PDF, `2025_F_공개(총2회).pdf`, through the full OCR warehouse and page-index pipeline, then review the extracted candidates before expanding to all 12 PDFs.
