import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const scriptPath = join(process.cwd(), "scripts", "build-wrongnote-graph.py");

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}

test("build-wrongnote-graph creates graph, summary, and match report from fixtures", () => {
  const dir = mkdtempSync(join(tmpdir(), "wrongnote-graph-"));
  const bankPath = join(dir, "bank.json");
  const synthPath = join(dir, "synth.json");
  const wrongnotePath = join(dir, "wrongnotes.json");
  const graphPath = join(dir, "wrongnote-graph.json");
  const summaryPath = join(dir, "criteria-summary.json");
  const reportPath = join(dir, "wrongnote-match-report.json");

  writeJson(bankPath, {
    criteria: {
      "1.1.1": {
        code: "1.1.1",
        name: "경영진의 참여",
        domain: "1.관리체계 수립 및 운영",
        groupCode: "1.1.",
        groupName: "관리체계 기반 마련",
        requirement: "경영진 참여 체계를 수립하여야 한다.",
      },
      "1.1.2": {
        code: "1.1.2",
        name: "최고책임자의 지정",
        domain: "1.관리체계 수립 및 운영",
        groupCode: "1.1.",
        groupName: "관리체계 기반 마련",
        requirement: "최고책임자를 지정하여야 한다.",
      },
    },
    similarCriteriaByCode: { "1.1.1": ["1.1.2"], "1.1.2": ["1.1.1"] },
    checkItemPool: [
      {
        id: "c-1",
        question: "경영진 보고 및 의사결정 책임과 역할을 문서화하고 있는가?",
        criteriaCode: "1.1.1",
        criteriaName: "경영진의 참여",
        groupCode: "1.1.",
        groupName: "관리체계 기반 마련",
        domain: "1.관리체계 수립 및 운영",
        keywords: "보고체계",
      },
    ],
    defectCasePool: [
      {
        id: "d-1",
        defectCase: "경영진에게 장기간 정보보호 현황을 보고하지 않은 경우",
        criteriaCode: "1.1.1",
        criteriaName: "경영진의 참여",
      },
    ],
    truePool: [
      {
        id: "t-1",
        statement: "경영진에게 장기간 정보보호 현황을 보고하지 않은 경우 1.1.1 경영진의 참여 결함에 해당한다.",
        defectCase: "경영진에게 장기간 정보보호 현황을 보고하지 않은 경우",
        criteriaCode: "1.1.1",
        criteriaName: "경영진의 참여",
        isCorrect: true,
      },
    ],
    falsePool: [
      {
        id: "f-1",
        statement: "경영진에게 장기간 정보보호 현황을 보고하지 않은 경우 1.1.2 최고책임자의 지정 결함에 해당한다.",
        defectCase: "경영진에게 장기간 정보보호 현황을 보고하지 않은 경우",
        criteriaCode: "1.1.2",
        criteriaName: "최고책임자의 지정",
        isCorrect: false,
      },
    ],
  });

  writeJson(synthPath, [
    {
      id: "synA-1",
      statement: "경영진에게 장기간 정보보호 현황을 보고하지 않은 경우 1.1.2 최고책임자의 지정 결함에 해당한다.",
      defectCase: "경영진에게 장기간 정보보호 현황을 보고하지 않은 경우",
      criteriaCode: "1.1.2",
      criteriaName: "최고책임자의 지정",
      correctAnswer: "1.1.1",
      correctAnswerName: "경영진의 참여",
      isCorrect: false,
      family: "A",
      trapAxis: "A1",
    },
    {
      id: "synB-1",
      statement: "당월 보고를 수행하지 않은 경우 1.1.1 경영진의 참여 결함에 해당한다.",
      defectCase: "당월 보고를 수행하지 않은 경우",
      criteriaCode: "1.1.1",
      criteriaName: "경영진의 참여",
      correctAnswer: "1.1.1",
      correctAnswerName: "경영진의 참여",
      isCorrect: false,
      family: "B",
      trapAxis: "B1",
    },
    {
      id: "synB-2",
      statement: "경영진 보고가 정상적으로 이행된 경우 1.1.1 결함에 해당한다.",
      defectCase: "경영진에게 장기간 정보보호 현황을 보고하지 않은 경우",
      criteriaCode: false,
      criteriaName: "",
      correctAnswer: false,
      correctAnswerName: "",
      isCorrect: false,
      family: "B",
      trapAxis: "B7",
    },
  ]);

  writeJson(wrongnotePath, {
    checkItem: [
      {
        no: 1,
        text: "경영진 보고 및 의사결정 책임과 역할을 문서화하고 있는가?",
        criteriaCode: "1.1.1",
        criteriaName: "경영진의 참여",
      },
      { no: 2, text: "", criteriaCode: "", criteriaName: "" },
    ],
    defectCase: [
      {
        no: 1,
        text: "경영진에게 장기간 정보보호 현황을 보고하지 않은 경우",
        criteriaCode: "1.1.1",
        criteriaName: "경영진의 참여",
      },
    ],
  });

  execFileSync("python3", [
    scriptPath,
    "--bank",
    bankPath,
    "--synth",
    synthPath,
    "--wrongnote-json",
    wrongnotePath,
    "--graph-output",
    graphPath,
    "--summary-output",
    summaryPath,
    "--report-output",
    reportPath,
  ]);

  const graph = JSON.parse(readFileSync(graphPath, "utf8"));
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const report = JSON.parse(readFileSync(reportPath, "utf8"));

  assert.ok(graph.nodes.some((node) => node.id === "criteria:1.1.1" && node.type === "Criteria"));
  assert.ok(graph.nodes.some((node) => node.type === "WrongNoteEntry" && node.properties.noteType === "check_item"));
  assert.ok(graph.edges.some((edge) => edge.type === "WEAK_ON" && edge.target === "criteria:1.1.1"));
  assert.ok(graph.edges.some((edge) => edge.type === "CONFUSED_WITH" && edge.source === "criteria:1.1.1"));
  assert.ok(graph.edges.some((edge) => edge.type === "DEVIATES_FROM"));
  assert.ok(
    graph.nodes.some(
      (node) => node.type === "JudgmentStatement" && node.properties.sourceId === "synB-2",
    ),
  );

  assert.equal(summary.criteria["1.1.1"].wrongNoteCount, 2);
  assert.equal(summary.criteria["1.1.1"].checkItemWrongCount, 1);
  assert.equal(summary.criteria["1.1.1"].defectCaseWrongCount, 1);
  assert.equal(report.counts.blankNumberedRows, 1);
  assert.equal(report.counts.importedWrongNotes, 2);
});
