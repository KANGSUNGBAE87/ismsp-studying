import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const scriptPath = join(process.cwd(), "scripts", "build-criteria-similarity.mjs");

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

test("build-criteria-similarity creates a semantic criteria graph from criteria defects and check items", () => {
  const dir = mkdtempSync(join(tmpdir(), "criteria-similarity-"));
  const bankPath = join(dir, "bank.json");
  const graphPath = join(dir, "wrongnote-graph.json");
  const outputPath = join(dir, "criteria-similarity.json");

  writeJson(bankPath, {
    criteria: {
      "1.2.1": {
        code: "1.2.1",
        name: "정보자산 식별",
        domain: "1.관리체계 수립 및 운영",
        groupCode: "1.2.",
        groupName: "위험 관리",
        requirement: "정보자산 분류기준을 수립하고 모든 정보자산을 식별하여 목록으로 관리하여야 한다.",
      },
      "1.1.4": {
        code: "1.1.4",
        name: "범위 설정",
        domain: "1.관리체계 수립 및 운영",
        groupCode: "1.1.",
        groupName: "관리체계 기반 마련",
        requirement: "관리체계 범위 내 정보자산과 서비스를 명확히 설정하여야 한다.",
      },
      "1.2.2": {
        code: "1.2.2",
        name: "현황 및 흐름분석",
        domain: "1.관리체계 수립 및 운영",
        groupCode: "1.2.",
        groupName: "위험 관리",
        requirement: "업무 현황과 정보자산 흐름을 분석하여야 한다.",
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
    defectCasePool: [
      {
        id: "d-asset",
        defectCase: "관리체계 범위 내 자산 목록에서 중요정보 취급자 PC 통제 시스템이 누락된 경우",
        criteriaCode: "1.2.1",
      },
      {
        id: "d-scope",
        defectCase: "관리체계 범위 내 정보자산과 서비스 범위가 명확히 설정되지 않은 경우",
        criteriaCode: "1.1.4",
      },
    ],
    checkItemPool: [
      {
        id: "c-asset",
        question: "관리체계 범위 내 모든 정보자산을 식별하여 목록으로 관리하고 있는가?",
        criteriaCode: "1.2.1",
        keywords: "정보자산 식별 목록 보안등급",
      },
      {
        id: "c-scope",
        question: "관리체계 범위 내 정보자산과 서비스를 명확히 설정하고 있는가?",
        criteriaCode: "1.1.4",
        keywords: "관리체계 범위 정보자산 서비스",
      },
    ],
  });
  writeJson(graphPath, {
    nodes: [],
    edges: [
      {
        source: "criteria:1.2.1",
        target: "criteria:1.1.4",
        type: "CONFUSED_WITH",
        properties: { count: 3 },
      },
    ],
  });

  execFileSync("node", [scriptPath, "--bank", bankPath, "--graph", graphPath, "--out", outputPath, "--top-n", "3"], {
    cwd: process.cwd(),
  });

  const output = readJson(outputPath);
  assert.ok(output.nodes.some((node) => node.id === "criteria:1.2.1"));
  assert.ok(output.nodes.some((node) => node.type === "Concept" && node.label.includes("정보자산")));
  assert.ok(
    output.edges.some(
      (edge) => edge.source === "criteria:1.2.1" && edge.target === "criteria:1.1.4" && edge.type === "SIMILAR_CRITERIA",
    ),
  );

  const similar = output.similarCriteriaByCode["1.2.1"].map((item) => item.code);
  assert.equal(similar[0], "1.1.4");
  assert.equal(similar.includes("2.10.2"), false, "cloud security should not survive top semantic graph ranking");
});
