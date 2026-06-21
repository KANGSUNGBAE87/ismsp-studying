# 2026-06-19 Criteria Question Opportunities

Actor: codex

## User Request

Analyze what criteria-related questions exist in the collected ISMS-P data and, using subagents, identify what the app can do with the collected information.

## Subagents Used

- `code-mapper`
  - Reviewed criteria-related question types and samples from Win, Google Classroom, and the defect bank.
- `planner`
  - Reviewed product opportunities, data readiness, monetization timing, and curation risks.

## Decisions Made

- Treat `ismsp-defect-bank.json` as the safest verified-ish app-runtime bank.
- Treat Google Classroom and Win mock-exam outputs as draft/curation sources, not verified public app content.
- Keep `needs_review` rows out of user-facing practice.
- Use `draft_usable` only as a candidate pool for review, not as final truth.

## Key Findings

- Defect bank:
  - 101 criteria.
  - 381 true judgment items.
  - 1,143 false judgment items.
  - 381 defect cases.
  - 496 check items.
  - 56 virtual-asset check items.
- Google Classroom:
  - 534 questions.
  - 212 criteria-related questions.
  - 345 criteria-selection items.
  - 252 usable draft items.
  - 93 needs-review items.
- Win mock exam:
  - 867 parsed question blocks.
  - 307 criteria-related questions.
  - 596 candidate items.
  - 191 draft-usable candidates.
  - 405 needs-review candidates.
- Wrongnote graph:
  - 5,127 nodes.
  - 30,468 edges.
  - 132 imported wrong notes exact-matched.

## Files Added

- `ai/analysis/2026-06-19-collected-criteria-question-opportunities.md`

## Recommendation

1. Build weak criteria review and criteria cards from the verified-ish defect bank first.
2. Add a draft source review queue for Google/Win candidates.
3. Promote reviewed items into a separate curated runtime file.
4. Build real-exam-pattern practice only from curated items.

## Verification

- Counts were checked directly from the generated JSON files with Python.
- Subagent conclusions matched local counts and reinforced the verified/draft separation.

## Knowledge Promotion

Project-specific planning evidence only. No global knowledge-store promotion yet.
