---
version: 0.1
status: implemented
updated: 2026-06-13
canonical: true
---

# Design Plan

## Product Surface

The first screen is the quiz tool itself, not a landing page. The layout is a three-column work surface:

- left: session controls, score, question navigation
- center: current prompt and five answer options
- right: answer review, weak-area summary, question-bank metadata

On mobile the columns stack vertically with no horizontal overflow.

## Palette

- Background: `#f5f7fb`
- Surface: `#ffffff`
- Secondary surface: `#eef5f4`
- Primary action: `#146c6c`
- Accent: `#d98c28`
- Success: `#16803a`
- Warning: `#a16207`
- Error: `#bd3b22`
- Text: `#17202a`
- Border: `#d7e0e4`

The palette is intentionally restrained for repeated study use, with teal for primary action, amber for selected state, green/red for grading, and neutral grays for dense text.

## Motion And React Bits

This is a plain JavaScript app, so React Bits was not installed. The design uses light CSS transitions only and includes reduced-motion handling.

## i18n

Korean is the default. English is selectable from the first implementation. UI copy lives in `src/i18n.js`; source question text remains Korean because the imported ISMS-P materials are Korean.

## Change Log

- 2026-06-13: Created implemented design plan for the first static quiz app.
