---
version: 1
status: complete
updated: 2026-06-21
canonical: false
actor: codex
---

# 2026-06-21 Korean-Only Locale Removal

## User Request

- Remove the English version because the ISMS-P exam is Korea-specific.

## Decisions

- Kept the app as Korean-only instead of preserving a hidden English locale.
- Removed the language selector from both the home screen and quiz side controls.
- Stopped reading or writing the saved `locale` browser state.
- Kept `t(locale, key)` API shape for low-risk call-site compatibility, but it now resolves only Korean copy.
- Forced the browser platform locale fallback to `ko`.

## Files Changed

- `src/i18n.js`: removed English translations and exported `DEFAULT_LOCALE`.
- `public/app.js`: removed `languages` import, locale storage, and locale select controls.
- `src/platform/adapters.js`: changed default locale to always return `ko`.
- `public/styles.css`: changed home controls to a single-column layout.
- `tests/appModeSource.test.mjs`: added a regression test that fails if English locale controls return.

## Verification

- `node --test tests/appModeSource.test.mjs`: first failed before implementation, then passed after implementation.
- `node --check src/i18n.js`
- `node --check public/app.js`
- `node --check src/platform/adapters.js`
- `npm test`: 44 tests passed.
- `npm run build`: built 9 static entries plus src tree into `dist`.
- Local static checks at `http://127.0.0.1:4173/` found no English locale or language selector strings in served `src/i18n.js` or `public/app.js`.
- `/Users/kangsungbae/.codex/bin/graphify update . --no-cluster`: rebuilt 3233 nodes and 173111 edges.

## Remaining Risks

- No functional risk found in source or static build verification.
- Existing unrelated dirty and untracked files were left untouched.

## Knowledge Store Promotion

- No cross-project reusable knowledge promoted; this is project-specific product scope.
