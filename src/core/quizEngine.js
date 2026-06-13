const DEFAULT_PROMPT_KO =
  "ISMS-P 인증심사에서 다음 결함사례에 대한 심사원의 판단으로 옳은 것을 모두 고르시오. (2개)";

export const STUDY_MODES = {
  DEFECT_JUDGMENT: "defect-judgment",
  DEFECT_CRITERION: "defect-criterion",
  CHECK_ITEM: "check-item",
};

const DEFECT_CRITERION_PROMPT_KO = "다음 결함사례는 어떤 ISMS-P 인증기준 결함에 해당하나요?";
const CHECK_ITEM_PROMPT_KO = "다음 확인사항은 어떤 ISMS-P 인증기준에 해당하나요?";

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
  const trueCapacity = Math.floor((bank.truePool?.length ?? 0) / 2);
  const falseCapacity = Math.floor((bank.falsePool?.length ?? 0) / 3);
  const maxCount = Math.max(0, Math.min(trueCapacity, falseCapacity));
  const parsed = Number.parseInt(count, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) return Math.min(50, maxCount);
  return Math.min(parsed, maxCount);
}

export function createSession(bank, options = {}) {
  validateBank(bank);

  const random = createSeededRandom(options.seed ?? Date.now());
  const count = normalizeCount(options.count ?? 50, bank);
  const falsePool = shuffle(bank.falsePool, random);
  const truePool = shuffle(bank.truePool, random);
  const questions = [];

  for (let index = 0; index < count; index += 1) {
    const falseOptions = falsePool.slice(index * 3, index * 3 + 3);
    const trueOptions = truePool.slice(index * 2, index * 2 + 2);
    const optionsForQuestion = shuffle([...falseOptions, ...trueOptions], random).map(
      (option, optionIndex) => ({
        id: option.id,
        label: `${optionIndex + 1})`,
        statement: option.statement,
        criteriaCode: option.criteriaCode,
        criteriaName: option.criteriaName,
        defectCase: option.defectCase,
        isCorrect: Boolean(option.isCorrect),
      }),
    );

    questions.push({
      id: `q-${index + 1}`,
      number: index + 1,
      type: "multi",
      mode: STUDY_MODES.DEFECT_JUDGMENT,
      prompt: DEFAULT_PROMPT_KO,
      options: optionsForQuestion,
    });
  }

  return makeSession(STUDY_MODES.DEFECT_JUDGMENT, questions, random);
}

export function createStudySession(bank, options = {}) {
  const mode = options.mode ?? STUDY_MODES.DEFECT_JUDGMENT;
  if (mode === STUDY_MODES.DEFECT_CRITERION) return createDefectCriterionSession(bank, options);
  if (mode === STUDY_MODES.CHECK_ITEM) return createCheckItemSession(bank, options);
  return createDefectJudgmentSession(bank, options);
}

export function createDefectJudgmentSession(bank, options = {}) {
  // Preserve the existing mixed-judgment quiz; createSession already tags mode.
  return createSession(bank, options);
}

export function createDefectCriterionSession(bank, options = {}) {
  validateCriterionBank(bank, "defectCasePool");

  const random = createSeededRandom(options.seed ?? Date.now());
  const pool = shuffle(bank.defectCasePool, random);
  const count = clampCount(options.count ?? 50, pool.length);

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
  const count = clampCount(options.count ?? 50, pool.length);

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
  const correct = question.options.find((option) => option.isCorrect) ?? null;

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
    question.options.filter((option) => option.isCorrect).map((option) => option.id),
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

    for (const option of question.options.filter((item) => item.isCorrect)) {
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
    return {
      matchType: "none",
      confidence: 0,
      wrongCriteriaCode: option.criteriaCode,
      wrongCriteriaName: option.criteriaName,
      summary:
        "이 조합은 문제은행에서 오답 후보로 생성된 판단문입니다. 동일 결함사례의 확정 정답 매핑은 찾지 못했습니다.",
      details: [
        `${formatCriteria(option)}로 단정할 수 있는 원문 결함사례가 문제은행에서 확인되지 않습니다.`,
        wrongCriteria?.requirement
          ? `${formatCriteria(option)} 기준 요구사항: ${truncateText(wrongCriteria.requirement)}`
          : "",
        "유사 결함사례 검색으로 보완했지만 충분히 가까운 확정 정답 사례도 찾지 못했습니다.",
      ].filter(Boolean),
    };
  }

  const matchType = exactMatch ? "exact" : "similar";
  const correctCriteria = getCriteria(bank, original.criteriaCode) ?? original;
  const correctLabel = formatCriteria(original);
  const wrongLabel = formatCriteria(option);
  const details = [];

  if (matchType === "similar") {
    details.push(
      "동일 결함사례의 확정 정답 매핑은 찾지 못했지만, 문장 유사도가 가장 높은 원문 결함사례로 보완했습니다.",
    );
  }

  details.push(`원래 정답 문장: ${original.statement}`);

  if (original.defectCase && original.defectCase !== option.defectCase) {
    details.push(`가장 가까운 원문 결함사례: ${original.defectCase}`);
  }

  if (correctCriteria?.requirement) {
    details.push(`${correctLabel} 기준 요구사항: ${truncateText(correctCriteria.requirement)}`);
  }

  if (wrongCriteria?.requirement) {
    details.push(
      `${wrongLabel}는 ${truncateText(wrongCriteria.requirement)}에 관한 기준이라 이 결함사례의 핵심과 다릅니다.`,
    );
  }

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

function validateBank(bank) {
  if (!bank || !Array.isArray(bank.truePool) || !Array.isArray(bank.falsePool)) {
    throw new Error("Question bank must include truePool and falsePool arrays.");
  }
  if (bank.truePool.length < 2 || bank.falsePool.length < 3) {
    throw new Error("Question bank needs at least 2 true and 3 false judgment statements.");
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

function formatCriteria(item) {
  return `${item.criteriaCode ?? item.code} ${item.criteriaName ?? item.name}`.trim();
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
  if (!Number.isFinite(parsed) || parsed <= 0) return Math.min(50, max);
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
  const distractors = pickDistractors(bank, correctCode, 4, random);
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

function pickDistractors(bank, correctCode, n, random) {
  const exclude = new Set([correctCode]);
  const similar = (bank.similarCriteriaByCode?.[correctCode] ?? []).filter(
    (code) => !exclude.has(code) && getCriteria(bank, code),
  );

  const picked = sampleN(similar, n, random);
  for (const code of picked) exclude.add(code);

  if (picked.length < n) {
    // Vetted similar list was too short; fall back to same-domain then global,
    // sampled deterministically so a given seed stays reproducible.
    const fallback = sampleN(fallbackCandidates(bank, correctCode, exclude), n - picked.length, random);
    picked.push(...fallback);
  }

  return picked.slice(0, n);
}

function sampleN(items, n, random) {
  return shuffle(items, random).slice(0, n);
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
    summary: isCorrect
      ? `정답입니다. ${subject}는 ${correctLabel} 기준에 해당합니다.`
      : `틀린 선택입니다. ${subject}는 ${
          selectedOption ? `${selectedOption.code} ${selectedOption.name}가 아니라 ` : ""
        }${correctLabel} 기준에 해당합니다.`,
    details,
  };
}
