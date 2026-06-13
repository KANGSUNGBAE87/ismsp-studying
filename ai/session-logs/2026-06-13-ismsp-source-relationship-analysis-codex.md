# 2026-06-13 ISMS-P Source Relationship Analysis

Actor: codex

## User Request

- Analyze the provided ISMS-P files and explain their relationships.
- The user stated that the 2023.11 certification criteria guide is the basis.
- The user emphasized that defect-case self-test materials and the self-test method are the core sources for generating app questions.

## Decisions Made

- Treated the task as `knowledge + planning`.
- Used the 2023.11 guide as the conceptual basis and the 2023.10.31 detailed-check spreadsheet as the structured master.
- Classified the defect-test workbook and self-test workbook as the core question-bank sources.
- Classified one-line summary, wrong notes, lifecycle, numbers, overview, and certification-system PDFs as supporting learning/context sources.

## Files Changed

- `ai/tools/inspect_ismsp_sources.py`
- `ai/tools/build_ismsp_relationship_summary.py`
- `ai/analysis/source-inventory.json`
- `ai/analysis/source-relationship-summary.json`
- `ai/analysis/ismsp-source-relationships.md`
- `ai/analysis/defect-test-workbook-logic.md`
- `ai/plans/product-plan.md`
- `ai/session-logs/2026-06-13-ismsp-source-relationship-analysis-codex.md`

## Commands And Verification

- Loaded bundled workspace dependencies.
- Parsed spreadsheets with bundled Python and `openpyxl`.
- Parsed PDFs with bundled Python and `pypdf`.
- Generated `ai/analysis/source-inventory.json`.
- Generated `ai/analysis/source-relationship-summary.json`.
- Ran `/Users/kangsungbae/.codex/bin/graphify update . --no-cluster`; Graphify rebuilt `graphify-out/graph.json` with 638 nodes and 690 edges.
- Inspected formulas in `ISMS-P 인증기준 결함 테스트_240712v2.xlsx` with `data_only=False` to identify the question assembly and scoring formulas.

## Key Findings

- The 2023.10.31 detailed-check spreadsheet contains 101 criteria and 328 check items.
- The self-test workbook overlaps all 101 official criteria.
- The defect-test workbook has 381 correct defect-case-to-criterion pairs, 1,143 false judgment rows, and generated 50-question/250-option output.
- The defect-test workbook's generation logic is: sample 3 false judgment statements plus 2 true judgment statements, shuffle 5 options, and mark options as `1` only when they are true judgments.
- The answer-sheet scoring rule is: exactly 2 selected options and both selected options must have answer flag `1`.
- One likely summary-table formula mismatch exists at `답안지!J3`; app implementation should use the logical scoring rule rather than copying the sheet layout.
- The wrong-note workbook covers 65 official criteria and is best used for weak-area review.

## Remaining Risks

- Some PDFs are image-heavy or have weak text extraction without OCR.
- The analysis did not import the original files into the project; it references the current Downloads folder paths.
- Graphify semantic extraction remains limited because no Gemini/Google API key was available, but the local structural graph was refreshed successfully.

## Next Steps

- Build an import pipeline for the master criteria workbook and defect-test workbook.
- Normalize all question-bank rows around `criteria_code`.
- Design the first 50-question practice-session flow.

## Knowledge Store Promotion

- The relationship analysis is project-specific for `ismsp-studying`; no cross-project promotion is needed yet.
