---
version: 0.7
status: reviewed
updated: 2026-06-19
canonical: true
---

# Review

## 2026-06-20 Split A2 Runtime Verification (codex)

### Findings

- `npm run build` 가 현재 저장소에 존재하지 않아 task body가 요구한 build 검증을 실제로 수행할 수 없었습니다.
- 나머지 runtime/browser 항목은 통과했습니다: 360/390/430 iframe viewport에서 sticky footer / safe-area 대응 / result CTA 레이아웃 / auto-scroll 동작을 확인했습니다.
- `npm test` 는 46/46 passed 입니다.

### Verification

- `npm test` → 46/46 passed.
- `npm run build` → `Missing script: "build"`.
- Browser QA (same-origin iframe):
  - 360 / 390 / 430 viewport에서 `.quiz-footer-slot` 가 `position: sticky`, `bottom: 0` 으로 계산됨.
  - 동일 viewport들에서 `margin-left: -16px`, `padding-left: 16px` 이 적용됨.
  - 360px viewport에서 10문항 세션 완료 후 premium CTA 가 DOM/시각상 노출됨.
  - premium CTA 는 action row 바로 아래에 쌓이고 `ctaRectTopRelative: 0` 으로 겹침이 없었습니다.
  - 체크 후 scroll handler 가 실제로 동작하여 `scrollY` 변화가 관측됨.

### Verdict

- `CHANGES_REQUIRED`

## 2026-06-16 Graph-Based Distractor Logic Recheck and Feedback Fix (codex)

### Findings

- Current Family A synthesis is not graph-based sentence mixing. It copies the original defect-case body and changes only the claimed criterion.
- Existing wrong-answer source sentences should be treated as reference material, not as final generated items.
- Graph value for distractor generation should come from choosing high-similarity neighbor criteria/cases and lightly mixing a small number of semantically related slots.
- Distractor generation must reject absurd criterion attachments, copied bodies with code swaps, and pairs without meaningful shared concepts.
- The current app no longer samples original `falsePool` for the first defect-judgment mode. Runtime false options are generated as `rtf-*` from graph-similar criteria and filtered by criterion/domain/name/body overlap.

### Updated Acceptance Criteria

- The first defect-judgment mode must not draw displayed false options from original wrong-bank IDs or original wrong-bank statements.
- A generated wrong judgment must keep the source case recognizable but change only a small number of slots such as actor, evidence, scope, timing, exception, or control.
- The donor slot must come from a high-similarity criterion/case, not a random same-domain or unrelated criterion.
- Every generated item needs a concrete wrongness reason based on criterion-scope conflict, not just "different criterion."
- The app feedback must show what the user selected and what the original correct answer was.
- The app must not show learner-facing fallback text such as "문제은행에서 확인되지 않습니다" or "유사 결함사례를 찾지 못했습니다." When exact mapping is not useful, show the claimed criterion's requirement, representative check items, and representative defect cases.

### Verification

- `npm test`: 19/19 passed after switching first-mode false options to runtime graph generation.
- Real-data seed check with graph loaded: 50 questions, 100 false options, 0 original `f-*` IDs, 0 original false statement text hits.
- Headless Chrome QA at `http://127.0.0.1:4174/`: first mode rendered 2 `rtf-*` false options, 0 original false IDs, selected-vs-correct feedback, and criterion-scope explanation text.

## 2026-06-15 Question Bank Synthesis Review Prep (codex)

### Current State
- Claude's 2026-06-13 three-mode implementation remains verified: `npm test` passes 15/15.
- The 2026-06-15 question-bank work is not integrated into the app runtime yet.
- New untracked artifacts exist:
  - `ai/plans/2026-06-15-question-bank-enhancement.md`
  - `scripts/synthesize-family-a.py`
  - `scripts/merge-distractors.py`
  - `scripts/famB-batches/`
  - `scripts/famB-gen/`
  - `scripts/famB-verified/`
  - `public/data/synth-family-a.json`
  - `public/data/synth-distractors.json`

### Data Snapshot
- `public/data/synth-family-a.json`: 2,286 Family A distractors.
- `public/data/synth-distractors.json`: 2,442 merged distractors.
  - Family A: 2,286.
  - Family B: 156.
  - Invalid criterion codes: 0.
  - Duplicate statements: 0.
  - Family B verified entries in merged output: 156.
- Family B progress:
  - Source batches: 7 files, 381 input defect cases.
  - Generated: batch-00 96, batch-01 12, batch-02 60.
  - Verified: batch-00 96, batch-02 60.
  - Verified verdicts: 153 keep, 3 revise, 0 reject.

### Review Risks To Check Next
- Clarify target count: the plan says both "increase from 1,143 to about 3,000" and "3,000 synthetic plus 1,143 workbook = about 4,100 total assets." The acceptance target should be fixed before merge.
- Family B currently has `criteriaCode == correctAnswer` for every merged item. That is correct for a body-variant/non-defect trap, but it does not fit the existing wrong-criterion explanation model. Runtime handling needs a distinct "not a defect / transformed normal case" explanation path.
- Family B verification may be too permissive because verified batches produced 0 rejects. Review should sample B6/B7/B10 manually against the actual criterion requirement text.
- Family A assigns difficulty purely by group/domain relationship. That is useful as a first pass, but A1 is not always hard and A3 is not always easy; sampled calibration or post-hoc difficulty adjustment is still needed.
- The synthesized data is not yet merged into `public/data/ismsp-defect-bank.json` and is not consumed by `src/core/quizEngine.js` or `public/app.js`.

### Recommended Next Review Checklist
- Re-run structural checks: JSON schema, valid criterion codes, duplicate IDs/statements, `isCorrect:false`, and source/verification metadata.
- Validate label integrity on a stratified sample: A1/A2/A3 and B1-B10, with extra attention to B6 and B7.
- Add tests before runtime integration:
  - synthesized distractors are loaded only when verified;
  - Family A never uses a true code for the same defect case;
  - Family B uses a separate explanation path and does not call the wrong-criterion explanation as-is;
  - question sampling respects difficulty/trap-axis distribution;
  - workbook falsePool remains preserved.
- Decide whether the synthesized bank is a separate asset or folded into `falsePool`; the UI/engine contract should make that explicit.

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

- 2026-06-15 [codex]: Reviewed Claude's question-bank synthesis progress and recorded follow-up review checklist.
- 2026-06-16 [codex]: Rechecked graph-based distractor intent, removed learner-facing missing-source phrasing, and required selected-vs-correct answer feedback.
- 2026-06-13 [claude]: Verified three study modes (data, engine, UI) with 15/15 tests and desktop + mobile browser QA via Claude Preview.
- 2026-06-13: Verified inline false-option explanation logic and recorded browser-policy QA limitation.
- 2026-06-13: Added first implementation review and QA record.
