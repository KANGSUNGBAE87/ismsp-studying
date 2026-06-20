import assert from "node:assert/strict";
import test from "node:test";

import {
  STUDY_MODES,
  createWrongNoteSession,
  extractWrongNoteRef,
} from "../src/core/quizEngine.js";

const bank = {
  criteria: {
    "2.7.1": { code: "2.7.1", name: "암호정책 적용", domain: "2.보호대책 요구사항", groupCode: "2.7.", requirement: "암호정책을 수립하여 적용하여야 한다." },
    "2.7.2": { code: "2.7.2", name: "암호키 관리", domain: "2.보호대책 요구사항", groupCode: "2.7.", requirement: "암호키를 안전하게 관리하여야 한다." },
    "2.2.1": { code: "2.2.1", name: "주요 직무자 지정 및 관리", domain: "2.보호대책 요구사항", groupCode: "2.2.", requirement: "주요 직무자를 지정하고 관리하여야 한다." },
    "2.2.2": { code: "2.2.2", name: "직무 분리", domain: "2.보호대책 요구사항", groupCode: "2.2.", requirement: "권한 오남용 방지를 위해 직무를 분리하여야 한다." },
    "1.1.1": { code: "1.1.1", name: "경영진의 참여", domain: "1.관리체계 수립 및 운영", groupCode: "1.1.", requirement: "경영진의 참여 체계를 수립하여야 한다." },
    "3.1.1": { code: "3.1.1", name: "개인정보 수집·이용", domain: "3.개인정보 처리단계별 요구사항", groupCode: "3.1.", requirement: "개인정보를 적법하게 수집·이용하여야 한다." },
  },
  similarCriteriaByCode: {
    "2.7.1": ["2.7.2", "2.2.1", "2.2.2", "1.1.1", "3.1.1"],
    "2.2.2": ["2.2.1", "2.7.1", "2.7.2", "1.1.1", "3.1.1"],
  },
  defectCasePool: [
    { id: "d-1", defectCase: "비밀번호와 인증키가 소스코드에 평문으로 저장된 경우", criteriaCode: "2.7.1", criteriaName: "암호정책 적용" },
  ],
  checkItemPool: [
    { id: "c-1", question: "권한 오남용 방지를 위한 직무 분리 기준을 운영하고 있는가?", criteriaCode: "2.2.2", criteriaName: "직무 분리", displayBadge: "가상자산", sourceVariant: "virtualAsset" },
  ],
};

test("createWrongNoteSession rebuilds five-option questions from saved refs", () => {
  const refs = [
    { mode: STUDY_MODES.DEFECT_CRITERION, sourceId: "d-1" },
    { mode: STUDY_MODES.CHECK_ITEM, sourceId: "c-1" },
  ];
  const session = createWrongNoteSession(bank, refs, { count: 10, seed: 5 });

  assert.equal(session.mode, STUDY_MODES.WRONG_NOTE);
  assert.equal(session.questions.length, 2);
  for (const question of session.questions) {
    assert.equal(question.type, "single");
    assert.equal(question.options.length, 5);
    assert.equal(question.options.filter((option) => option.isCorrect).length, 1);
  }
});

test("createWrongNoteSession dedupes refs and caps to count", () => {
  const refs = [
    { mode: STUDY_MODES.DEFECT_CRITERION, sourceId: "d-1" },
    { mode: STUDY_MODES.DEFECT_CRITERION, sourceId: "d-1" }, // duplicate
    { mode: STUDY_MODES.CHECK_ITEM, sourceId: "c-1" },
  ];
  assert.equal(createWrongNoteSession(bank, refs, { count: 10, seed: 3 }).questions.length, 2);
  assert.equal(createWrongNoteSession(bank, refs, { count: 1, seed: 3 }).questions.length, 1);
});

test("createWrongNoteSession skips refs whose source no longer exists", () => {
  const refs = [{ mode: STUDY_MODES.DEFECT_CRITERION, sourceId: "does-not-exist" }];
  assert.equal(createWrongNoteSession(bank, refs, { count: 10, seed: 1 }).questions.length, 0);
});

test("the same wrong-note item reshuffles options across seeds", () => {
  const refs = [{ mode: STUDY_MODES.DEFECT_CRITERION, sourceId: "d-1" }];
  const a = createWrongNoteSession(bank, refs, { count: 1, seed: 1 }).questions[0];
  const b = createWrongNoteSession(bank, refs, { count: 1, seed: 99 }).questions[0];
  assert.notEqual(
    a.options.map((option) => option.code).join(","),
    b.options.map((option) => option.code).join(","),
  );
});

test("extractWrongNoteRef recovers {mode, sourceId} from a rebuilt question", () => {
  const refs = [{ mode: STUDY_MODES.CHECK_ITEM, sourceId: "c-1" }];
  const question = createWrongNoteSession(bank, refs, { count: 1, seed: 7 }).questions[0];
  const ref = extractWrongNoteRef(question);
  assert.equal(ref.mode, STUDY_MODES.CHECK_ITEM);
  assert.equal(ref.sourceId, "c-1");
});
