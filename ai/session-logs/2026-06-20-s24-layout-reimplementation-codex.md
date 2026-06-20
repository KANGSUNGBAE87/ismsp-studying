# 2026-06-20 S24 Layout Reimplementation

Actor: codex

## User Request

Re-apply the adjacent-session S24 mobile layout review improvements because the
current local state looked like the older layout.

## Decisions Made

- Keep the existing ISMS-P visual palette; this was a layout-density fix, not a
  rebrand. Design preflight checked the palette/source requirement and React
  Bits was not applicable because this is a vanilla static app.
- Keep the quiz action buttons in a sticky footer so the answer action stays in
  the mobile thumb zone.
- Add a quiz-local mobile question navigator, but hide the side-panel question
  navigator on mobile to avoid "quick move" and "question move" duplication.
- Collapse long false-option detail evidence behind a native `details`
  disclosure so answer checking does not expand every rationale into a very
  long page.
- Remove unrelated premium CTA and analytics remnants from the current dirty
  working tree because they were not part of this layout request and could
  confuse the quiz flow.

## Files Changed

- `public/app.js`
  - Added mobile question navigation in the quiz panel.
  - Moved action buttons into `quiz-footer-slot`.
  - Collapsed false-option details with `details/summary`.
  - Kept selected-vs-correct answer summary for judgment questions.
- `public/styles.css`
  - S24/mobile ordering: quiz first, side panel second, review third.
  - Mobile side question nav hidden; quiz-local nav displayed as horizontal
    chips.
  - Touch targets raised to 44px/46px.
  - Sticky footer styling added.
- `src/i18n.js`
  - Added `detailEvidence` copy in Korean and English.
- `tests/mobileLayoutSource.test.mjs`
  - Rewritten as a regression guard for this mobile layout behavior.
- Removed unrelated untracked analytics artifacts:
  - `src/analytics.js`
  - `tests/analytics.test.mjs`

## Verification

- `node --test tests/mobileLayoutSource.test.mjs`
  - 4/4 pass after failing first on the old/current behavior.
- `node --check public/app.js && node --check src/i18n.js && node --check src/platform/adapters.js`
  - exit 0.
- `npm test`
  - 32/32 pass.
- `npm run build`
  - built 5 static entries into `dist/`.
- Chrome DevTools Protocol check at `http://127.0.0.1:4181/`, viewport
  `360x780`:
  - quiz order `1`, side order `2`, review order `3`.
  - mobile nav display `block`, side nav display `none`.
  - mobile nav buttons `50`.
  - option explanation details `2`, open details `0`.
  - premium CTA count `0`.
  - horizontal overflow `false`, scroll width `360`.
  - check button min-height `46px`.
  - footer position `sticky`, bottom `0px`.

## Risks

- This session did not run the in-app browser plugin because its Node runtime
  bootstrap failed with missing sandbox metadata. A direct Chrome headless/CDP
  check was used instead.
- The worktree still has many pre-existing graph/OCR/question-bank changes.
  This session only targeted the mobile layout and removed unrelated analytics
  remnants.

## Next Steps

- If 성배님 wants the adjacent-session binary "정답 1개/오답 1개 찾기" modes visible
  again, re-expose those modes separately from this layout fix.

## Knowledge Promotion

- No cross-project durable knowledge promotion needed. This is project-specific
  UI/layout behavior.
