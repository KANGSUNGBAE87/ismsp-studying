# 2026-06-21 Wrong-note Feature + Ad Monetization Wiring

Actor: claude

## User Request

- Build "취약기준 문제모음집"(wrong-note) first, local-only: remember the questions
  the user got wrong (all 4 modes) and re-serve the same question later, but with
  shuffled options. Gate it behind a rewarded ad (1 watch = 10 questions; to do
  more, leave and watch again).
- Bottom banner on every screen.
- "새 세션" button limited to 2/2; at 0/2 show "광고 보고 더 풀기" (rewarded).
- Interstitial on home return.
- MUST follow the global ad-error rule recorded earlier.

## Ad-error rule applied (global memory: rewarded-ad bugfix)

- Reward is granted ONLY on `userEarnedReward` (never close/dismiss/network).
- `dismissed` waits a grace window (500ms) because the reward event can arrive late.
- Unlock persists by an id (`wnActive` bundle) so reopening an unfinished bundle
  does NOT require re-watching the ad (relock-bug guard).
- Debug/stub path is isolated from the real Apps in Toss SDK path.

## Decisions / Design

- New `AdsAdapter` (`createAdsAdapter`) keeps Apps in Toss / Google Play SDK out
  of product logic. Web/preview has a confirm-based stub; real path uses
  `showFullScreenAd({adGroupId, onEvent})`.
- Wrong-note storage = list of `{mode, sourceId}` in localStorage. Re-served via
  new engine fn `createWrongNoteSession(bank, refs, {count, seed})`; fresh seed
  reshuffles options. `extractWrongNoteRef(question)` pulls the key on a wrong check.
- All 4 modes carry `meta.sourceId`, so one shape covers judgment(correct/incorrect),
  defect-criterion, and check-item.

## Files Changed

- `src/platform/adapters.js` (createAdsAdapter)
- `src/core/quizEngine.js` (STUDY_MODES.WRONG_NOTE, createWrongNoteSession, extractWrongNoteRef)
- `tests/wrongNote.test.mjs` (new, 5 tests)
- `src/i18n.js` (wrong-note + ad copy)
- `index.html` (#ad-banner slot)
- `public/app.js` (banner mount, wrong-note entry + rewarded gate, wrong answer
  recording, new-session 2/2 + rewarded refill, home-return interstitial)
- `public/styles.css` (banner, wrong-note card, rewarded pill)

## Verification

- `node --check` on app/engine/adapters/i18n: OK.
- `npm test`: 49/49 pass (incl. 5 new wrong-note tests).
- Live preview (Claude Preview):
  - Wrong answers recorded as `{mode, sourceId}` (e.g. `{check-item, c-191}`); 3 of 6 saved.
  - Home shows wrong-note card with "모은 오답 3" + bottom SPONSORED banner.
  - Tapping it (rewarded stub) opens a re-served 3-question session with shuffled
    options; `wnActive` persisted (re-entry skips the ad).
  - New-session label cycles 2/2 → 1/2 → "▶ 광고 보고 더 풀기" → 2/2 (rewarded refill).
  - No console errors.

## Remaining / Next

- Not committed/pushed (awaiting user approval).
- Real Apps in Toss ad group ids still placeholders in `AD_PLACEMENTS`.
- Optional: remove a wrong-note ref once re-answered correctly; persist in-progress
  wrong-note state across exits; IAP (구독/평생) + "광고 제거" entitlement.
- Server-side reward verification / RewardLedger is still a stub (web-only cohort).

## Knowledge Store Promotion

- Ad-error handling rule already lives in global memory; applied here. No new
  cross-project knowledge beyond that.
