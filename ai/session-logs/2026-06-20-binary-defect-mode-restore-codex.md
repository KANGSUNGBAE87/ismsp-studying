# 2026-06-20 Binary Defect Mode Restore

Actor: codex

## User Request

Re-check the adjacent/session history and restore the previously agreed flow:

- Hide the old five-option `결함사항 판단문 공부` mode from the home UI.
- Add the two binary defect-judgment drills:
  - `결함판단 틀린거 1개 찾기`
  - `결함판단 올바른거 1개 찾기`
- Reduce the default visible question count to 10.
- Confirm whether session logs were being cross-referenced correctly.

## Source Checked

- Memory thread id `019ec0e9-d531-7c81-89bd-298db948c280` pointed to the older
  lean quiz UI cleanup session, not the binary-mode implementation.
- The binary-mode requirement was in
  `ai/session-logs/2026-06-19-binary-defect-judgment-modes-codex.md`.
- The canonical implementation plan also recorded the intended 10-question
  default under `Ten-Question Incorrect-Judgment Default`.

## Diagnosis

- The engine still had `defect-judgment-correct` and
  `defect-judgment-incorrect`.
- The app shell had regressed after rollback:
  - home still showed the old `defect-judgment` card;
  - browser default session size was still initialized from saved `50`;
  - binary judgment questions were rendered as `type: single`, but the prompt
    path still used criterion-matching copy.
- Session logs do not automatically reference each other. The latest UI
  rollback/session note had preserved graph logic but did not re-apply the
  binary-mode UI decision.

## Files Changed

- `public/app.js`
  - Import `DEFAULT_SESSION_COUNT`.
  - Default state now starts in `defect-judgment-incorrect`.
  - Visible mode list now shows incorrect-judgment, correct-judgment,
    defect-criterion, and check-item modes.
  - The old five-option defect judgment mode remains engine-only/hidden.
  - Session-size options are fixed to `10`.
  - Stale stored session sizes normalize back to `10`.
  - Binary judgment prompts now use the question's own judgment prompt.
- `src/i18n.js`
  - Replaced old visible mode copy with the two binary-mode labels and
    descriptions.
  - Added `selectOneJudgment` copy.
- `tests/appModeSource.test.mjs`
  - Added regression coverage for hidden old mode, visible binary modes,
    default 10-question state, and binary prompt routing.

## Verification

- TDD red checks:
  - `tests/appModeSource.test.mjs` first failed because the visible binary modes
    and default 10-question browser state were missing.
  - A second red check failed because binary questions still used the
    criterion-matching prompt.
- `node --test tests/appModeSource.test.mjs`
  - 4/4 pass after fixes.
- `node --check public/app.js && node --check src/i18n.js && node --check src/core/quizEngine.js`
  - exit 0.
- `npm test`
  - 36/36 pass.
- `npm run build`
  - built 8 static entries plus source tree into `dist/`.
- Chrome CDP check at `http://127.0.0.1:4181/`, viewport `360x780`, after
  seeding localStorage `sessionSize=50`:
  - home cards:
    - `defect-judgment-incorrect`
    - `defect-judgment-correct`
    - `defect-criterion`
    - `check-item`
  - old `결함사항 판단문 공부` visible: false.
  - session-size options: only `10`, selected.
  - first binary drill renders `문항 1 / 10`.
  - prompt: `다음 결함사례에 대한 틀린 심사원 판단을 고르시오.`
  - option count: 2.
  - horizontal overflow: false.

## Risks

- The engine still keeps the old five-option mode for compatibility and future
  experiments. It is intentionally hidden from the home UI.
- Session logs remain independent Markdown files. Future rollback/reapply work
  should check the canonical implementation plan plus the newest relevant
  session log, not just one memory thread id.

## Knowledge Promotion

- Project-specific recovery only. No cross-project knowledge promotion needed.
