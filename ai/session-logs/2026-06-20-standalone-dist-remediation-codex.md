# Session Log

- Date: 2026-06-20
- Actor: codex
- Task: t_cab03467
- Project: ISMSP / standalone dist remediation

## User request

Make `dist/` standalone-runnable after `t_6eb08cce`.

## Decisions

- Tried the Antigravity runner first per control-plane rules, but agy required Google OAuth and timed out, so the task fell back to direct Codex implementation.
- Kept the fix bundlerless and minimal: copy the entire `src/` tree into `dist/src/` so the existing ESM import paths in `public/app.js` continue to resolve when `dist/` is served statically.
- Preserved the existing build/test flow and only adjusted the build artifact layout.

## Files changed

- `scripts/build.mjs`
- `stages/30_BUILD_REPORT.md`
- `stages/t_cab03467_antigravity_task.md`
- `stages/t_cab03467_antigravity_output.md`
- `stages/t_cab03467_antigravity_status.json`

## Commands / verification

- `python3 /Users/kangsungbae/.hermes/profiles/dev-builder/bin/run_antigravity_worker.py --profile dev-builder --workspace /Users/kangsungbae/Documents/ismsp-studying --task-file /Users/kangsungbae/Documents/ismsp-studying/stages/t_cab03467_antigravity_task.md --output /Users/kangsungbae/Documents/ismsp-studying/stages/t_cab03467_antigravity_output.md --json-status /Users/kangsungbae/Documents/ismsp-studying/stages/t_cab03467_antigravity_status.json --timeout 180 --verbose`
- `npm test` → exit 0, 32/32 passing
- `npm run build` → exit 0, built 8 static entries plus src tree into `dist`
- Static fetch check on `http://127.0.0.1:4188`:
  - `/public/app.js` → 200 text/javascript
  - `/src/core/quizEngine.js` → 200 text/javascript
  - `/src/i18n.js` → 200 text/javascript
  - `/src/platform/adapters.js` → 200 text/javascript

## Remaining risks

- The build still mirrors `src/` verbatim, so future imports added under `src/` should remain compatible, but any new non-src static assets will still need to be copied explicitly.
- Human review is still required before this development-stage remediation can be considered approved.

## Knowledge-store promotion status

- Reusable knowledge candidate identified: bundlerless ESM apps that import from `../src/*` can be made standalone-runnable by copying the whole `src/` tree into `dist/src/` during build.
- No secrets or auth data were recorded.
