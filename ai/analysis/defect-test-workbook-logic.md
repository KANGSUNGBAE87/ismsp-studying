---
title: ISMS-P Defect Test Workbook Logic
version: 0.1
status: draft
updated: 2026-06-13
canonical: false
---

# ISMS-P Defect Test Workbook Logic

## Workbook

`ISMS-P 인증기준 결함 테스트_240712v2.xlsx`

## Sheet Roles

- `문제 출제`: visible generated output. It links to `(참고) 출제로직` and exposes prompt, 5 answer options, and hidden/copyable answer flags.
- `답안지`: answer entry and scoring sheet. It expects each question to have exactly 2 selected options.
- `(참고) 출제로직`: randomization and question assembly engine.
- `(참고) 소스1`: structured source table that builds judgment sentences from defect case + criteria code + criteria name + truth flag.
- `(참고) 소스2`: flattened judgment statement plus truth flag.

## Source Table Logic

`(참고) 소스1` creates one judgment sentence per row:

- base defect case
- candidate certification criterion code
- candidate criterion name
- generated sentence: `<defect case> <criterion code> <criterion name> 결함에 해당한다.`
- truth flag:
  - `1`: correct defect-case-to-criterion mapping
  - `0`: wrong mapping

The sheet also assigns random numbers and ranks to source rows with `RANDBETWEEN` and `RANK.EQ`.

## Question Assembly Logic

`(참고) 출제로직` splits the source rows into two pools:

- Rows `3:1145`: false judgment pool, 1,143 rows.
- Rows `1146:1526`: true judgment pool, 381 rows.

For each generated question:

1. Pick 3 false judgment statements from the false pool.
2. Pick 2 true judgment statements from the true pool.
3. Combine those 5 statements.
4. Randomly reshuffle the 5 statements using another `RANDBETWEEN` + `RANK.EQ` pass.
5. Mark each visible option as:
   - `1` if the option is not found in the false pool.
   - `0` if the option is found in the false pool.

The visible prompt says: `ISMS-P 인증심사에서 다음 결함사례에 대한 심사원의 판단으로 옳은 것을 모두 고르시오. (2개)`.

## Visible Output Logic

`문제 출제` links directly to `(참고) 출제로직`:

- Prompt rows come from column `L` of `(참고) 출제로직`.
- Option labels come from column `H`.
- Option text comes from column `L`.
- Answer flags come from column `M`.

The current generated workbook produces 50 prompts and 250 options.

## Scoring Logic

`답안지` checks each question group of 5 options.

The intended rule is:

- User must select exactly 2 options.
- Score as correct only when both selected options have hidden answer flag `1`.
- If fewer or more than 2 options are selected, status remains `선택`.

In formula terms, the workbook does this pattern per question:

- `SUM(selected_options) = 2`
- and `SUM(selected_option * answer_flag) = 2`

## App Translation

Do not port the Excel cell layout directly. Port the logical model:

```text
question = shuffle(sample(false_pool, 3) + sample(true_pool, 2))
answer = indexes where option.is_correct == true
is_correct = selected_count == 2 and selected_set == answer_set
```

This supports the same behavior as the workbook while avoiding spreadsheet fragility.

## Noted Workbook Issue

The `답안지` summary table has one likely formula mismatch:

- `J3` checks `F28` for selection state but checks `F35` for correctness.

The per-question scoring cells remain understandable, so the app should implement the scoring rule directly rather than copying the summary-table formulas.
