import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const scriptPath = join(process.cwd(), "scripts", "extract-win-mock-exam-criteria-bank.py");

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}

test("extract-win-mock-exam parses OCR page text and matches answer explanations", () => {
  const dir = mkdtempSync(join(tmpdir(), "win-exam-bank-"));
  const bankPath = join(dir, "bank.json");
  const fixturePath = join(dir, "fixture.json");
  const outputPath = join(dir, "win-bank.json");

  writeJson(bankPath, {
    criteria: {
      "2.5.1": { code: "2.5.1", name: "사용자 계정 관리" },
      "2.5.2": { code: "2.5.2", name: "사용자 식별" },
      "2.5.3": { code: "2.5.3", name: "사용자 인증" },
      "2.5.4": { code: "2.5.4", name: "비밀번호 관리" },
      "2.5.5": { code: "2.5.5", name: "특수 계정 및 권한 관리" },
      "2.5.6": { code: "2.5.6", name: "접근권한 검토" },
      "2.8.1": { code: "2.8.1", name: "보안 요구사항 정의" },
      "2.8.2": { code: "2.8.2", name: "보안 요구사항 검토 및 시험" },
      "2.11.3": { code: "2.11.3", name: "이상행위 분석 및 모니터링" },
    },
  });

  writeJson(fixturePath, [
    {
      sourceFile: "2025_F_공개(총2회).pdf",
      pageTexts: [
        {
          page: 83,
          text: `
2. 심사원은 정보통신서비스 부문 매출액 300억 원 미만의 중기업인 ABC 쇼핑몰을 대상으로 ISMS-P 간편 인증
심사를 수행하고 있다. 다음 중 심사원이 인증 및 권한관리에 대해 도출한 결함 중 적절하지 않은 것은 몇 개
인지 고르시오.
① 0개
심사원은 ABC 쇼핑몰의 회원관리를 위한 개인정보처리시스템의 계정 및 권한을 승인 절차 없이
구두로 처리하여 증적 확인이 되지 않아 2.5.1 사용자 계정 관리 결함으로 판단하였다.
심사원은 일부 직원들이 계정을 공용으로 사용하고 있으나, 이에 대한 타당성 검토 및 책임자
승인 등이 확인되지 않아 2.5.2 사용자 식별 결함으로 판단하였다.
심사원은 회원관리 개인정보처리시스템 로그인 실패 시 ID 또는 비밀번호가 틀렸다는 것을
표시해 주는 것을 확인하여 2.5.3 사용자 인증 결함으로 판단하였다.
심사원은 내부 지침에 명시된 비밀번호 작성규칙과 실제 개인정보처리시스템에 적용된
작성규칙이 상이하여 2.5.4 비밀번호 관리 결함으로 판단하였다.
심사원은 일부 직원의 관리자 권한 업무가 변경되었음에도 불구하고 관리자 권한을 계속
보유하고 있어 2.5.5 특수 계정 및 권한 관리 결함으로 판단하였다.
심사원은 개인정보처리시스템의 접근권한 검토 시 권한 오남용의 의심 사례가 다수 발생하였으나,
이에 대한 내부 보고 등 후속조치가 이루어지지 않아 2.5.6 접근권한 검토 결함으로 판단하였다.
② 1개
③ 2개
④ 4개
⑤ 6개
3. 정보보호 및 개인정보보호 관리체계 인증(ISMS-P)은 정보보호 및 개인정보보호를 위한 일련의 조치와 활동이
인증기준에 적합함을 인증하는 제도이다. 다음 중 ISMS-P 인증 제도에 대한 설명으로 적절하지 않은 것을
모두 고르시오. (2개)
① 인증기관은 인증위원회 운영, 인증심사원 양성 및 자격관리, 인증 제도 및 기준 개선 등 ISMS-P 인증 제도
전반에 걸친 업무를 수행한다.
② 심사 수행기관은 인증위원회 심의 결과에 따라 인증위원회 종료 다음날부터 30일 이내에 신청인에게 추가
보완조치를 요구할 수 있다.
          `,
        },
        {
          page: 162,
          text: `
3번 정답
②
{ 해설 ]
① 인증기관 설명은 적절하다.
② 인증위원회 심의 결과에 따른 추가 보완조치 요구 절차 설명이 적절하지 않다.
21번 정답
②,
⑤
[ 해설 ]
② [2.11.3 이상행위 분석 및 모니터링]은 내외부에 의한 침해시도, 개인정보유출 시도, 부정행위
등 이상행위를 탐지할 수 있도록 하는 기준으로 데이터 전처리 보안기능 검토 기준으로는 적절하지 않다.
관련 인증기준으로는 [2.8.1 보안요구사항 정의] 또는 [2.8.2 보안요구사항 검토 및 시험] 기준이 좀 더 가깝다.
          `,
        },
      ],
    },
  ]);

  execFileSync("python3", [
    scriptPath,
    "--bank",
    bankPath,
    "--text-fixture",
    fixturePath,
    "--output",
    outputPath,
  ]);

  const output = JSON.parse(readFileSync(outputPath, "utf8"));
  assert.equal(output.sourceKind, "win_mock_exam_ocr");
  assert.equal(output.counts.sources, 1);
  assert.equal(output.counts.questions, 2);
  assert.equal(output.counts.questionsWithAnswerExplanations, 2);

  const question2 = output.questions.find((question) => question.questionNo === 2);
  assert.equal(question2.questionType, "auditor_wrong_count");
  assert.deepEqual(question2.criteriaCodes, ["2.5.1", "2.5.2", "2.5.3", "2.5.4", "2.5.5", "2.5.6"]);
  assert.equal(question2.options.length, 5);
  assert.match(question2.stem, /구두로 처리하여 증적 확인이 되지 않아 2\.5\.1/);
  assert.equal(question2.options[0].text, "0개");

  const question3 = output.questions.find((question) => question.questionNo === 3);
  assert.equal(question3.answerStatus, "matched");
  assert.deepEqual(question3.answerMarkers, ["②"]);

  const question21 = output.answers.find((answer) => answer.questionNo === 21);
  assert.deepEqual(question21.answerMarkers, ["②", "⑤"]);
  assert.deepEqual(question21.explanationCriteriaCodes, ["2.11.3", "2.8.1", "2.8.2"]);
});

test("extract-win-mock-exam fails fast when OCR reports an error", () => {
  const dir = mkdtempSync(join(tmpdir(), "win-exam-bank-ocr-error-"));
  const bankPath = join(dir, "bank.json");
  const fixturePath = join(dir, "fixture.json");
  const outputPath = join(dir, "win-bank.json");

  writeJson(bankPath, { criteria: {} });
  writeJson(fixturePath, [
    {
      sourceFile: "2025_F_공개(총2회).pdf",
      pageTexts: [
        {
          page: 82,
          text: "",
          ocrError: "image_load_failed",
        },
      ],
    },
  ]);

  assert.throws(() => {
    execFileSync("python3", [
      scriptPath,
      "--bank",
      bankPath,
      "--text-fixture",
      fixturePath,
      "--output",
      outputPath,
    ]);
  }, /OCR failed/);
});

test("extract-win-mock-exam keeps labels aligned when only the explanation has criteria codes", () => {
  const dir = mkdtempSync(join(tmpdir(), "win-exam-bank-labels-"));
  const bankPath = join(dir, "bank.json");
  const fixturePath = join(dir, "fixture.json");
  const outputPath = join(dir, "win-bank.json");

  writeJson(bankPath, {
    criteria: {
      "2.8.1": { code: "2.8.1", name: "보안 요구사항 정의" },
    },
  });

  writeJson(fixturePath, [
    {
      sourceFile: "2025_F_공개(총2회).pdf",
      pageTexts: [
        {
          page: 10,
          text: `
4. 다음 중 심사원이 판단한 내용으로 적절하지 않은 것을 고르시오.
① 첫 번째 보기
② 두 번째 보기
          `,
        },
        {
          page: 20,
          text: `
4번 정답
②
[ 해설 ]
② 관련 인증기준으로는 2.8.1 보안 요구사항 정의가 더 가깝다.
          `,
        },
      ],
    },
  ]);

  execFileSync("python3", [
    scriptPath,
    "--bank",
    bankPath,
    "--text-fixture",
    fixturePath,
    "--output",
    outputPath,
  ]);

  const output = JSON.parse(readFileSync(outputPath, "utf8"));
  assert.deepEqual(output.questions[0].criteriaCodes, ["2.8.1"]);
  assert.deepEqual(output.questions[0].criteriaLabels, ["2.8.1 보안 요구사항 정의"]);
});

test("extract-win-mock-exam writes OCR JSONL, page index, and candidate items from fixture pages", () => {
  const dir = mkdtempSync(join(tmpdir(), "win-exam-bank-warehouse-"));
  const bankPath = join(dir, "bank.json");
  const fixturePath = join(dir, "fixture.json");
  const outputPath = join(dir, "win-bank.json");
  const ocrOutputPath = join(dir, "ocr-pages.jsonl");
  const pageIndexPath = join(dir, "page-index.json");

  writeJson(bankPath, {
    criteria: {
      "2.5.1": { code: "2.5.1", name: "사용자 계정 관리" },
    },
  });

  writeJson(fixturePath, [
    {
      sourceFile: "2025_F_공개(총2회).pdf",
      pageTexts: [
        {
          page: 1,
          text: "문제지 A형\n[ 응시자 필독 사항 ]\n시험이 시작되기 전까지 표지를 넘기지 마시오.",
        },
        {
          page: 2,
          text: `
1. 다음 중 심사원이 결함으로 판단한 내용으로 적절하지 않은 것을 고르시오.
① 계정 승인 절차가 없어 2.5.1 사용자 계정 관리 결함으로 판단하였다.
② 계정 승인 절차가 확인된다.
          `,
        },
        {
          page: 3,
          text: `
1번 정답
②
[ 해설 ]
② 제시된 내용만으로는 결함으로 판단하기 어렵다.
          `,
        },
      ],
    },
  ]);

  execFileSync("python3", [
    scriptPath,
    "--bank",
    bankPath,
    "--text-fixture",
    fixturePath,
    "--output",
    outputPath,
    "--ocr-output",
    ocrOutputPath,
    "--page-index-output",
    pageIndexPath,
  ]);

  const ocrRows = readFileSync(ocrOutputPath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(ocrRows.length, 3);
  assert.equal(ocrRows[0].fileName, "2025_F_공개(총2회).pdf");
  assert.equal(ocrRows[1].pageNumber, 2);

  const pageIndex = JSON.parse(readFileSync(pageIndexPath, "utf8"));
  assert.equal(pageIndex.counts.pages, 3);
  assert.equal(pageIndex.pages[0].pageKind, "cover_or_notice");
  assert.equal(pageIndex.pages[1].pageKind, "question");
  assert.equal(pageIndex.pages[1].hasCriteriaCode, true);
  assert.deepEqual(pageIndex.pages[1].questionNumbers, [1]);
  assert.equal(pageIndex.pages[2].pageKind, "answer_explanation");
  assert.deepEqual(pageIndex.pages[2].answerNumbers, [1]);

  const output = JSON.parse(readFileSync(outputPath, "utf8"));
  assert.equal(output.counts.candidateItems, 1);
  assert.equal(output.candidateItems[0].candidateType, "auditor_judgment");
  assert.equal(output.candidateItems[0].reviewStatus, "draft_usable");
  assert.equal(output.candidateItems[0].optionCount, 2);
  assert.deepEqual(output.candidateItems[0].answerOptions, [2]);
});

test("extract-win-mock-exam ignores notice bullets and keeps question ids unique across repeated sets", () => {
  const dir = mkdtempSync(join(tmpdir(), "win-exam-bank-repeat-"));
  const bankPath = join(dir, "bank.json");
  const fixturePath = join(dir, "fixture.json");
  const outputPath = join(dir, "win-bank.json");
  const pageIndexPath = join(dir, "page-index.json");

  writeJson(bankPath, {
    criteria: {
      "2.5.1": { code: "2.5.1", name: "사용자 계정 관리" },
      "2.5.2": { code: "2.5.2", name: "사용자 식별" },
    },
  });

  writeJson(fixturePath, [
    {
      sourceFile: "repeat.pdf",
      pageTexts: [
        {
          page: 1,
          text: `
문제지 A형
[ 응시자 필독 사항 ]
1. 자신이 선택한 문제지의 유형을 확인하시오.
2. 문제지의 해당란에 성명과 수험번호를 정확히 쓰시오.
3. 답안지의 해당란에 답을 정확히 표시하시오.
          `,
        },
        {
          page: 2,
          text: `
1. 다음 중 심사원이 결함으로 판단한 내용으로 적절하지 않은 것을 고르시오.
① 계정 승인 절차가 없어 2.5.1 사용자 계정 관리 결함으로 판단하였다.
② 계정 승인 절차가 확인된다.
          `,
        },
        {
          page: 3,
          text: `
1번 정답
②
[ 해설 ]
② 결함으로 보기 어렵다.
          `,
        },
        {
          page: 4,
          text: `
1. 다음 중 심사원이 결함으로 판단한 내용으로 적절하지 않은 것을 고르시오.
① 공용계정 승인 절차가 없어 2.5.2 사용자 식별 결함으로 판단하였다.
② 공용계정 승인 절차가 확인된다.
          `,
        },
        {
          page: 5,
          text: `
1번 정답
①
[ 해설 ]
① 다른 세트의 1번 정답이다.
          `,
        },
        {
          page: 6,
          text: `
제16조(인증심사원 자격 취소)
1. 자격 취소의 적합 여부를 심의한다.
2. 인증위원회 위원 3인 이상을 포함한다.
          `,
        },
      ],
    },
  ]);

  execFileSync("python3", [
    scriptPath,
    "--bank",
    bankPath,
    "--text-fixture",
    fixturePath,
    "--output",
    outputPath,
    "--page-index-output",
    pageIndexPath,
  ]);

  const output = JSON.parse(readFileSync(outputPath, "utf8"));
  assert.equal(output.counts.questions, 2);
  assert.equal(new Set(output.questions.map((question) => question.id)).size, 2);
  assert.deepEqual(output.questions.map((question) => question.answerMarkers), [["②"], ["①"]]);
  assert.deepEqual(output.questions.map((question) => question.answerPageNumber), [3, 5]);
  assert.equal(new Set(output.candidateItems.map((item) => item.id)).size, output.candidateItems.length);
  assert.deepEqual(output.candidateItems.map((item) => item.optionCount), [2, 2]);

  const pageIndex = JSON.parse(readFileSync(pageIndexPath, "utf8"));
  assert.equal(pageIndex.pages.find((page) => page.pageNumber === 1).pageKind, "cover_or_notice");
  assert.equal(pageIndex.pages.find((page) => page.pageNumber === 6).pageKind, "reference_material");
});
