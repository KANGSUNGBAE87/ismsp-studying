---
version: 0.3
status: verified
updated: 2026-06-13
canonical: true
---

# Review

## 2026-06-13 Three Study Modes (claude)

### Verification
- `npm test`: 15/15 passed (7 existing + 8 new criterion-choice tests).
- `node --check` on `public/app.js` and `src/core/quizEngine.js`: passed.
- Data extraction (`python3 scripts/extract-defect-bank.py`): criteria 101,
  truePool 381, falsePool 1143, defectCasePool 381, checkItemPool 496,
  virtualAssetCheckItems 56, unknownCodes 0. All similar/check-item criterion
  codes exist in the 101-code master.
- Live browser QA (local static server, Claude Preview):
  - Home shows three mode cards + session-size/language controls + bank meta.
  - `결함사항 기준맞추기`: defect-case body, five `code + name` options, single
    answer; wrong pick highlights correct (green) / chosen (red) and the
    explanation reads "2.1.3 정보자산 관리가 아니라 1.1.6 자원 할당 …"; weak-area
    tally increments.
  - `확인사항 기준맞추기`: confirmation body, five criterion options; virtual-asset
    item renders the `가상자산` badge.
  - Mobile viewport (375px): `scrollWidth === clientWidth`, no horizontal
    overflow; layout stacks to one column.
  - No console errors.

### Remaining Risks
- Source question/body text stays Korean even in English UI (prompts/labels are
  localized; defect-case and check-item bodies are original Korean by design).
- `1.5 확인(금융)` finance variant is not yet a separate mode/badge.
- Still local/static: no backend, login, sync, ads, IAP, or native shell.

---

## 2026-06-13 First Implementation (codex)

## Verification

- `npm test`
  - 7 tests passed.
- `node --check public/app.js`
  - syntax check passed.
- `node --check src/core/quizEngine.js`
  - syntax check passed.
- Inline explanation data check:
  - MD5 wrong `2.7.2` maps back to `2.7.1 암호정책 적용`.
  - retired-access/VPN wrong `2.6.6` maps back to `2.2.5 퇴직 및 직무변경 관리`.
  - promotional/sales outsourcing wrong `3.5.1` maps back to `3.3.2 개인정보 처리 업무 위탁`.
- Data validation:
  - 101 criteria
  - 381 true judgment rows
  - 1,143 false judgment rows
  - 0 unknown criteria codes
- Browser QA at `http://127.0.0.1:4173/`
  - 5 options rendered for current question.
  - 50-question navigation rendered.
  - Korean title rendered.
  - English locale switch rendered `ISMS-P Defect Judgment Drill`.
  - Option selection and answer checking worked.
  - Mobile viewport had no horizontal overflow.
  - Browser console errors: none after favicon fix.
- In-app Browser QA for the inline-explanation update:
  - Attempted on `http://127.0.0.1:4173/`.
  - Blocked by Browser Use URL policy before page reload/interaction.
- Graphify refresh:
  - `/Users/kangsungbae/.codex/bin/graphify update . --no-cluster`
  - Rebuilt `graphify-out/graph.json` with 760 nodes and 3,322 edges after the inline-explanation update and log refresh.
- Understand-Anything:
  - Deterministic project scan generated `.understand-anything/intermediate/scan-result.json`.
  - Full UA knowledge graph generation was not completed because the available flow requires subagent phases not exposed in this tool session.

## Remaining Risks

- The app currently imports only the defect-test workbook and one-line hints. Confirmation-question self-test mode is not implemented yet.
- Source question text remains Korean even in English UI mode.
- Inline explanation UI should still be visually checked in a browser session that can access `http://127.0.0.1:4173/`.
- No backend or account sync exists yet; local state is browser-local only.
- Understand-Anything full graph should be generated in a session where the `/understand` subagent workflow is available.

## Change Log

- 2026-06-13 [claude]: Verified three study modes (data, engine, UI) with 15/15 tests and desktop + mobile browser QA via Claude Preview.
- 2026-06-13: Verified inline false-option explanation logic and recorded browser-policy QA limitation.
- 2026-06-13: Added first implementation review and QA record.
