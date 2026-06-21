# 2026-06-19 Collected Criteria Question Opportunities

Actor: codex

## Question

What criteria-related ISMS-P problems exist in the collected data, and what can the app do with them?

## Data Sources

- `public/data/ismsp-defect-bank.json`
  - 101 criteria.
  - 381 true judgment items.
  - 1,143 false judgment items.
  - 381 defect cases.
  - 496 check items.
  - 56 virtual-asset check items.
- `ai/analysis/google-classroom-criteria-question-bank.json`
  - 54 answer PDFs.
  - 534 parsed questions.
  - 212 criteria-related questions.
  - 345 criteria-selection items.
  - 252 usable draft items.
  - 93 needs-review items.
- `ai/analysis/win-mockexam-criteria-question-bank.json`
  - 12 source PDFs.
  - 867 parsed question blocks.
  - 307 criteria-related questions.
  - 596 candidate items.
  - 191 draft-usable candidates.
  - 405 needs-review candidates.
- `public/data/wrongnote-graph.json`
  - 5,127 nodes.
  - 30,468 edges.
- `public/data/wrongnote-match-report.json`
  - 132 imported wrong notes exact-matched.
  - 174 blank numbered rows.

## Criteria-Related Problem Types

### Verified-ish Core Bank

Source: `ismsp-defect-bank.json`

This is the safest app-runtime source. It supports:

- Defect judgment training.
- Defect-case-to-criteria matching.
- Check-item-to-criteria matching.
- Virtual-asset confirmation-item mode.
- Similar criteria distractors.
- Wrong-answer explanations from known criteria mappings.

### Google Classroom Criteria Selection

Source: `google-classroom-criteria-question-bank.json`

This source is useful for criteria-selection training after curation.

- Total criteria-selection items: 345.
- Usable draft: 252.
- Needs review: 93.
- Typical form: short scenario or judgment statement with a claimed criterion code.

Top observed criteria include:

- `3.1.2 개인정보 수집 제한`
- `1.1.2 최고책임자의 지정`
- `1.4.1 법적 요구사항 준수 검토`
- `3.1.3 주민등록번호 처리 제한`
- `1.1.3 조직 구성`
- `1.2.1 정보자산 식별`
- `2.5.1 사용자 계정 관리`
- `2.5.6 접근권한 검토`

### Win Mock Exam Candidates

Source: `win-mockexam-criteria-question-bank.json`

This source is broader and noisier because it comes from OCR, but it is valuable for real-exam-like patterns.

Candidate type counts:

- `auditor_judgment`: 228 total, 101 draft usable, 127 needs review.
- `criteria_choice`: 105 total, 40 draft usable, 65 needs review.
- `defect_count`: 27 total, 9 draft usable, 18 needs review.
- `policy_or_law`: 131 total, 26 draft usable, 105 needs review.
- `needs_review`: 105 total, 15 draft usable, 90 needs review.

Draft-usable top criteria signals:

- `2.5.1 사용자 계정 관리`
- `2.6.1 네트워크 접근`
- `2.6.2 정보시스템 접근`
- `1.2.1 정보자산 식별`
- `2.10.1 보안시스템 운영`
- `1.4.1 법적 요구사항 준수 검토`
- `2.6.7 인터넷 접속 통제`
- `2.9.4 로그 및 접속기록 관리`
- `2.1.1 정책의 유지관리`
- `2.7.1 암호정책 적용`

## What We Can Build

### P0: Immediately Buildable

Use only verified-ish app-runtime data.

- Weak criteria review mode.
  - Use wrongnote graph, match report, and criteria summary.
- Criteria card mode.
  - Show requirement, check items, defect cases, similar criteria, and common traps.
- Virtual-asset check-item mode.
  - Use the 56 virtual-asset check items.
- Stronger explanations.
  - Compare selected wrong criterion with the correct criterion and similar criteria.

### P1: Build After Curation

Use Google and Win candidates only after a review queue.

- Google criteria-selection practice.
  - Start from the 252 usable draft items.
- Win real-exam-pattern practice.
  - Start from the 191 draft-usable candidates.
- Source/year/problem-pack filters.
  - Use retained source filenames, page numbers, and question numbers.
- Reviewer queue.
  - Promote reviewed items from draft to verified runtime bank.

### P2: Later Premium Or Ads

Only after curation and product validation.

- Weekly weak-point pack.
- Criteria mastery roadmap.
- Virtual-asset premium pack.
- Reviewed real-exam-style pack.
- Reward ad for extra practice after a completed session.

## Key Risk

- `draft_usable` is not the same as verified.
- Google and Win source provenance/copyright should be treated conservatively.
- `needs_review` rows should not be user-facing.
- Win data is OCR-derived, so question boundaries, answer matching, and option parsing can still be wrong.

## Recommendation

Do not merge Google/Win OCR candidates into the existing verified-ish defect bank yet.

Recommended sequence:

1. Expose weak criteria review and criteria cards from the existing verified-ish bank.
2. Add a `draft source review queue` for Google/Win candidates.
3. Promote reviewed items into a separate curated runtime file.
4. Then add a real-exam-pattern practice mode from curated items only.
