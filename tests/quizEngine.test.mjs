import assert from "node:assert/strict";
import test from "node:test";

import {
  STUDY_MODES,
  createCheckItemSession,
  createDefectCriterionSession,
  createDefectJudgmentSession,
  createWeakDefectJudgmentSession,
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
    "1.1.1": {
      code: "1.1.1",
      name: "경영진의 참여",
      domain: "관리체계",
      requirement: "경영진 참여와 책임을 정하여야 한다.",
    },
    "2.1.1": {
      code: "2.1.1",
      name: "정책의 유지관리",
      domain: "관리체계",
      requirement: "경영진 보고와 개인정보 수집 정책을 유지관리하여야 한다.",
    },
    "3.1.1": {
      code: "3.1.1",
      name: "개인정보 수집·이용",
      domain: "관리체계",
      requirement: "개인정보 수집과 이용 기준을 정하여야 한다.",
    },
  },
  similarCriteriaByCode: {
    "1.1.1": ["2.1.1"],
    "2.1.1": ["1.1.1", "3.1.1"],
    "3.1.1": ["2.1.1"],
  },
  falsePool: Array.from({ length: 12 }, (_, index) => ({
    id: `f-${index + 1}`,
    statement: `틀린 판단문 ${index + 1}`,
    criteriaCode: index % 2 ? "1.1.1" : "2.1.1",
    criteriaName: index % 2 ? "경영진의 참여" : "정책의 유지관리",
    defectCase: `결함사례 F${index + 1}`,
    isCorrect: false,
  })),
  truePool: Array.from({ length: 12 }, (_, index) => ({
    id: `t-${index + 1}`,
    statement: `옳은 판단문 ${index + 1}`,
    criteriaCode: index % 2 ? "3.1.1" : "1.1.1",
    criteriaName: index % 2 ? "개인정보 수집·이용" : "경영진의 참여",
    defectCase:
      index % 2
        ? `개인정보 수집 정책의 유지관리 항목이 동의 화면에 누락된 경우 T${index + 1}`
        : `정보보호 정책의 유지관리 및 경영진 보고와 관련된 절차가 장기간 이행되지 않은 경우 T${index + 1}`,
    isCorrect: true,
  })),
};

test("createSession builds error-hunt questions with two false options and three true options", () => {
  const session = createSession(bank, { count: 3, seed: 7 });

  assert.equal(session.questions.length, 3);
  for (const question of session.questions) {
    assert.equal(question.options.length, 5);
    assert.equal(question.options.filter((option) => option.isCorrect).length, 3);
    assert.equal(question.options.filter((option) => !option.isCorrect).length, 2);
    assert.equal(new Set(question.options.map((option) => option.id)).size, 5);
    assert.equal(question.answerTarget, "incorrect");
    assert.ok(question.options.filter((option) => !option.isCorrect).every((option) => option.id.startsWith("rtf-")));
  }
});

test("evaluateAnswer only accepts exactly the two incorrect option ids in error-hunt mode", () => {
  const session = createSession(bank, { count: 1, seed: 11 });
  const question = session.questions[0];
  const incorrectIds = question.options
    .filter((option) => !option.isCorrect)
    .map((option) => option.id);
  const correctId = question.options.find((option) => option.isCorrect).id;

  assert.deepEqual(evaluateAnswer(question, incorrectIds), {
    status: "correct",
    isCorrect: true,
    selectedCount: 2,
    correctCount: 2,
    selectedOptionIds: incorrectIds,
    correctOptionIds: incorrectIds,
  });
  assert.equal(evaluateAnswer(question, [incorrectIds[0]]).status, "incomplete");
  assert.equal(evaluateAnswer(question, [incorrectIds[0], correctId]).status, "wrong");
  assert.equal(evaluateAnswer(question, [...incorrectIds, correctId]).status, "invalid-count");
});

test("createSession generates false options at runtime instead of sampling the original falsePool", () => {
  const scopeBank = {
    criteria: {
      "1.4.3": {
        code: "1.4.3",
        name: "관리체계 개선",
        requirement: "관리체계상의 문제점에 대한 원인을 분석하고 재발방지 대책을 수립하여야 한다.",
      },
      "2.9.3": {
        code: "2.9.3",
        name: "백업 및 복구관리",
        requirement: "백업 대상, 주기, 방법, 보관장소, 보관기간, 소산 등의 절차를 수립하여야 한다.",
      },
      "2.9.4": {
        code: "2.9.4",
        name: "로그 및 접속기록 관리",
        requirement: "로그유형, 보관기간, 보관방법 등을 정하고 안전하게 보관하여야 한다.",
      },
      "2.11.2": {
        code: "2.11.2",
        name: "취약점 점검 및 조치",
        requirement: "정보시스템 취약점 점검을 수행하고 발견된 취약점에 대해 재발방지 분석을 수행하여야 한다.",
      },
    },
    similarCriteriaByCode: {
      "1.4.3": ["2.11.2"],
      "2.9.3": ["2.9.4"],
      "2.9.4": ["2.9.3"],
      "2.11.2": ["1.4.3"],
    },
    checkItemPool: [
      {
        id: "c-backup",
        question: "백업 및 복구 절차를 수립하고 복구테스트를 수행하고 있는가?",
        criteriaCode: "2.9.3",
        keywords: "백업 복구 복구테스트",
      },
      {
        id: "c-vuln",
        question: "정보시스템 취약점 점검 절차를 수립하고 정기적으로 수행하고 있는가?",
        criteriaCode: "2.11.2",
        keywords: "취약점 점검 조치",
      },
    ],
    falsePool: [
      {
        id: "bad-management-vuln",
        statement:
          "관리체계상 문제점에 대한 재발방지 대책을 수립하고 있으나 경영진 보고가 장기간 이루어지지 않은 경우 2.11.2 취약점 점검 및 조치 결함에 해당한다.",
        defectCase:
          "관리체계상 문제점에 대한 재발방지 대책을 수립하고 있으나 경영진 보고가 장기간 이루어지지 않은 경우",
        criteriaCode: "2.11.2",
        criteriaName: "취약점 점검 및 조치",
        isCorrect: false,
      },
      {
        id: "bad-log-backup",
        statement:
          "로그 기록 대상, 방법, 보존기간, 검토 주기 기준이 없는 경우 2.9.3 백업 및 복구관리 결함에 해당한다.",
        defectCase: "로그 기록 대상, 방법, 보존기간, 검토 주기 기준이 없는 경우",
        criteriaCode: "2.9.3",
        criteriaName: "백업 및 복구관리",
        isCorrect: false,
      },
      {
        id: "good-vuln",
        statement:
          "정보시스템 취약점 점검 대상에서 일부 서버가 누락된 경우 2.11.2 취약점 점검 및 조치 결함에 해당한다.",
        defectCase: "정보시스템 취약점 점검 대상에서 일부 서버가 누락된 경우",
        criteriaCode: "2.11.2",
        criteriaName: "취약점 점검 및 조치",
        isCorrect: false,
      },
      {
        id: "good-backup",
        statement:
          "백업 대상과 복구절차가 수립되어 있지 않은 경우 2.9.3 백업 및 복구관리 결함에 해당한다.",
        defectCase: "백업 대상과 복구절차가 수립되어 있지 않은 경우",
        criteriaCode: "2.9.3",
        criteriaName: "백업 및 복구관리",
        isCorrect: false,
      },
    ],
    truePool: [
      {
        id: "t-1",
        statement: "정답 판단문 1",
        defectCase: "관리체계 개선 활동에서 취약점 점검 결과 발견된 취약점의 원인 분석 및 개선 대책을 수립하지 않은 경우",
        criteriaCode: "2.11.2",
        criteriaName: "취약점 점검 및 조치",
        isCorrect: true,
      },
      {
        id: "t-2",
        statement: "정답 판단문 2",
        defectCase: "백업 작업 로그와 복구 기록의 보관기간 기준이 수립되어 있지 않은 경우",
        criteriaCode: "2.9.3",
        criteriaName: "백업 및 복구관리",
        isCorrect: true,
      },
      {
        id: "t-3",
        statement: "정답 판단문 3",
        defectCase: "관리체계 개선 활동에서 정보시스템 취약점 점검 결과에 대한 원인 분석과 개선 조치가 지연된 경우",
        criteriaCode: "2.11.2",
        criteriaName: "취약점 점검 및 조치",
        isCorrect: true,
      },
    ],
  };

  const session = createSession(scopeBank, { count: 1, seed: 1 });
  const falseIds = session.questions[0].options.filter((option) => !option.isCorrect).map((option) => option.id);

  assert.equal(falseIds.length, 2);
  assert.ok(falseIds.every((id) => id.startsWith("rtf-")));
  assert.ok(falseIds.every((id) => !scopeBank.falsePool.some((item) => item.id === id)));
});

test("createStudySession builds a two-option drill for finding the correct defect judgment", () => {
  const session = createStudySession(bank, {
    mode: STUDY_MODES.DEFECT_JUDGMENT_CORRECT,
    count: 3,
    seed: 17,
  });

  assert.equal(session.mode, STUDY_MODES.DEFECT_JUDGMENT_CORRECT);
  assert.equal(session.questions.length, 3);
  for (const question of session.questions) {
    assert.equal(question.type, "single");
    assert.equal(question.presentation, "judgment");
    assert.equal(question.answerTarget, "correct");
    assert.ok(question.body);
    assert.equal(question.options.length, 2);
    assert.equal(question.options.filter((option) => option.isCorrect).length, 1);
    assert.equal(question.options.filter((option) => !option.isCorrect).length, 1);

    const correctId = question.options.find((option) => option.isCorrect).id;
    const incorrectId = question.options.find((option) => !option.isCorrect).id;
    assert.equal(evaluateSingleAnswer(question, correctId).status, "correct");
    assert.equal(evaluateSingleAnswer(question, incorrectId).status, "wrong");
  }
});

test("createStudySession builds a two-option drill for finding the incorrect defect judgment", () => {
  const session = createStudySession(bank, {
    mode: STUDY_MODES.DEFECT_JUDGMENT_INCORRECT,
    count: 3,
    seed: 19,
  });

  assert.equal(session.mode, STUDY_MODES.DEFECT_JUDGMENT_INCORRECT);
  assert.equal(session.questions.length, 3);
  for (const question of session.questions) {
    assert.equal(question.type, "single");
    assert.equal(question.presentation, "judgment");
    assert.equal(question.answerTarget, "incorrect");
    assert.ok(question.body);
    assert.equal(question.options.length, 2);
    assert.equal(question.options.filter((option) => option.isCorrect).length, 1);
    assert.equal(question.options.filter((option) => !option.isCorrect).length, 1);

    const correctJudgmentId = question.options.find((option) => option.isCorrect).id;
    const incorrectJudgmentId = question.options.find((option) => !option.isCorrect).id;
    assert.equal(evaluateSingleAnswer(question, incorrectJudgmentId).status, "correct");
    assert.equal(evaluateSingleAnswer(question, correctJudgmentId).status, "wrong");
  }
});

test("createStudySession defaults to ten incorrect-judgment questions", () => {
  const session = createStudySession(bank, { seed: 29 });

  assert.equal(session.mode, STUDY_MODES.DEFECT_JUDGMENT_INCORRECT);
  assert.equal(session.questions.length, 10);
  assert.equal(session.questions.every((question) => question.answerTarget === "incorrect"), true);
  assert.equal(session.questions.every((question) => question.options.length === 2), true);
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
  const firstCorrect = first.options.filter((option) => !option.isCorrect).map((option) => option.id);
  const secondWrong = [
    second.options.find((option) => !option.isCorrect).id,
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

test("createDefectJudgmentSession keeps weak problem mode hidden unless explicitly requested", () => {
  const session = createDefectJudgmentSession(bank, { count: 1, seed: 31 });
  assert.equal(session.mode, "defect-judgment");
  assert.equal(session.hiddenFeature, undefined);
});

test("createWeakDefectJudgmentSession prepares hidden weak-problem sessions without UI exposure", () => {
  const weakBank = {
    ...bank,
    truePool: [
      {
        id: "t-weak-1",
        statement: "취약 결함사례 A는 1.1.1 경영진의 참여 결함에 해당한다.",
        criteriaCode: "1.1.1",
        criteriaName: "경영진의 참여",
        defectCase: "정보보호 정책의 유지관리 및 경영진 보고와 관련된 절차가 장기간 이행되지 않은 경우 A",
        isCorrect: true,
      },
      {
        id: "t-weak-2",
        statement: "취약 결함사례 B는 1.1.1 경영진의 참여 결함에 해당한다.",
        criteriaCode: "1.1.1",
        criteriaName: "경영진의 참여",
        defectCase: "정보보호 정책의 유지관리 및 경영진 보고와 관련된 절차가 장기간 이행되지 않은 경우 B",
        isCorrect: true,
      },
      {
        id: "t-weak-3",
        statement: "취약 결함사례 C는 1.1.1 경영진의 참여 결함에 해당한다.",
        criteriaCode: "1.1.1",
        criteriaName: "경영진의 참여",
        defectCase: "정보보호 정책의 유지관리 및 경영진 보고와 관련된 절차가 장기간 이행되지 않은 경우 C",
        isCorrect: true,
      },
      ...bank.truePool,
    ],
    falsePool: [
      {
        id: "f-weak-1",
        statement: "취약 결함사례 A는 1.1.2 최고책임자의 지정 결함에 해당한다.",
        criteriaCode: "1.1.2",
        criteriaName: "최고책임자의 지정",
        defectCase: "취약 결함사례 A",
        isCorrect: false,
      },
      {
        id: "f-weak-2",
        statement: "취약 결함사례 B는 1.1.2 최고책임자의 지정 결함에 해당한다.",
        criteriaCode: "1.1.2",
        criteriaName: "최고책임자의 지정",
        defectCase: "취약 결함사례 B",
        isCorrect: false,
      },
      ...bank.falsePool,
    ],
  };
  const session = createWeakDefectJudgmentSession(
    weakBank,
    { criteriaSummary: { criteria: { "1.1.1": { weakScore: 100 } } } },
    { count: 1, seed: 42 },
  );
  const question = session.questions[0];

  assert.equal(session.hiddenFeature, "weak-problem-review");
  assert.equal(question.meta.personalized, true);
  assert.equal(question.options.filter((option) => !option.isCorrect).length, 2);
  assert.equal(question.options.filter((option) => option.isCorrect).length, 3);
  assert.ok(question.options.filter((option) => !option.isCorrect).every((option) => option.id.startsWith("rtf-")));
  assert.ok(
    question.options
      .filter((option) => !option.isCorrect)
      .every((option) => !weakBank.falsePool.some((source) => source.id === option.id)),
  );
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
      checkItemPool: [
        {
          id: "c-key",
          question: "암호키 생성, 이용, 보관, 배포 및 파기 절차를 수립하고 있는가?",
          criteriaCode: "2.7.2",
          criteriaName: "암호키 관리",
        },
      ],
      defectCasePool: [
        {
          id: "d-key",
          defectCase: "암호키 보관 위치와 접근권한을 통제하지 않은 경우",
          criteriaCode: "2.7.2",
          criteriaName: "암호키 관리",
        },
      ],
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

  assert.equal(explanation.matchType, "criteria-scope");
  assert.match(explanation.summary, /2\.7\.2 암호키 관리 결함으로 단정하기 어렵습니다/);
  assert.ok(explanation.details.some((detail) => detail.includes("기준 요구사항")));
  assert.ok(explanation.details.some((detail) => detail.includes("확인사항 예")));
  assert.ok(explanation.details.some((detail) => detail.includes("결함사례 예")));
  assert.ok(!explanation.details.join(" ").includes("문제은행에서 확인되지 않습니다"));
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

test("criterion-choice distractors prefer graph evidence across criteria defects and check items", () => {
  const evidenceBank = {
    criteria: {
      "1.2.1": {
        code: "1.2.1",
        name: "정보자산 식별",
        domain: "1.관리체계 수립 및 운영",
        groupCode: "1.2.",
        groupName: "위험 관리",
        requirement: "정보자산 분류기준을 수립하고 모든 정보자산을 식별하여 목록으로 관리하여야 한다.",
      },
      "1.2.2": {
        code: "1.2.2",
        name: "현황 및 흐름분석",
        domain: "1.관리체계 수립 및 운영",
        groupCode: "1.2.",
        groupName: "위험 관리",
        requirement: "업무 현황과 정보자산 흐름을 분석하여야 한다.",
      },
      "1.2.3": {
        code: "1.2.3",
        name: "위험 평가",
        domain: "1.관리체계 수립 및 운영",
        groupCode: "1.2.",
        groupName: "위험 관리",
        requirement: "정보자산에 대한 위험을 식별하고 평가하여야 한다.",
      },
      "1.2.4": {
        code: "1.2.4",
        name: "보호대책 선정",
        domain: "1.관리체계 수립 및 운영",
        groupCode: "1.2.",
        groupName: "위험 관리",
        requirement: "위험 평가 결과에 따라 정보자산 보호대책을 선정하여야 한다.",
      },
      "1.1.4": {
        code: "1.1.4",
        name: "범위 설정",
        domain: "1.관리체계 수립 및 운영",
        groupCode: "1.1.",
        groupName: "관리체계 기반 마련",
        requirement: "관리체계 범위 내 정보자산과 서비스를 명확히 설정하여야 한다.",
      },
      "2.10.2": {
        code: "2.10.2",
        name: "클라우드 보안",
        domain: "2.보호대책 요구사항",
        groupCode: "2.10.",
        groupName: "시스템 및 서비스 보안관리",
        requirement: "클라우드 서비스 이용 시 관리자 접근 및 보안 설정 보호대책을 수립하여야 한다.",
      },
    },
    similarCriteriaByCode: {
      "1.2.1": ["2.10.2", "1.2.2", "1.2.3", "1.2.4"],
    },
    defectCasePool: [
      {
        id: "d-assets",
        defectCase:
          "관리체계 범위 내 자산 목록에서 중요정보 취급자 PC를 통제하는 출력물 보안, 문서암호화, USB매체제어 시스템이 누락된 경우",
        criteriaCode: "1.2.1",
        criteriaName: "정보자산 식별",
      },
      {
        id: "d-scope",
        defectCase: "관리체계 범위 내 정보자산과 서비스 범위가 명확히 설정되지 않은 경우",
        criteriaCode: "1.1.4",
        criteriaName: "범위 설정",
      },
    ],
    checkItemPool: [
      {
        id: "c-assets",
        question: "관리체계 범위 내 모든 정보자산을 식별하여 목록으로 관리하고 있는가?",
        criteriaCode: "1.2.1",
        criteriaName: "정보자산 식별",
        keywords: "정보자산 식별 목록 보안등급",
      },
      {
        id: "c-scope",
        question: "관리체계 범위 내 정보자산과 서비스를 명확히 설정하고 있는가?",
        criteriaCode: "1.1.4",
        criteriaName: "범위 설정",
        keywords: "관리체계 범위 정보자산 서비스",
      },
    ],
  };

  const session = createDefectCriterionSession(evidenceBank, { count: 1, seed: 1 });
  const codes = optionCodes(session.questions[0]);

  assert.ok(codes.includes("1.1.4"), "expected evidence-matched scope criterion to replace weak fallback");
  assert.equal(codes.includes("2.10.2"), false, "cloud security should not be offered for an asset-list defect");
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
  assert.equal(explanation.correctExplanation.code, correct.code);
  assert.equal(explanation.distractorExplanations.length, question.options.length - 1);
  assert.ok(explanation.distractorExplanations.some((item) => item.code === wrong.code && item.isSelected));
  assert.ok(explanation.distractorExplanations.every((item) => item.details.some((detail) => detail.includes("결함사례"))));
});

test("explainCheckItemAnswer explains the correct criterion for a confirmation item", () => {
  const session = createCheckItemSession(studyBank, { count: 1, seed: 4 });
  const question = session.questions[0];
  const correct = question.options.find((option) => option.isCorrect);
  const wrong = question.options.find((option) => !option.isCorrect);

  const explanation = explainCheckItemAnswer(question, wrong.id, studyBank);
  assert.equal(explanation.correctCriteriaCode, correct.code);
  assert.ok(explanation.details.length > 0);
  assert.equal(explanation.correctExplanation.code, correct.code);
  assert.equal(explanation.distractorExplanations.length, question.options.length - 1);
  assert.ok(explanation.distractorExplanations.every((item) => item.details.some((detail) => detail.includes("확인사항"))));
});

test("createStudySession dispatches by mode", () => {
  assert.equal(
    createStudySession(bank, { mode: STUDY_MODES.DEFECT_JUDGMENT_CORRECT, count: 1, seed: 7 }).mode,
    STUDY_MODES.DEFECT_JUDGMENT_CORRECT,
  );
  assert.equal(
    createStudySession(bank, { mode: STUDY_MODES.DEFECT_JUDGMENT_INCORRECT, count: 1, seed: 7 }).mode,
    STUDY_MODES.DEFECT_JUDGMENT_INCORRECT,
  );
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
