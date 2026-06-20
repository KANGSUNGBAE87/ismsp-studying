import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const VERSION = "0.1.0";
const DEFAULT_TOP_N = 12;
const MIN_SIMILARITY_SCORE = 12;
const STOPWORDS = new Set([
  "경우",
  "해당",
  "결함",
  "기준",
  "보안",
  "보호",
  "관리",
  "절차",
  "수립",
  "운영",
  "대한",
  "관한",
  "방법",
  "대상",
  "주기",
  "담당자",
  "세부",
  "정보보호",
  "정보",
  "중요정보",
  "내부정보",
  "개인정보",
  "시스템",
  "서비스",
  "주요",
  "일부",
  "등이",
  "또는",
  "있는가",
  "있으나",
  "있지",
  "하지",
  "않은",
  "않아",
  "한다",
  "정하고",
  "결과",
  "보고",
  "문제점",
  "점검",
  "조치",
]);
const GENERIC_ROOTS = ["수립", "수행", "이행", "절차", "기준", "관리", "정기", "확인", "문제점", "대책"];

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;
    args.set(key.slice(2), argv[index + 1]);
    index += 1;
  }
  return {
    bankPath: resolve(args.get("bank") ?? "public/data/ismsp-defect-bank.json"),
    graphPath: resolve(args.get("graph") ?? "public/data/wrongnote-graph.json"),
    outPath: resolve(args.get("out") ?? "public/data/criteria-similarity.json"),
    topN: Number.parseInt(args.get("top-n") ?? `${DEFAULT_TOP_N}`, 10),
  };
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (fallback !== null && error?.code === "ENOENT") return fallback;
    throw error;
  }
}

function stableConceptId(token) {
  return `concept:${Buffer.from(token).toString("base64url")}`;
}

function criterionId(code) {
  return `criteria:${code}`;
}

function normalizeGroupCode(value) {
  return String(value ?? "").replace(/\.$/, "");
}

function rawTokens(value) {
  return [...String(value ?? "").normalize("NFKC").matchAll(/[가-힣A-Za-z0-9]+/gu)].map((match) =>
    match[0].toLowerCase(),
  );
}

function normalizeToken(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(으로|에서|에게|에는|으로는|로는|과는|와는|의|은|는|이|가|을|를|에|과|와|로)$/u, "");
}

function isGeneric(token) {
  return GENERIC_ROOTS.some((root) => token.includes(root));
}

function tokenize(value) {
  const seen = new Set();
  const tokens = [];
  for (const raw of rawTokens(value)) {
    const token = normalizeToken(raw);
    if (token.length < 2 || STOPWORDS.has(token) || isGeneric(token) || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function addWeightedTokens(map, value, weight) {
  for (const token of tokenize(value)) {
    map.set(token, (map.get(token) ?? 0) + weight);
  }
}

function buildCriteriaProfiles(bank) {
  const profiles = new Map();
  for (const [code, criteria] of Object.entries(bank.criteria ?? {})) {
    const tokens = new Map();
    addWeightedTokens(tokens, criteria.name, 2.8);
    addWeightedTokens(tokens, criteria.requirement, 2.2);
    profiles.set(code, { criteria, tokens });
  }

  for (const item of bank.checkItemPool ?? []) {
    const profile = profiles.get(item.criteriaCode);
    if (!profile) continue;
    addWeightedTokens(profile.tokens, item.question, 1.9);
    addWeightedTokens(profile.tokens, item.keywords, 2.2);
  }

  for (const item of bank.defectCasePool ?? []) {
    const profile = profiles.get(item.criteriaCode);
    if (!profile) continue;
    addWeightedTokens(profile.tokens, item.defectCase, 2.1);
  }

  return profiles;
}

function tokensCompatible(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length < 2 || right.length < 2) return false;
  return left.includes(right) || right.includes(left);
}

function weightedOverlap(left, right) {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  let leftTotal = 0;
  let rightTotal = 0;

  for (const value of left.values()) leftTotal += value;
  for (const value of right.values()) rightTotal += value;

  for (const [leftToken, leftWeight] of left.entries()) {
    let best = 0;
    for (const [rightToken, rightWeight] of right.entries()) {
      if (!tokensCompatible(leftToken, rightToken)) continue;
      best = Math.max(best, Math.min(leftWeight, rightWeight));
    }
    intersection += best;
  }

  const containment = intersection / Math.min(leftTotal, rightTotal);
  const jaccard = intersection / (leftTotal + rightTotal - intersection);
  return Math.max(jaccard, containment * 0.72);
}

function graphBoost(wrongnoteGraph, leftCode, rightCode) {
  const leftId = criterionId(leftCode);
  const rightId = criterionId(rightCode);
  let boost = 0;
  for (const edge of wrongnoteGraph.edges ?? []) {
    const samePair = (edge.source === leftId && edge.target === rightId) || (edge.source === rightId && edge.target === leftId);
    if (!samePair) continue;
    if (edge.type === "SIMILAR_TO") {
      const rank = Number(edge.properties?.rank ?? 20);
      boost = Math.max(boost, (20 - Math.min(rank, 20)) / 20);
    }
    if (edge.type === "CONFUSED_WITH") {
      const count = Number(edge.properties?.count ?? 1);
      boost = Math.max(boost, Math.min(count, 10) / 10);
    }
  }
  return boost;
}

function scorePair(bank, wrongnoteGraph, leftCode, rightCode, profiles) {
  const left = profiles.get(leftCode);
  const right = profiles.get(rightCode);
  if (!left || !right) return null;

  const lexical = weightedOverlap(left.tokens, right.tokens);
  const sameGroup = normalizeGroupCode(left.criteria.groupCode) === normalizeGroupCode(right.criteria.groupCode);
  const sameDomain = left.criteria.domain && left.criteria.domain === right.criteria.domain;
  const graph = graphBoost(wrongnoteGraph, leftCode, rightCode);
  const score = lexical * 76 + graph * 12 + (sameGroup ? 8 : 0) + (sameDomain ? 4 : 0);

  const reasons = [];
  if (lexical > 0.12) reasons.push("shared semantic evidence");
  if (sameGroup) reasons.push("same criteria group");
  else if (sameDomain) reasons.push("same criteria domain");
  if (graph > 0) reasons.push("wrong-note graph relationship");

  return {
    code: rightCode,
    name: right.criteria.name ?? rightCode,
    score: Number(score.toFixed(3)),
    reasons,
  };
}

function buildSimilarity(bank, wrongnoteGraph, topN) {
  const profiles = buildCriteriaProfiles(bank);
  const nodes = [];
  const edges = [];
  const similarCriteriaByCode = {};

  for (const [code, profile] of profiles.entries()) {
    nodes.push({
      id: criterionId(code),
      type: "Criteria",
      label: `${code} ${profile.criteria.name ?? ""}`.trim(),
      properties: profile.criteria,
    });

    for (const [token, weight] of [...profile.tokens.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24)) {
      const conceptId = stableConceptId(token);
      nodes.push({ id: conceptId, type: "Concept", label: token, properties: { token } });
      edges.push({
        source: criterionId(code),
        target: conceptId,
        type: "HAS_CONCEPT",
        properties: { weight: Number(weight.toFixed(3)) },
      });
    }
  }

  const codes = [...profiles.keys()].sort();
  const seenNodeIds = new Set();
  const uniqueNodes = nodes.filter((item) => {
    if (seenNodeIds.has(item.id)) return false;
    seenNodeIds.add(item.id);
    return true;
  });

  for (const code of codes) {
    const ranked = codes
      .filter((candidateCode) => candidateCode !== code)
      .map((candidateCode) => scorePair(bank, wrongnoteGraph, code, candidateCode, profiles))
      .filter((item) => item && item.score >= MIN_SIMILARITY_SCORE)
      .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
      .slice(0, topN)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    similarCriteriaByCode[code] = ranked;
    for (const item of ranked) {
      edges.push({
        source: criterionId(code),
        target: criterionId(item.code),
        type: "SIMILAR_CRITERIA",
        properties: { rank: item.rank, score: item.score, reasons: item.reasons },
      });
    }
  }

  return {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    topN,
    nodes: uniqueNodes.sort((a, b) => a.id.localeCompare(b.id)),
    edges: edges.sort((a, b) => `${a.source}:${a.type}:${a.target}`.localeCompare(`${b.source}:${b.type}:${b.target}`)),
    similarCriteriaByCode,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bank = await readJson(args.bankPath);
  const wrongnoteGraph = await readJson(args.graphPath, { nodes: [], edges: [] });
  const similarity = buildSimilarity(bank, wrongnoteGraph, args.topN);
  await mkdir(dirname(args.outPath), { recursive: true });
  await writeFile(args.outPath, `${JSON.stringify(similarity, null, 2)}\n`, "utf8");
  console.log(
    `Built criteria similarity graph: ${similarity.nodes.length} nodes, ${similarity.edges.length} edges -> ${args.outPath}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
