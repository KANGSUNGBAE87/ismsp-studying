# 2026-06-21 Quiz Feedback Layout

Actor: codex

## User Request

- Remove the redundant answer explanation card from the per-question page because false-judgment explanations already appear under the relevant option.
- Show which option the user selected and which option is the answer directly in the option area.
- Move the workbook intro/header to the top of the quiz page.
- Replace the mobile horizontal question-number scroller with a cleaner alternative.
- Remove confusing per-question weak-criteria and question-bank cards from the quiz page.

## Decisions

- Judgment-mode feedback now lives inside the option cards.
- The right-side review panel was removed from judgment-mode quiz pages.
- Option result badges use `내 선택` and `정답`.
- Mobile question navigation uses a fixed 5-by-2 grid for the 10-question session instead of horizontal scrolling.
- `취약 기준` is renamed to `내 오답 기준` for future statistics use, but it is no longer rendered on each quiz question.
- The question-bank count card remains on the home screen only.

## Files Changed

- `public/app.js`
- `public/styles.css`
- `src/i18n.js`
- `tests/mobileLayoutSource.test.mjs`

## Verification

- `node --check public/app.js`
- `node --check src/i18n.js`
- `npm test`
- `npm run build`
- Local Chrome CDP mobile viewport check at `http://127.0.0.1:4173/`

## Result

- The quiz page no longer shows `정답 해설`, `취약 기준`, or `문제은행` helper cards in judgment mode.
- The checked option state shows `내 선택` and the answer option shows `정답`.
- The mobile question nav has 10 buttons in a fixed grid and no horizontal overflow.

## Remaining Risks

- A dedicated post-session statistics screen would be a better home for `내 오답 기준`, but it was intentionally not added in this pass.

## Knowledge Promotion

- No cross-project durable knowledge promotion needed.
