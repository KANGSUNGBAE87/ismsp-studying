# Session Log

- Date: 2026-06-20
- Actor: codex
- Task: t_1f94b4cd
- Project: ISMSP / Hermes Studio operations

## User request

Apply recurrence-prevention guidance for oversized/open-ended QA cards, compare it against existing operating rules, and add durable comments to the blocked source cards.

## Decisions

- Treated the failure mode as QA/task-spec overrun rather than a product defect.
- Amended the narrowest shared operating docs instead of broad project docs.
- Recommended parking the blocked source cards and replacing them with deterministic single-outcome QA cards.

## Files changed

- `/Users/kangsungbae/Documents/지식저장소/docs/workflows/kanban-worker.md`
- `/Users/kangsungbae/Documents/지식저장소/docs/workflows/qa-review-split-policy.md`
- `/Users/kangsungbae/Documents/ismsp-studying/ai/session-logs/2026-06-20-recurrence-prevention-application-codex.md`

## Verification / notes

- Compared the diagnosis artifact against existing rules in `kanban-worker.md` and `qa-review-split-policy.md`.
- Added `[RECURRENCE_PREVENTION_APPLIED]` comments to `t_98c8d522` and `t_0039fe81`.
- No product code edits were made.

## Risks / next steps

- If future QA cards still lack explicit route/start state, allowed action, served URL/port, max_turns, and stop conditions, they may repeat the same budget-exhaustion pattern.
- Consider updating any task templates that generate browser QA cards so the minimum fields are always present.

## Knowledge-store promotion status

- Promoted reusable guardrails into `/Users/kangsungbae/Documents/지식저장소/docs/workflows/kanban-worker.md` and `/Users/kangsungbae/Documents/지식저장소/docs/workflows/qa-review-split-policy.md`.
- No secrets or project-private data were copied.
