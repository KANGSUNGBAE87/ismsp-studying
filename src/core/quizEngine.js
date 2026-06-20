const DEFAULT_PROMPT_KO =
  "ISMS-P 인증심사에서 다음 결함사례에 대한 심사원의 판단으로 틀린 것을 모두 고르시오. (2개)";

export const DEFAULT_SESSION_COUNT = 10;

export const STUDY_MODES = {
  DEFECT_JUDGMENT: "defect-judgment",
  DEFECT_JUDGMENT_CORRECT: "defect-judgment-correct",
  DEFECT_JUDGMENT_INCORRECT: "defect-judgment-incorrect",
  DEFECT_CRITERION: "defect-criterion",
  CHECK_ITEM: "check-item",
};

const DEFECT_CRITERION_PROMPT_KO = "다음 결함사례는 어떤 ISMS-P 인증기준 결함에 해당하나요?";
const CHECK_ITEM_PROMPT_KO = "다음 확인사항은 어떤 ISMS-P 인증기준에 해당하나요?";
const DEFECT_JUDGMENT_CORRECT_PROMPT_KO = "다음 결함사례에 대한 올바른 심사원 판단을 고르시오.";
const DEFECT_JUDGMENT_INCORRECT_PROMPT_KO = "다음 결함사례에 대한 틀린 심사원 판단을 고르시오.";
const DOMAIN_STOPWORDS = new Set([
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
const GENERIC_SCOPE_ROOTS = [
  "수립",
  "수행",
  "이행",
  "절차",
  "기준",
  "관리",
  "정기",
  "확인",
  "문제점",
  "대책",
  "결과",
  "보고",
];
const ANCHOR_STOPWORDS = new Set([
  ...DOMAIN_STOPWORDS,
  "보안",
  "보호",
  "관리",
  "처리",
  "접근",
  "통제",
  "적용",
  "검토",
  "점검",
  "조치",
  "제한",
  "공개",
  "운영",
  "개선",
  "보장",
]);

export function createSeededRandom(seed = Date.now()) {
  let state = Number(seed) >>> 0;
  if (state === 0) state = 0x6d2b79f5;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalizeCount(count, bank) {
  const trueCapacity = Math.floor((bank.truePool?.length ?? 0) / 3);
  const falseCapacity = bank.truePool?.length ?? 0;
  const maxCount = Math.max(0, Math.min(trueCapacity, falseCapacity));
  const parsed = Number.parseInt(count, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) return Math.min(DEFAULT_SESSION_COUNT, maxCount);
  return Math.min(parsed, maxCount);
}

export function createSession(bank, options = {}) {
  validateBank(bank);

  const random = createSeededRandom(options.seed ?? Date.now());
  const falsePool = shuffle(buildRuntimeFalsePool(bank), random);
  const count = Math.min(normalizeCount(options.count ?? DEFAULT_SESSION_COUNT, bank), Math.floor(falsePool.length / 2));
  const truePool = shuffle(bank.truePool, random);
  const questions = buildDefectJudgmentQuestions(falsePool, truePool, count, random);

  return makeSession(STUDY_MODES.DEFECT_JUDGMENT, questions, random);
}

export function createStudySession(bank, options = {}) {
  const mode = options.mode ?? STUDY_MODES.DEFECT_JUDGMENT_INCORRECT;
  if (mode === STUDY_MODES.DEFECT_JUDGMENT_CORRECT) return createDefectJudgmentCorrectSession(bank, options);
  if (mode === STUDY_MODES.DEFECT_JUDGMENT_INCORRECT) return createDefectJudgmentIncorrectSession(bank, options);
  if (mode === STUDY_MODES.DEFECT_CRITERION) return createDefectCriterionSession(bank, options);
  if (mode === STUDY_MODES.CHECK_ITEM) return createCheckItemSession(bank, options);
  return createDefectJudgmentSession(bank, options);
}

export function createDefectJudgmentSession(bank, options = {}) {
  // Preserve the existing mixed-judgment quiz; createSession already tags mode.
  return createSession(bank, options);
}

export function createWeakDefectJudgmentSession(bank, personalization = {}, options = {}) {
  validateBank(bank);

  const random = createSeededRandom(options.seed ?? Date.now());
  const count = normalizeCount(options.count ?? DEFAULT_SESSION_COUNT, bank);
  const weakCriteriaCodes = rankWeakCriteriaCodes(personalization.criteriaSummary);
  const falsePool = prioritizeWeakFalsePool(bank, weakCriteriaCodes, random);
  const truePool = prioritizeWeakTruePool(bank, weakCriteriaCodes, random);
  const safeCount = Math.min(count, Math.floor(falsePool.length / 2));
  const questions = buildDefectJudgmentQuestions(falsePool, truePool, safeCount, random, {
    personalized: true,
    weakCriteriaCodes,
  });
  const session = makeSession(STUDY_MODES.DEFECT_JUDGMENT, questions, random);
  session.hiddenFeature = "weak-problem-review";
  return session;
}

export function createDefectJudgmentCorrectSession(bank, options = {}) {
  return createBinaryDefectJudgmentSession(bank, {
    ...options,
    mode: STUDY_MODES.DEFECT_JUDGMENT_CORRECT,
    answerTarget: "correct",
    promptKo: DEFECT_JUDGMENT_CORRECT_PROMPT_KO,
  });
}

export function createDefectJudgmentIncorrectSession(bank, options = {}) {
  return createBinaryDefectJudgmentSession(bank, {
    ...options,
    mode: STUDY_MODES.DEFECT_JUDGMENT_INCORRECT,
    answerTarget: "incorrect",
    promptKo: DEFECT_JUDGMENT_INCORRECT_PROMPT_KO,
  });
}

export function createDefectCriterionSession(bank, options = {}) {
  validateCriterionBank(bank, "defectCasePool");

  const random = createSeededRandom(options.seed ?? Date.now());
  const pool = shuffle(bank.defectCasePool, random);
  const count = clampCount(options.count ?? DEFAULT_SESSION_COUNT, pool.length);

  const questions = pool.slice(0, count).map((item, index) =>
    buildCriterionQuestion(bank, random, {
      index,
      mode: STUDY_MODES.DEFECT_CRITERION,
      promptKo: DEFECT_CRITERION_PROMPT_KO,
      body: item.defectCase,
      correctCode: item.criteriaCode,
      badge: "",
      meta: { sourceId: item.id, sourceRow: item.sourceRow ?? null },
    }),
  );

  return makeSession(STUDY_MODES.DEFECT_CRITERION, questions, random);
}

export function createCheckItemSession(bank, options = {}) {
  validateCriterionBank(bank, "checkItemPool");

  const random = createSeededRandom(options.seed ?? Date.now());
  const pool = shuffle(bank.checkItemPool, random);
  const count = clampCount(options.count ?? DEFAULT_SESSION_COUNT, pool.length);

  const questions = pool.slice(0, count).map((item, index) =>
    buildCriterionQuestion(bank, random, {
      index,
      mode: STUDY_MODES.CHECK_ITEM,
      promptKo: CHECK_ITEM_PROMPT_KO,
      body: item.question,
      correctCode: item.criteriaCode,
      badge: item.displayBadge ?? "",
      meta: {
        sourceId: item.id,
        sourceRow: item.sourceRow ?? null,
        sourceVariant: item.sourceVariant ?? "integrated",
        keywords: item.keywords ?? "",
      },
    }),
  );

  return makeSession(STUDY_MODES.CHECK_ITEM, questions, random);
}

export function evaluateSingleAnswer(question, selectedOptionId) {
  const id = Array.isArray(selectedOptionId) ? selectedOptionId[0] : selectedOptionId;
  const correct = question.options.find((option) => isTargetOption(question, option)) ?? null;

  if (id === null || id === undefined || id === "") {
    return { status: "incomplete", isCorrect: false, correctOptionId: correct?.id ?? null };
  }

  const isCorrect = id === correct?.id;
  return {
    status: isCorrect ? "correct" : "wrong",
    isCorrect,
    selectedOptionId: id,
    correctOptionId: correct?.id ?? null,
  };
}

export function explainDefectCriterionAnswer(question, selectedOptionId, bank) {
  return explainCriterionChoice(question, selectedOptionId, bank, "이 결함사례");
}

export function explainCheckItemAnswer(question, selectedOptionId, bank) {
  return explainCriterionChoice(question, selectedOptionId, bank, "이 확인사항");
}

export function evaluateAnswer(question, selectedOptionIds) {
  const selected = new Set(selectedOptionIds);
  const correct = new Set(
    question.options.filter((option) => isTargetOption(question, option)).map((option) => option.id),
  );

  if (selected.size < correct.size) {
    return {
      status: "incomplete",
      isCorrect: false,
      selectedCount: selected.size,
      correctCount: correct.size,
    };
  }

  if (selected.size !== correct.size) {
    return {
      status: "invalid-count",
      isCorrect: false,
      selectedCount: selected.size,
      correctCount: correct.size,
    };
  }

  const isCorrect = [...correct].every((id) => selected.has(id));
  return {
    status: isCorrect ? "correct" : "wrong",
    isCorrect,
    selectedCount: selected.size,
    correctCount: correct.size,
    selectedOptionIds: [...selected],
    correctOptionIds: [...correct],
  };
}

export function getQuestionStats(questions, answersByQuestionId) {
  let answered = 0;
  let correct = 0;

  for (const question of questions) {
    const answer = answersByQuestionId[question.id] ?? [];
    if (isAnswerEmpty(answer)) continue;
    answered += 1;
    if (isQuestionCorrect(question, answer)) correct += 1;
  }

  return {
    total: questions.length,
    answered,
    correct,
    scorePercent: answered === 0 ? 0 : Math.round((correct / questions.length) * 100),
  };
}

export function buildWeakAreaSummary(questions, answersByQuestionId) {
  const weakMap = new Map();

  for (const question of questions) {
    const answer = answersByQuestionId[question.id] ?? [];
    if (isAnswerEmpty(answer) || isQuestionCorrect(question, answer)) continue;

    for (const option of question.options.filter((item) => isTargetOption(question, item))) {
      const key = option.criteriaCode ?? option.code;
      const current = weakMap.get(key) ?? {
        code: key,
        name: option.criteriaName ?? option.name,
        misses: 0,
      };
      current.misses += 1;
      weakMap.set(key, current);
    }
  }

  return [...weakMap.values()].sort((a, b) => b.misses - a.misses || a.code.localeCompare(b.code));
}

export function isTargetOption(question, option) {
  return question.answerTarget === "incorrect" ? !option.isCorrect : Boolean(option.isCorrect);
}

function isAnswerEmpty(answer) {
  return Array.isArray(answer) ? answer.length === 0 : answer === null || answer === undefined || answer === "";
}

function isQuestionCorrect(question, answer) {
  if (question.type === "single") {
    return evaluateSingleAnswer(question, answer).isCorrect;
  }
  return evaluateAnswer(question, Array.isArray(answer) ? answer : [answer]).isCorrect;
}

export function explainIncorrectOption(option, bank) {
  if (!option || option.isCorrect) return null;

  const wrongCriteria = getCriteria(bank, option.criteriaCode);
  const exactMatch = findExactOriginal(option, bank);
  const similarMatch = exactMatch ? null : findSimilarOriginal(option, bank);
  const original = exactMatch ?? similarMatch;

  if (!original) {
    const details = [];
    appendCriteriaScopeDetails(details, bank, option.criteriaCode, formatCriteria(option));

    return {
      matchType: "criteria-scope",
      confidence: 0,
      wrongCriteriaCode: option.criteriaCode,
      wrongCriteriaName: option.criteriaName,
      summary: `틀린 판단입니다. 이 문장은 ${formatCriteria(
        option,
      )} 결함으로 단정하기 어렵습니다. 아래는 해당 항목이 실제로 다루는 범위입니다.`,
      details,
    };
  }

  const matchType = exactMatch ? "exact" : "similar";
  const correctCriteria = getCriteria(bank, original.criteriaCode) ?? original;
  const correctLabel = formatCriteria(original);
  const wrongLabel = formatCriteria(option);
  const details = [];

  if (matchType === "similar") {
    details.push("가장 가까운 정답 사례를 참고해 기준 범위를 비교했습니다.");
  }

  details.push(`원래 정답 문장: ${original.statement}`);

  if (original.defectCase && original.defectCase !== option.defectCase) {
    details.push(`가장 가까운 원문 결함사례: ${original.defectCase}`);
  }

  appendCriteriaScopeDetails(details, bank, original.criteriaCode, correctLabel);
  appendCriteriaScopeDetails(details, bank, option.criteriaCode, wrongLabel);

  return {
    matchType,
    confidence: original.score ?? 1,
    wrongCriteriaCode: option.criteriaCode,
    wrongCriteriaName: option.criteriaName,
    correctCriteriaCode: original.criteriaCode,
    correctCriteriaName: original.criteriaName,
    originalDefectCase: original.defectCase,
    originalStatement: original.statement,
    summary: `틀린 판단입니다. 이 결함사례는 ${wrongLabel}가 아니라 ${correctLabel} 결함에 해당합니다.`,
    details,
  };
}

function buildDefectJudgmentQuestions(falsePool, truePool, count, random, meta = {}) {
  const questions = [];

  for (let index = 0; index < count; index += 1) {
    const falseOptions = falsePool.slice(index * 2, index * 2 + 2);
    const trueOptions = truePool.slice(index * 3, index * 3 + 3);
    const optionsForQuestion = shuffle([...falseOptions, ...trueOptions], random).map(
      (option, optionIndex) => ({
        id: option.id,
        label: `${optionIndex + 1})`,
        statement: judgmentStatement(option),
        criteriaCode: option.criteriaCode,
        criteriaName: option.criteriaName,
        defectCase: option.defectCase,
        correctAnswer: option.correctAnswer ?? null,
        correctAnswerName: option.correctAnswerName ?? null,
        family: option.family ?? "",
        trapAxis: option.trapAxis ?? "",
        wrongnessReason: option.wrongnessReason ?? "",
        isCorrect: Boolean(option.isCorrect),
      }),
    );

    questions.push({
      id: `q-${index + 1}`,
      number: index + 1,
      type: "multi",
      mode: STUDY_MODES.DEFECT_JUDGMENT,
      answerTarget: "incorrect",
      prompt: DEFAULT_PROMPT_KO,
      meta,
      options: optionsForQuestion,
    });
  }

  return questions;
}

function createBinaryDefectJudgmentSession(bank, options = {}) {
  validateBank(bank);

  const random = createSeededRandom(options.seed ?? Date.now());
  const falseBySourceId = new Map();
  for (const item of shuffle(buildRuntimeFalsePool(bank), random)) {
    if (!item.sourceId || falseBySourceId.has(item.sourceId)) continue;
    falseBySourceId.set(item.sourceId, item);
  }

  const pairs = shuffle(bank.truePool, random)
    .map((source) => ({ source, falseOption: falseBySourceId.get(source.id) }))
    .filter((item) => item.falseOption);
  const count = clampCount(options.count ?? DEFAULT_SESSION_COUNT, pairs.length);
  const questions = pairs.slice(0, count).map((pair, index) =>
    buildBinaryDefectJudgmentQuestion(bank, random, {
      index,
      mode: options.mode,
      answerTarget: options.answerTarget,
      promptKo: options.promptKo,
      source: pair.source,
      falseOption: pair.falseOption,
    }),
  );

  return makeSession(options.mode, questions, random);
}

function buildBinaryDefectJudgmentQuestion(bank, random, config) {
  const { index, mode, answerTarget, promptKo, source, falseOption } = config;
  const correctCriteria = getCriteria(bank, source.criteriaCode) ?? source;
  const trueOption = {
    id: `bt-${source.id}`,
    label: "1)",
    statement: judgmentStatement(source),
    criteriaCode: source.criteriaCode,
    criteriaName: correctCriteria.name ?? source.criteriaName,
    defectCase: source.defectCase,
    correctAnswer: source.criteriaCode,
    correctAnswerName: correctCriteria.name ?? source.criteriaName,
    family: "anchor",
    trapAxis: "correct-criteria",
    wrongnessReason: "",
    isCorrect: true,
  };
  const falseJudgment = {
    ...falseOption,
    label: "2)",
  };
  const options = shuffle([trueOption, falseJudgment], random).map((option, optionIndex) => ({
    ...option,
    label: `${optionIndex + 1})`,
  }));

  return {
    id: `q-${index + 1}`,
    number: index + 1,
    type: "single",
    presentation: "judgment",
    mode,
    answerTarget,
    prompt: promptKo,
    promptKo,
    body: source.defectCase,
    badge: "",
    meta: {
      sourceId: source.id,
      sourceRow: source.sourceRow ?? null,
      correctCriteriaCode: source.criteriaCode,
      falseCriteriaCode: falseOption.criteriaCode,
    },
    options,
  };
}

function buildRuntimeFalsePool(bank) {
  const out = [];
  const seen = new Set();

  for (const source of bank.truePool ?? []) {
    const correctCode = source.criteriaCode;
    const correctCriteria = getCriteria(bank, correctCode) ?? source;
    const candidates = rankedGraphSimilarCriteriaCodes(bank, correctCode).filter((code) => {
      if (code === correctCode || !getCriteria(bank, code)) return false;
      return isRuntimeGraphCandidate(bank, source, code);
    });

    for (const wrongCode of candidates.slice(0, 2)) {
      const wrongCriteria = getCriteria(bank, wrongCode);
      const id = `rtf-${source.id}-${wrongCode}`;
      if (!wrongCriteria || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        statement: judgmentStatement({
          defectCase: source.defectCase,
          criteriaCode: wrongCode,
          criteriaName: wrongCriteria.name,
        }),
        defectCase: source.defectCase,
        criteriaCode: wrongCode,
        criteriaName: wrongCriteria.name,
        correctAnswer: correctCode,
        correctAnswerName: correctCriteria.name ?? source.criteriaName,
        isCorrect: false,
        family: "runtime-graph",
        trapAxis: "similar-criteria",
        source: "runtime-graph",
        sourceId: source.id,
        wrongnessReason: `${formatCriteria(wrongCriteria)}는 그래프상 유사 기준이지만, 이 사례의 정답 기준은 ${formatCriteria(
          correctCriteria,
        )}입니다.`,
      });
    }
  }

  return out;
}

function rankWeakCriteriaCodes(criteriaSummary) {
  const criteria = criteriaSummary?.criteria ?? criteriaSummary ?? {};
  return Object.entries(criteria)
    .map(([code, item]) => ({ code: item?.code ?? code, ...item }))
    .filter((item) => item?.code)
    .sort(
      (a, b) =>
        (Number(b.weakScore ?? 0) - Number(a.weakScore ?? 0)) ||
        (Number(b.wrongNoteCount ?? 0) - Number(a.wrongNoteCount ?? 0)) ||
        String(a.code).localeCompare(String(b.code)),
    )
    .map((item) => item.code);
}

function prioritizeWeakFalsePool(bank, weakCriteriaCodes, random) {
  const weak = new Set(weakCriteriaCodes);
  const falsePool = buildRuntimeFalsePool(bank);
  if (weak.size === 0) return shuffle(falsePool, random);

  const correctCodeByCase = new Map(
    (bank.truePool ?? []).map((item) => [normalizeText(item.defectCase), item.criteriaCode]),
  );
  const weakItems = [];
  const rest = [];

  for (const item of falsePool) {
    const correctCode = correctCodeByCase.get(normalizeText(item.defectCase));
    if (correctCode && weak.has(correctCode)) weakItems.push(item);
    else rest.push(item);
  }

  return uniqueById([...shuffle(weakItems, random), ...shuffle(rest, random)]);
}

function prioritizeWeakTruePool(bank, weakCriteriaCodes, random) {
  const weak = new Set(weakCriteriaCodes);
  if (weak.size === 0) return shuffle(bank.truePool, random);

  const weakItems = [];
  const rest = [];
  for (const item of bank.truePool ?? []) {
    if (weak.has(item.criteriaCode)) weakItems.push(item);
    else rest.push(item);
  }

  return uniqueById([...shuffle(weakItems, random), ...shuffle(rest, random)]);
}

function uniqueById(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function validateBank(bank) {
  if (!bank || !Array.isArray(bank.truePool)) {
    throw new Error("Question bank must include a truePool array.");
  }
  if (!bank.criteria || !bank.similarCriteriaByCode) {
    throw new Error("Question bank must include criteria and similarCriteriaByCode.");
  }
  if (bank.truePool.length < 3) {
    throw new Error("Question bank needs at least 3 true judgment statements.");
  }
  if (buildRuntimeFalsePool(bank).length < 2) {
    throw new Error("Question bank needs at least 2 graph-generated false judgment statements.");
  }
}

function shuffle(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function findExactOriginal(option, bank) {
  const needle = normalizeText(option.defectCase);
  if (!needle) return null;

  return (
    bank.truePool?.find(
      (candidate) =>
        candidate.criteriaCode !== option.criteriaCode &&
        normalizeText(candidate.defectCase) === needle,
    ) ?? null
  );
}

function findSimilarOriginal(option, bank) {
  const needle = normalizeText(option.defectCase);
  if (!needle) return null;

  let best = null;
  for (const candidate of bank.truePool ?? []) {
    if (candidate.criteriaCode === option.criteriaCode) continue;
    const score = similarityScore(needle, normalizeText(candidate.defectCase));
    if (!best || score > best.score) {
      best = { ...candidate, score };
    }
  }

  return best && best.score >= 0.46 ? best : null;
}

function similarityScore(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftGrams = ngrams(left, 2);
  const rightGrams = ngrams(right, 2);
  if (leftGrams.size === 0 || rightGrams.size === 0) return 0;

  let intersection = 0;
  for (const gram of leftGrams) {
    if (rightGrams.has(gram)) intersection += 1;
  }

  const dice = (2 * intersection) / (leftGrams.size + rightGrams.size);
  const containment = intersection / Math.min(leftGrams.size, rightGrams.size);
  return Math.max(dice, containment * 0.92);
}

function ngrams(value, size) {
  const grams = new Set();
  if (value.length <= size) {
    if (value) grams.add(value);
    return grams;
  }

  for (let index = 0; index <= value.length - size; index += 1) {
    grams.add(value.slice(index, index + size));
  }
  return grams;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "")
    .replace(/(의|은|는|이|가|을|를|에|에서|으로|로|과|와|및)/gu, "");
}

function getCriteria(bank, code) {
  return bank?.criteria?.[code] ?? null;
}

function rankedGraphSimilarCriteriaCodes(bank, criteriaCode) {
  const sourceId = `criteria:${criteriaCode}`;
  const scored = new Map();
  for (const edge of bank?.wrongnoteGraph?.edges ?? []) {
    if (edge.type !== "SIMILAR_TO" || edge.source !== sourceId || !edge.target?.startsWith("criteria:")) continue;
    const targetCode = edge.target.slice("criteria:".length);
    const rank = Number(edge.properties?.rank ?? 999);
    const score = 1000 - rank;
    scored.set(targetCode, Math.max(scored.get(targetCode) ?? 0, score));
  }

  for (const [index, code] of (bank?.similarCriteriaByCode?.[criteriaCode] ?? []).entries()) {
    scored.set(code, Math.max(scored.get(code) ?? 0, 500 - index));
  }

  return [...scored.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([code]) => code);
}

function criteriaPairHasCoreOverlap(bank, leftCode, rightCode) {
  const left = new Set(criteriaScopeTokens(bank, leftCode));
  const right = new Set(criteriaScopeTokens(bank, rightCode));
  for (const token of left) {
    if (right.has(token)) return true;
  }
  return false;
}

function isRuntimeGraphCandidate(bank, source, candidateCode) {
  const correctCriteria = getCriteria(bank, source.criteriaCode);
  const candidateCriteria = getCriteria(bank, candidateCode);
  const sameGroup = criteriaGroupKey(correctCriteria) === criteriaGroupKey(candidateCriteria);
  if (!correctCriteria || !candidateCriteria) return false;
  if (correctCriteria.domain !== candidateCriteria.domain) return false;
  if (!criteriaPairHasCoreOverlap(bank, source.criteriaCode, candidateCode)) return false;
  if (!hasCandidateNameOverlap(source.defectCase, candidateCriteria, sameGroup)) return false;
  return hasClaimedCriteriaScopeOverlap({ ...source, criteriaCode: candidateCode, isCorrect: false }, bank);
}

function hasClaimedCriteriaScopeOverlap(item, bank) {
  if (!item || item.isCorrect) return true;
  const body = normalizeForScopeMatch(item.defectCase);
  if (!body) return false;
  const tokens = criteriaScopeTokens(bank, item.criteriaCode);
  return tokens.some((token) => body.includes(normalizeForScopeMatch(token)));
}

function hasCandidateNameOverlap(defectCase, criteria, sameGroup) {
  const body = normalizeForScopeMatch(defectCase);
  const bodyTokens = normalizedTokenSet(defectCase);
  if (!body) return false;
  const matches = criteriaNameAnchorTokens(criteria).filter((token) => {
    const normalized = normalizeLexicalToken(token);
    if (!normalized) return false;
    if (bodyTokens.has(normalized)) return true;
    return normalized.length >= 4 && body.includes(normalized);
  });
  if (matches.length === 0) return false;
  if (sameGroup) return true;
  return matches.length >= 2 || matches.some((token) => normalizeLexicalToken(token).length >= 3);
}

function criteriaScopeTokens(bank, criteriaCode) {
  const criteria = getCriteria(bank, criteriaCode);
  const sourceParts = [criteria?.name, criteria?.requirement];
  for (const item of bank?.checkItemPool ?? []) {
    if (item.criteriaCode === criteriaCode) sourceParts.push(item.question, item.keywords);
  }
  for (const item of bank?.defectCasePool ?? []) {
    if (item.criteriaCode === criteriaCode) sourceParts.push(item.defectCase);
  }
  return uniqueTokens(sourceParts.join(" "));
}

function uniqueTokens(value) {
  const seen = new Set();
  const tokens = [];
  for (const token of rawTokens(value)) {
    if (token.length < 2 || DOMAIN_STOPWORDS.has(token) || isGenericScopeToken(token) || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function criteriaNameAnchorTokens(criteria) {
  const seen = new Set();
  const tokens = [];
  for (const token of rawTokens(criteria?.name)) {
    if (token.length < 2 || DOMAIN_STOPWORDS.has(token) || ANCHOR_STOPWORDS.has(token) || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function rawTokens(value) {
  return [...String(value ?? "").matchAll(/[가-힣A-Za-z0-9]+/gu)].map((match) => match[0]);
}

function normalizedTokenSet(value) {
  return new Set(uniqueTokens(value).map(normalizeLexicalToken).filter(Boolean));
}

function normalizeLexicalToken(value) {
  return normalizeForScopeMatch(value).replace(
    /(으로|에서|에게|에는|으로는|로는|과는|와는|의|은|는|이|가|을|를|에|과|와|로)$/u,
    "",
  );
}

function criteriaGroupKey(criteria) {
  if (!criteria) return "";
  if (criteria.groupCode) return criteria.groupCode;
  const code = String(criteria.code ?? "");
  const parts = code.split(".");
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}.` : code;
}

function isGenericScopeToken(token) {
  return GENERIC_SCOPE_ROOTS.some((root) => token.includes(root));
}

function normalizeForScopeMatch(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\p{P}\p{S}\s]+/gu, "")
    .toLowerCase();
}

function judgmentStatement(option) {
  const body = String(option.defectCase ?? "").replace(/\s+/g, " ").trim();
  return `심사 과정에서 ${body} ${option.criteriaCode} ${option.criteriaName} 결함에 해당한다.`;
}

function formatCriteria(item) {
  return `${item.criteriaCode ?? item.code} ${item.criteriaName ?? item.name}`.trim();
}

function appendCriteriaScopeDetails(details, bank, criteriaCode, label) {
  const criteria = getCriteria(bank, criteriaCode);
  const examples = criteriaExamples(bank, criteriaCode);

  if (criteria?.requirement) {
    details.push(`${label} 기준 요구사항: ${truncateText(criteria.requirement)}`);
  }
  if (examples.checkItems.length) {
    details.push(`${label} 확인사항 예: ${examples.checkItems.map((item) => truncateText(item, 90)).join(" / ")}`);
  }
  if (examples.defectCases.length) {
    details.push(`${label} 결함사례 예: ${examples.defectCases.map((item) => truncateText(item, 90)).join(" / ")}`);
  }
}

function criteriaExamples(bank, criteriaCode, limit = 2) {
  return {
    checkItems: (bank?.checkItemPool ?? [])
      .filter((item) => item.criteriaCode === criteriaCode)
      .map((item) => item.question)
      .filter(Boolean)
      .slice(0, limit),
    defectCases: (bank?.defectCasePool ?? [])
      .filter((item) => item.criteriaCode === criteriaCode)
      .map((item) => item.defectCase)
      .filter(Boolean)
      .slice(0, limit),
  };
}

function truncateText(value, maxLength = 140) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function makeSession(mode, questions, random) {
  return {
    id: `session-${Date.now()}-${Math.floor(random() * 100000)}`,
    createdAt: new Date().toISOString(),
    mode,
    questionCount: questions.length,
    questions,
  };
}

function clampCount(count, max) {
  const parsed = Number.parseInt(count, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return Math.min(DEFAULT_SESSION_COUNT, max);
  return Math.max(0, Math.min(parsed, max));
}

function validateCriterionBank(bank, poolKey) {
  if (!bank || !Array.isArray(bank[poolKey]) || bank[poolKey].length === 0) {
    throw new Error(`Question bank must include a non-empty ${poolKey}.`);
  }
  if (!bank.criteria || !bank.similarCriteriaByCode) {
    throw new Error("Question bank must include criteria and similarCriteriaByCode.");
  }
}

function buildCriterionQuestion(bank, random, config) {
  const { index, mode, promptKo, body, correctCode, badge, meta } = config;
  const distractors = pickDistractors(bank, correctCode, 4, random, body);
  const codes = shuffle([correctCode, ...distractors], random);

  const options = codes.map((code, optionIndex) => {
    const criteria = getCriteria(bank, code);
    return {
      id: code,
      label: `${optionIndex + 1})`,
      code,
      name: criteria?.name ?? code,
      isCorrect: code === correctCode,
    };
  });

  return {
    id: `q-${index + 1}`,
    number: index + 1,
    type: "single",
    mode,
    promptKo,
    body,
    badge: badge ?? "",
    meta: meta ?? {},
    options,
  };
}

function pickDistractors(bank, correctCode, n, random, sourceText = "") {
  const ranked = rankedCriterionDistractors(bank, correctCode, sourceText);
  const picked = ranked.slice(0, n).map((item) => item.code);

  if (picked.length < n) {
    const exclude = new Set([correctCode, ...picked]);
    const fallback = sampleN(fallbackCandidates(bank, correctCode, exclude), n - picked.length, random);
    picked.push(...fallback);
  }

  return picked.slice(0, n);
}

function rankedCriterionDistractors(bank, correctCode, sourceText) {
  const correctCriteria = getCriteria(bank, correctCode);
  const sourceTokens = evidenceTokenSet(sourceText);
  const correctTokens = evidenceTokenSet(criteriaScopeTokens(bank, correctCode).join(" "));
  const similarRank = new Map((bank.similarCriteriaByCode?.[correctCode] ?? []).map((code, index) => [code, index]));
  const semanticEntries = bank.criteriaSimilarity?.similarCriteriaByCode?.[correctCode] ?? [];
  const semanticRank = new Map(semanticEntries.map((item, index) => [item.code, index]));
  const semanticScore = new Map(semanticEntries.map((item) => [item.code, Number(item.score ?? 0) / 100]));
  const candidateCodes = semanticEntries.length ? semanticEntries.map((item) => item.code) : Object.keys(bank.criteria ?? {});

  return candidateCodes
    .filter((code) => code !== correctCode && getCriteria(bank, code))
    .map((code) => {
      const criteria = getCriteria(bank, code);
      const candidateTokens = evidenceTokenSet(criteriaScopeTokens(bank, code).join(" "));
      const sameGroup = criteriaGroupKey(correctCriteria) === criteriaGroupKey(criteria);
      const sameDomain = correctCriteria?.domain && correctCriteria.domain === criteria?.domain;
      const sourceOverlap = tokenOverlapScore(sourceTokens, candidateTokens);
      const criteriaOverlap = tokenOverlapScore(correctTokens, candidateTokens);
      const graphScore = criterionGraphScore(bank, correctCode, code);
      const similarScore = similarRank.has(code) ? (20 - Math.min(similarRank.get(code), 19)) / 20 : 0;
      const prebuiltScore = semanticScore.get(code) ?? 0;
      const prebuiltRankScore = semanticRank.has(code) ? (24 - Math.min(semanticRank.get(code), 23)) / 24 : 0;
      const score =
        sourceOverlap * 3.4 +
        criteriaOverlap * 1.6 +
        graphScore * 0.45 +
        prebuiltScore * 2.2 +
        prebuiltRankScore * 0.45 +
        similarScore * 0.18 +
        (sameGroup ? 1.05 : 0) +
        (sameDomain ? 0.45 : 0);

      return { code, score };
    })
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
}

function sampleN(items, n, random) {
  return shuffle(items, random).slice(0, n);
}

function evidenceTokenSet(value) {
  return new Set(uniqueTokens(value).map(normalizeLexicalToken).filter(Boolean));
}

function tokenOverlapScore(leftTokens, rightTokens) {
  const left = [...leftTokens];
  const right = [...rightTokens];
  if (left.length === 0 || right.length === 0) return 0;

  let hits = 0;
  for (const leftToken of left) {
    if (right.some((rightToken) => tokensCompatible(leftToken, rightToken))) hits += 1;
  }

  return Math.max(hits / left.length, hits / right.length);
}

function tokensCompatible(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length < 2 || right.length < 2) return false;
  return left.includes(right) || right.includes(left);
}

function criterionGraphScore(bank, leftCode, rightCode) {
  const leftId = `criteria:${leftCode}`;
  const rightId = `criteria:${rightCode}`;
  let score = 0;

  for (const edge of bank?.wrongnoteGraph?.edges ?? []) {
    const samePair =
      (edge.source === leftId && edge.target === rightId) || (edge.source === rightId && edge.target === leftId);
    if (!samePair) continue;

    if (edge.type === "SIMILAR_TO") {
      const rank = Number(edge.properties?.rank ?? 20);
      score = Math.max(score, (20 - Math.min(rank, 20)) / 20);
    }
    if (edge.type === "CONFUSED_WITH") {
      const count = Number(edge.properties?.count ?? 1);
      score = Math.max(score, Math.min(count, 10) / 12);
    }
  }

  return score;
}

function fallbackCandidates(bank, correctCode, exclude) {
  const base = getCriteria(bank, correctCode);
  const all = Object.keys(bank.criteria ?? {}).filter((code) => !exclude.has(code));
  const sameDomain = all.filter((code) => getCriteria(bank, code)?.domain === base?.domain);
  const others = all.filter((code) => getCriteria(bank, code)?.domain !== base?.domain);
  return [...sameDomain, ...others];
}

function explainCriterionChoice(question, selectedOptionId, bank, subject) {
  const id = Array.isArray(selectedOptionId) ? selectedOptionId[0] : selectedOptionId;
  const correctOption = question.options.find((option) => option.isCorrect);
  const selectedOption = question.options.find((option) => option.id === id) ?? null;
  const correctCriteria = getCriteria(bank, correctOption?.code);
  const selectedCriteria = selectedOption ? getCriteria(bank, selectedOption.code) : null;
  const isCorrect = Boolean(selectedOption?.isCorrect);

  const correctLabel = `${correctOption.code} ${correctOption.name}`;
  const focusKind = question.mode === STUDY_MODES.CHECK_ITEM ? "checkItem" : "defectCase";
  const correctExplanation = criterionOptionExplanation(correctOption, bank, focusKind, false);
  const distractorExplanations = question.options
    .filter((option) => !option.isCorrect)
    .map((option) => criterionOptionExplanation(option, bank, focusKind, option.id === id));
  const details = [];

  if (correctCriteria?.requirement) {
    details.push(`${correctLabel} 기준 요구사항: ${truncateText(correctCriteria.requirement)}`);
  }

  if (!isCorrect && selectedOption) {
    const selectedLabel = `${selectedOption.code} ${selectedOption.name}`;
    if (selectedCriteria?.requirement) {
      details.push(
        `${selectedLabel}는 ${truncateText(selectedCriteria.requirement)}에 관한 기준이라 ${subject}의 핵심과 다릅니다.`,
      );
    }
  }

  details.push(`${subject}는 ${correctLabel} 기준에 해당합니다.`);

  return {
    isCorrect,
    correctCriteriaCode: correctOption.code,
    correctCriteriaName: correctOption.name,
    selectedCriteriaCode: selectedOption?.code ?? null,
    selectedCriteriaName: selectedOption?.name ?? null,
    correctExplanation,
    distractorExplanations,
    summary: isCorrect
      ? `정답입니다. ${subject}는 ${correctLabel} 기준에 해당합니다.`
      : `틀린 선택입니다. ${subject}는 ${
          selectedOption ? `${selectedOption.code} ${selectedOption.name}가 아니라 ` : ""
        }${correctLabel} 기준에 해당합니다.`,
    details,
  };
}

function criterionOptionExplanation(option, bank, focusKind, isSelected) {
  const criteria = getCriteria(bank, option?.code);
  const label = `${option.code} ${option.name}`;
  const examples = criteriaExamples(bank, option.code);
  const details = [];

  if (criteria?.requirement) {
    details.push(`${label} 기준 요구사항: ${truncateText(criteria.requirement)}`);
  }

  if (focusKind === "checkItem") {
    if (examples.checkItems.length) {
      details.push(`${label} 확인사항 예: ${examples.checkItems.map((item) => truncateText(item, 110)).join(" / ")}`);
    } else if (criteria?.requirement) {
      details.push(`${label} 확인사항 기준: ${truncateText(criteria.requirement, 110)}`);
    }
  } else if (examples.defectCases.length) {
    details.push(`${label} 결함사례 예: ${examples.defectCases.map((item) => truncateText(item, 110)).join(" / ")}`);
  } else if (criteria?.requirement) {
    details.push(`${label} 결함사례 기준: ${truncateText(criteria.requirement, 110)}`);
  }

  return {
    code: option.code,
    name: option.name,
    isSelected,
    summary: `${label}는 ${focusKind === "checkItem" ? "확인사항" : "결함사례"} 범위가 다음과 같습니다.`,
    details,
  };
}
