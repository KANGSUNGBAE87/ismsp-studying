# 2026-06-16 Graph Personalization Planning

Actor: codex

## User Request

Review GPT's final "ISMS-P 오답노트 그래프화 로직 구현 기획안 초안", identify
anything to revise, and produce the final planning document for changing the
first defect-judgment mode into a graph-based weak-problem flow.

## Decisions Made

- Keep GPT's Criteria-centered graph model, but correct it to match this
  project's actual assets.
- Replace the first mode direction with `틀린 판단 2개 찾기`: five options should
  contain three correct judgment statements and two incorrect judgment statements.
- Treat existing wrong-note rows as initial weak-area seeds only because they do
  not contain the wrong option the user selected.
- Use future app attempts to build real confusion pairs, recency weighting, and
  personalized weak scores.
- Keep Graph/Neo4j-style exports optional. The static app should consume JSON
  graph assets and browser-local attempt data.
- Keep basic training and explanations free; treat personalized weak-problem
  sessions and deeper diagnostics as ad/unlock or paid candidates.

## Files Changed

- `ai/plans/2026-06-16-defect-judgment-graph-personalization-plan.md`
- `ai/plans/product-plan.md`

## Verification

- Read the GPT attached draft.
- Read Claude's existing project-corrected graph plan.
- Checked current repository status before editing.
- Confirmed `public/data/synth-distractors.json` contains 2,442 synthetic
  distractors and `public/data/synth-family-a.json` contains 2,286 family-A
  distractors.

## Remaining Risks

- Current wrong-note workbook has numbered blank rows; graph import must count
  only rows with text and criteria code, and report blank numbered rows.
- Existing untracked data/scripts from the question-bank enhancement work remain
  outside this planning change.
- Monetization details need a separate Apps in Toss / Google Play policy check
  before implementation.

## Next Steps

- Implement `scripts/build-wrongnote-graph.py`.
- Switch defect judgment mode evaluation to "select two incorrect judgments".
- Add graph-backed weak-problem sampling and the `취약한 문제 보기` submode.

## Knowledge Store Promotion

- No cross-project knowledge promotion required. This is project-specific
  product and implementation planning.
