import assert from "node:assert/strict";
import test from "node:test";

import {
  createCheckItemSession,
  createDefectCriterionSession,
  createSession,
  createStudySession,
  evaluateAnswer,
  evaluateSingleAnswer,
  explainCheckItemAnswer,
  explainDefectCriterionAnswer,
  explainIncorrectOption,
  getQuestionStats,
  normalizeCount,
} from "../src/core/quizEngine.js";

const bank = {
  criteria: {
    "1.1.1": { code: "1.1.1", name: "경영진의 참여", domain: "관리체계" },
    "2.1.1": { code: "2.1.1", name: "정책의 유지관리", domain: "보호대책" },
    "3.1.1": { code: "3.1.1", name: "개인정보 수집·이용", domain: "개인정보" },
  },
  falsePool: Array.from({ length: 12 }, (_, index) => ({
    id: `f-${index + 1}`,
    statement: `틀린 판단문 ${index + 1}`,
    criteriaCode: index % 2 ? "1.1.1" : "2.1.1",
    criteriaName: index % 2 ? "경영진의 참여" : "정책의 유지관리",
    defectCase: `결함사례 F${index + 1}`,
    isCorrect: false,
  })),
  truePool: Array.from({ length: 8 }, (_, index) => ({
    id: `t-${index + 1}`,
    statement: `옳은 판단문 ${index + 1}`,
    criteriaCode: index % 2 ? "3.1.1" : "1.1.1",
    criteriaName: index % 2 ? "개인정보 수집·이용" : "경영진의 참여",
    defectCase: `결함사례 T${index + 1}`,
    isCorrect: true,
  })),
};

test("createSession builds questions with three false options and two true options", () => {
  const session = createSession(bank, { count: 3, seed: 7 });

  assert.equal(session.questions.length, 3);
  for (const question of session.questions) {
    assert.equal(question.options.length, 5);
    assert.equal(question.options.filter((option) => option.isCorrect).length, 2);
    assert.equal(question.options.filter((option) => !option.isCorrect).length, 3);
    assert.equal(new Set(question.options.map((option) => option.id)).size, 5);
  }
});

test("evaluateAnswer only accepts exactly the two correct option ids", () => {
  const session = createSession(bank, { count: 1, seed: 11 });
  const question = session.questions[0];
  const correctIds = question.options
    .filter((option) => option.isCorrect)
    .map((option) => option.id);
  const wrongId = question.options.find((option) => !option.isCorrect).id;

  assert.deepEqual(evaluateAnswer(question, correctIds), {
    status: "correct",
    isCorrect: true,
    selectedCount: 2,
    correctCount: 2,
  });
  assert.equal(evaluateAnswer(question, [correctIds[0]]).status, "incomplete");
  assert.equal(evaluateAnswer(question, [correctIds[0], wrongId]).status, "wrong");
  assert.equal(evaluateAnswer(question, [...correctIds, wrongId]).status, "invalid-count");
});

test("normalizeCount caps sessions to the available true and false pools", () => {
  assert.equal(normalizeCount(50, bank), 4);
  assert.equal(normalizeCount(2, bank), 2);
  assert.equal(normalizeCount("not-a-number", bank), 4);
});

test("getQuestionStats summarizes answered questions", () => {
  const session = createSession(bank, { count: 2, seed: 23 });
  const first = session.questions[0];
  const second = session.questions[1];
  const firstCorrect = first.options.filter((option) => option.isCorrect).map((option) => option.id);
  const secondWrong = [
    second.options.find((option) => option.isCorrect).id,
    second.options.find((option) => !option.isCorrect).id,
  ];

  const stats = getQuestionStats(session.questions, {
    [first.id]: firstCorrect,
    [second.id]: secondWrong,
  });

  assert.equal(stats.total, 2);
  assert.equal(stats.answered, 2);
  assert.equal(stats.correct, 1);
  assert.equal(stats.scorePercent, 50);
});

test("explainIncorrectOption finds the original correct mapping for the same defect case", () => {
  const falseOption = {
    id: "f-md5-key",
    statement:
      "개인정보취급자 및 정보주체의 비밀번호에 대하여 일방향 암호화를 적용하였으나, 안전하지 않은 MD5 알고리즘을 사용한 경우 2.7.2 암호키 관리 결함에 해당한다.",
    criteriaCode: "2.7.2",
    criteriaName: "암호키 관리",
    defectCase:
      "개인정보취급자 및 정보주체의 비밀번호에 대하여 일방향 암호화를 적용하였으나, 안전하지 않은 MD5 알고리즘을 사용한 경우",
    isCorrect: false,
  };
  const explanation = explainIncorrectOption(falseOption, {
    criteria: {
      "2.7.1": { code: "2.7.1", name: "암호정책 적용", requirement: "암호정책을 적용하여야 한다." },
      "2.7.2": { code: "2.7.2", name: "암호키 관리", requirement: "암호키를 관리하여야 한다." },
    },
    truePool: [
      {
        id: "t-md5",
        statement:
          "개인정보취급자 및 정보주체의 비밀번호에 대하여 일방향 암호화를 적용하였으나, 안전하지 않은 MD5 알고리즘을 사용한 경우 2.7.1 암호정책 적용 결함에 해당한다.",
        criteriaCode: "2.7.1",
        criteriaName: "암호정책 적용",
        defectCase:
          "개인정보취급자 및 정보주체의 비밀번호에 대하여 일방향 암호화를 적용하였으나, 안전하지 않은 MD5 알고리즘을 사용한 경우",
        isCorrect: true,
      },
    ],
  });

  assert.equal(explanation.matchType, "exact");
  assert.equal(explanation.correctCriteriaCode, "2.7.1");
  assert.match(explanation.summary, /2\.7\.2 암호키 관리가 아니라 2\.7\.1 암호정책 적용/);
});

test("explainIncorrectOption falls back to similar original defect cases when wording changed", () => {
  const falseOption = {
    id: "f-modified",
    statement:
      "개인정보취급자 퇴직 시 개인정보처리시스템 접근 권한은 회수되었지만 VPN 권한이 남은 경우 2.6.6 원격접근 통제 결함에 해당한다.",
    criteriaCode: "2.6.6",
    criteriaName: "원격접근 통제",
    defectCase:
      "개인정보취급자 퇴직 시 개인정보처리시스템 접근 권한은 회수되었지만 VPN 권한이 남은 경우",
    isCorrect: false,
  };
  const explanation = explainIncorrectOption(falseOption, {
    criteria: {
      "2.2.5": {
        code: "2.2.5",
        name: "퇴직 및 직무변경 관리",
        requirement: "퇴직 및 직무변경 시 접근권한을 회수하여야 한다.",
      },
      "2.6.6": { code: "2.6.6", name: "원격접근 통제", requirement: "원격접근을 통제하여야 한다." },
    },
    truePool: [
      {
        id: "t-retire",
        statement:
          "개인정보취급자 퇴직 시 개인정보처리시스템의 접근 권한은 지체 없이 회수되었지만, 출입통제 시스템 및 VPN 등 일부 시스템의 접근 권한이 회수되지 않은 경우 2.2.5 퇴직 및 직무변경 관리 결함에 해당한다.",
        criteriaCode: "2.2.5",
        criteriaName: "퇴직 및 직무변경 관리",
        defectCase:
          "개인정보취급자 퇴직 시 개인정보처리시스템의 접근 권한은 지체 없이 회수되었지만, 출입통제 시스템 및 VPN 등 일부 시스템의 접근 권한이 회수되지 않은 경우",
        isCorrect: true,
      },
    ],
  });

  assert.equal(explanation.matchType, "similar");
  assert.equal(explanation.correctCriteriaCode, "2.2.5");
  assert.match(explanation.originalDefectCase, /출입통제 시스템 및 VPN/);
});

test("explainIncorrectOption explains when no original mapping can be recovered", () => {
  const explanation = explainIncorrectOption(
    {
      id: "f-unknown",
      statement: "문제은행에 없는 임의 결함사례는 2.7.2 암호키 관리 결함에 해당한다.",
      criteriaCode: "2.7.2",
      criteriaName: "암호키 관리",
      defectCase: "문제은행에 없는 임의 결함사례",
      isCorrect: false,
    },
    {
      criteria: {
        "2.7.2": { code: "2.7.2", name: "암호키 관리", requirement: "암호키를 관리하여야 한다." },
      },
      truePool: [
        {
          id: "t-md5",
          statement:
            "개인정보취급자 및 정보주체의 비밀번호에 대하여 일방향 암호화를 적용하였으나, 안전하지 않은 MD5 알고리즘을 사용한 경우 2.7.1 암호정책 적용 결함에 해당한다.",
          criteriaCode: "2.7.1",
          criteriaName: "암호정책 적용",
          defectCase:
            "개인정보취급자 및 정보주체의 비밀번호에 대하여 일방향 암호화를 적용하였으나, 안전하지 않은 MD5 알고리즘을 사용한 경우",
          isCorrect: true,
        },
      ],
    },
  );

  assert.equal(explanation.matchType, "none");
  assert.match(explanation.summary, /이 조합은 문제은행에서 오답 후보로 생성된 판단문입니다/);
});

// --- Criterion-choice study modes (modes 2 and 3) ---

const studyBank = {
  criteria: {
    "2.2.1": {
      code: "2.2.1",
      name: "주요 직무자 지정 및 관리",
      domain: "2.보호대책 요구사항",
      groupCode: "2.2.",
      groupName: "인적 보안",
      requirement: "주요 직무자를 지정하고 직무를 관리하여야 한다.",
    },
    "2.2.2": {
      code: "2.2.2",
      name: "직무 분리",
      domain: "2.보호대책 요구사항",
      groupCode: "2.2.",
      groupName: "인적 보안",
      requirement: "권한 오남용 방지를 위해 직무를 분리하여야 한다.",
    },
    "2.2.3": {
      code: "2.2.3",
      name: "보안 서약",
      domain: "2.보호대책 요구사항",
      groupCode: "2.2.",
      groupName: "인적 보안",
      requirement: "임직원의 보안 서약을 받아야 한다.",
    },
    "2.2.4": {
      code: "2.2.4",
      name: "인식제고 및 교육훈련",
      domain: "2.보호대책 요구사항",
      groupCode: "2.2.",
      groupName: "인적 보안",
      requirement: "교육훈련을 수행하여야 한다.",
    },
    "2.2.5": {
      code: "2.2.5",
      name: "퇴직 및 직무변경 관리",
      domain: "2.보호대책 요구사항",
      groupCode: "2.2.",
      groupName: "인적 보안",
      requirement: "퇴직 및 직무변경 시 접근권한을 회수하여야 한다.",
    },
    "1.1.1": {
      code: "1.1.1",
      name: "경영진의 참여",
      domain: "1.관리체계 수립 및 운영",
      groupCode: "1.1.",
      groupName: "관리체계 기반 마련",
      requirement: "경영진의 참여 체계를 수립하여야 한다.",
    },
    "3.1.1": {
      code: "3.1.1",
      name: "개인정보 수집·이용",
      domain: "3.개인정보 처리단계별 요구사항",
      groupCode: "3.1.",
      groupName: "개인정보 수집 시 보호조치",
      requirement: "개인정보를 적법하게 수집·이용하여야 한다.",
    },
  },
  similarCriteriaByCode: {
    "2.2.1": ["2.2.2", "2.2.3", "2.2.4", "2.2.5", "1.1.1", "3.1.1"],
    "2.2.2": ["2.2.1", "2.2.3", "2.2.4", "2.2.5", "1.1.1", "3.1.1"],
  },
  defectCasePool: [
    {
      id: "d-1",
      defectCase: "주요 직무자에 대한 권한 분리가 이루어지지 않은 경우",
      criteriaCode: "2.2.2",
      criteriaName: "직무 분리",
      sourceRow: 10,
    },
    {
      id: "d-2",
      defectCase: "주요 직무자를 지정하지 않고 관리대장을 운영하지 않은 경우",
      criteriaCode: "2.2.1",
      criteriaName: "주요 직무자 지정 및 관리",
      sourceRow: 11,
    },
  ],
  checkItemPool: [
    {
      id: "c-1",
      question: "가상자산 취급업소의 직무 분리 기준을 수립하여 운영하고 있는가?",
      criteriaCode: "2.2.2",
      criteriaName: "직무 분리",
      groupCode: "2.2.",
      groupName: "인적 보안",
      domain: "2.보호대책 요구사항",
      sourceSheet: "1.7 확인(통합)",
      sourceRow: 5,
      sourceVariant: "virtualAsset",
      displayBadge: "가상자산",
      keywords: "직무 분리",
    },
    {
      id: "c-2",
      question: "주요 직무자를 지정하고 직무자 변경 이력을 관리하고 있는가?",
      criteriaCode: "2.2.1",
      criteriaName: "주요 직무자 지정 및 관리",
      groupCode: "2.2.",
      groupName: "인적 보안",
      domain: "2.보호대책 요구사항",
      sourceSheet: "1.7 확인(통합)",
      sourceRow: 6,
      sourceVariant: "integrated",
      displayBadge: "",
      keywords: "주요 직무자",
    },
  ],
};

function optionCodes(question) {
  return question.options.map((option) => option.code);
}

test("createDefectCriterionSession builds single-answer five-criterion questions", () => {
  const session = createDefectCriterionSession(studyBank, { count: 2, seed: 5 });

  assert.equal(session.mode, "defect-criterion");
  assert.equal(session.questions.length, 2);

  for (const question of session.questions) {
    assert.equal(question.type, "single");
    assert.equal(question.options.length, 5);
    assert.equal(question.options.filter((option) => option.isCorrect).length, 1);
    assert.equal(new Set(optionCodes(question)).size, 5);
    // Every option resolves to a known criterion with a name.
    for (const option of question.options) {
      assert.ok(studyBank.criteria[option.code], `unknown code ${option.code}`);
      assert.equal(option.name, studyBank.criteria[option.code].name);
    }
    // The body shows the original defect case, not a finished judgment sentence.
    assert.match(question.body, /직무|주요 직무자/);
  }
});

test("defect criterion distractors are drawn only from similarCriteriaByCode", () => {
  const session = createDefectCriterionSession(studyBank, { count: 1, seed: 9 });
  const question = session.questions[0];
  const correct = question.options.find((option) => option.isCorrect).code;
  const allowed = new Set([correct, ...studyBank.similarCriteriaByCode[correct]]);

  for (const option of question.options) {
    assert.ok(allowed.has(option.code), `${option.code} not in similar list`);
  }
});

test("createCheckItemSession carries a virtual-asset badge and single answer", () => {
  const session = createCheckItemSession(studyBank, { count: 2, seed: 3 });

  assert.equal(session.mode, "check-item");
  const virtualQuestion = session.questions.find((question) => question.badge === "가상자산");
  assert.ok(virtualQuestion, "expected a virtual-asset badged question");
  assert.equal(virtualQuestion.type, "single");
  assert.equal(virtualQuestion.options.length, 5);
  assert.equal(virtualQuestion.options.filter((option) => option.isCorrect).length, 1);
  assert.match(virtualQuestion.body, /\?$/);
});

test("the same source item yields a different option order or set across seeds", () => {
  const a = createDefectCriterionSession(studyBank, { count: 1, seed: 1 });
  const b = createDefectCriterionSession(studyBank, { count: 1, seed: 2 });
  // Same first item is sampled deterministically only within a seed; across two
  // seeds the option order (or distractor set) should differ.
  const codesA = optionCodes(a.questions[0]).join(",");
  const codesB = optionCodes(b.questions[0]).join(",");
  assert.notEqual(codesA, codesB);
});

test("evaluateSingleAnswer accepts only the single correct option id", () => {
  const session = createDefectCriterionSession(studyBank, { count: 1, seed: 13 });
  const question = session.questions[0];
  const correct = question.options.find((option) => option.isCorrect);
  const wrong = question.options.find((option) => !option.isCorrect);

  assert.equal(evaluateSingleAnswer(question, correct.id).status, "correct");
  assert.equal(evaluateSingleAnswer(question, correct.id).isCorrect, true);
  assert.equal(evaluateSingleAnswer(question, wrong.id).status, "wrong");
  assert.equal(evaluateSingleAnswer(question, null).status, "incomplete");
});

test("explainDefectCriterionAnswer explains the correct criterion on a wrong pick", () => {
  const session = createDefectCriterionSession(studyBank, { count: 1, seed: 21 });
  const question = session.questions[0];
  const correct = question.options.find((option) => option.isCorrect);
  const wrong = question.options.find((option) => !option.isCorrect);

  const explanation = explainDefectCriterionAnswer(question, wrong.id, studyBank);
  assert.equal(explanation.correctCriteriaCode, correct.code);
  assert.equal(explanation.selectedCriteriaCode, wrong.code);
  assert.ok(explanation.summary.includes(correct.code));
});

test("explainCheckItemAnswer explains the correct criterion for a confirmation item", () => {
  const session = createCheckItemSession(studyBank, { count: 1, seed: 4 });
  const question = session.questions[0];
  const correct = question.options.find((option) => option.isCorrect);
  const wrong = question.options.find((option) => !option.isCorrect);

  const explanation = explainCheckItemAnswer(question, wrong.id, studyBank);
  assert.equal(explanation.correctCriteriaCode, correct.code);
  assert.ok(explanation.details.length > 0);
});

test("createStudySession dispatches by mode", () => {
  assert.equal(
    createStudySession(studyBank, { mode: "defect-criterion", count: 1, seed: 7 }).mode,
    "defect-criterion",
  );
  assert.equal(
    createStudySession(studyBank, { mode: "check-item", count: 1, seed: 7 }).mode,
    "check-item",
  );
  assert.equal(
    createStudySession(bank, { mode: "defect-judgment", count: 1, seed: 7 }).mode,
    "defect-judgment",
  );
});
