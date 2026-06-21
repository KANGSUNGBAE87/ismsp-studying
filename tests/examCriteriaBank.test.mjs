import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const scriptPath = join(process.cwd(), "scripts", "extract-exam-criteria-bank.py");

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}

test("extract-exam-criteria-bank parses source questions and criteria-selection items", () => {
  const dir = mkdtempSync(join(tmpdir(), "exam-bank-"));
  const bankPath = join(dir, "bank.json");
  const fixturePath = join(dir, "fixture.json");
  const outputPath = join(dir, "exam-bank.json");

  writeJson(bankPath, {
    criteria: {
      "1.1.1": { code: "1.1.1", name: "경영진의 참여" },
      "1.1.2": { code: "1.1.2", name: "최고책임자의 지정" },
      "2.1.2": { code: "2.1.2", name: "조직의 유지관리" },
    },
  });

  writeJson(fixturePath, [
    {
      sourceFile: "70답.pdf",
      pages: 1,
      text: `
1. □□인터넷 쇼핑몰에 대해 ISMS-P 인증심사를 수행하고 있다. 1.1 관리체계 기반마련의 세부인증 기준중 심사원이 결함으로 판단한 내용으로 잘못된 것을 고르시오.
1) 장기간 보고를 수행하지 않아 1.1.1 경영진의 참여 결함으로 판단 하였다.
2) 공식적인 지정절차를 거치지 않아 1.1.2 최고책임자의 지정 결함으로 판단 하였다.
3) 부서별 담당자의 KPI에 정보보호 사항이 반영되어 있지 않아 1.1.3 조직구성 결함으로 판단하였다.
의견 보내기
3) 2.1.2 조직의 유지관리 결함이다.
      `,
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
  assert.equal(output.counts.sources, 1);
  assert.equal(output.counts.questions, 1);
  assert.equal(output.questions[0].questionType, "auditor_wrong_judgment");
  assert.equal(output.questions[0].answerOption, 3);
  assert.deepEqual(output.questions[0].explanationCriteriaCodes, ["2.1.2"]);
  assert.equal(output.criteriaSelectionItems.length, 3);
  assert.equal(output.criteriaSelectionItems.filter((item) => item.usableForTraining).length, 2);
  assert.equal(
    output.criteriaSelectionItems.find((item) => item.sourceOptionIndex === 3).sourceLabelStatus,
    "source_marks_as_wrong_judgment",
  );
});
