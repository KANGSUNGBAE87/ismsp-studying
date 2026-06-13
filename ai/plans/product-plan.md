---
version: 0.1
status: draft
updated: 2026-06-13
canonical: true
---

# Product Plan

## Product

An ISMS-P practice app that generates questions from certification criteria, detailed check items, and defect cases.

## Basis

- Authoritative conceptual basis: `★정보보호 및 개인정보보호 관리체계 인증기준 안내서(2023.11).pdf`.
- Machine-readable criteria basis: `ISMS-P_인증기준_세부점검항목(2023.10.31).xlsx`.
- Core problem source: `ISMS-P 인증기준 결함 테스트_240712v2.xlsx`.
- Secondary problem source: `ISMS-P_인증기준_셀프테스트_20240103.xlsx`.
- Workflow reference: `인증기준 결함사례-셀프테스트 방법.pdf`.

## Current Source Understanding

- The master criteria source has 101 criteria and 328 detailed check items.
- The self-test workbook covers all 101 official criteria and provides confirmation-question, defect, generated-question, and answer-sheet structures.
- The defect-test workbook covers all 101 official criteria and provides the strongest source for generated defect-case judgment questions.
- The existing spreadsheet workflow generates 50 questions, hides answers until copied into an answer sheet, and grades selected criteria as correct/incorrect.

## MVP Scope

- Import the 101 criteria and 328 check items.
- Import defect-case correct/incorrect judgment rows.
- Generate 50-question practice sessions.
- Support at least two modes:
  - defect-case criterion matching
  - auditor judgment O/X or multiple-select
- Show answer, matching criterion, and concise hint after submission.
- Track wrong answers by criterion code.

## Deferred Scope

- OCR for image-heavy PDFs.
- Domain scenario packs such as virtual-asset exchange and finance.
- Long-form explanations from the official guide.
- Adaptive spaced repetition.

## Change Log

- 2026-06-13: Created initial product plan from source relationship analysis.
