import {
  STUDY_MODES,
  buildWeakAreaSummary,
  createStudySession,
  evaluateAnswer,
  evaluateSingleAnswer,
  explainCheckItemAnswer,
  explainDefectCriterionAnswer,
  explainIncorrectOption,
  getQuestionStats,
} from "../src/core/quizEngine.js";
import { t, languages } from "../src/i18n.js";
import { createBrowserPlatform } from "../src/platform/adapters.js";

const platform = createBrowserPlatform();
const state = {
  bank: null,
  screen: "home",
  mode: STUDY_MODES.DEFECT_JUDGMENT,
  session: null,
  currentIndex: 0,
  answers: {},
  checked: {},
  locale: platform.storage.get("locale", platform.locale.defaultLocale()),
  sessionSize: platform.storage.get("sessionSize", 50),
};

const MODES = [
  {
    mode: STUDY_MODES.DEFECT_JUDGMENT,
    titleKey: "modeDefectJudgment",
    descKey: "modeDefectJudgmentDesc",
  },
  {
    mode: STUDY_MODES.DEFECT_CRITERION,
    titleKey: "modeDefectCriterion",
    descKey: "modeDefectCriterionDesc",
  },
  { mode: STUDY_MODES.CHECK_ITEM, titleKey: "modeCheckItem", descKey: "modeCheckItemDesc" },
];

const app = document.querySelector("#app");

init();

async function init() {
  renderLoading();
  try {
    const response = await fetch(new URL("./data/ismsp-defect-bank.json", import.meta.url));
    if (!response.ok) throw new Error(`Question bank request failed: ${response.status}`);
    state.bank = await response.json();
    renderHome();
  } catch (error) {
    renderError(error);
  }
}

function startSession(mode, count) {
  state.mode = mode;
  state.sessionSize = Number(count ?? state.sessionSize);
  platform.storage.set("sessionSize", state.sessionSize);
  state.session = createStudySession(state.bank, {
    mode,
    count: state.sessionSize,
    seed: Date.now(),
  });
  state.currentIndex = 0;
  state.answers = {};
  state.checked = {};
  state.screen = "quiz";
  render();
}

function goHome() {
  state.screen = "home";
  renderHome();
}

function renderLoading() {
  app.innerHTML = `
    <main class="app-shell">
      <section class="loading-panel">${t(state.locale, "loading")}</section>
    </main>
  `;
}

function renderError(error) {
  app.innerHTML = `
    <main class="app-shell">
      <section class="loading-panel error-state">
        <strong>${t(state.locale, "loadFailed")}</strong>
        <span>${escapeHtml(error.message)}</span>
      </section>
    </main>
  `;
}

function renderHome() {
  app.innerHTML = `
    <main class="app-shell home-shell">
      <section class="home-panel">
        ${renderHeader()}
        <p class="home-hint">${t(state.locale, "chooseMode")}</p>
        <div class="mode-grid">
          ${MODES.map(
            (item) => `
              <button class="mode-card" data-mode="${escapeAttribute(item.mode)}">
                <strong>${t(state.locale, item.titleKey)}</strong>
                <span>${t(state.locale, item.descKey)}</span>
              </button>
            `,
          ).join("")}
        </div>
        ${renderHomeControls()}
        ${renderBankMeta()}
      </section>
    </main>
  `;
  wireHomeEvents();
}

function renderHomeControls() {
  return `
    <section class="control-block home-controls">
      <label>
        <span>${t(state.locale, "sessionSize")}</span>
        <select data-control="session-size">
          ${[10, 25, 50].map((count) => optionHtml(count, `${count}`, count === state.sessionSize)).join("")}
        </select>
      </label>
      <label>
        <span>${t(state.locale, "language")}</span>
        <select data-control="locale">
          ${languages
            .map((language) => optionHtml(language.code, language.label, language.code === state.locale))
            .join("")}
        </select>
      </label>
    </section>
  `;
}

function render() {
  const question = currentQuestion();
  const stats = getQuestionStats(state.session.questions, state.answers);
  const weakAreas = buildWeakAreaSummary(state.session.questions, state.answers);
  const checked = Boolean(state.checked[question.id]);
  const selectedIds = state.answers[question.id] ?? [];
  const result = checked ? evaluateQuestion(question, selectedIds) : null;
  const selectLabel = question.type === "single" ? t(state.locale, "selectOne") : t(state.locale, "selectTwo");

  app.innerHTML = `
    <main class="app-shell">
      <aside class="side-panel">
        ${renderHeader()}
        ${renderControls()}
        ${renderStats(stats)}
        ${renderQuestionNav()}
      </aside>

      <section class="quiz-panel">
        <div class="question-topline">
          <span>${t(state.locale, "question")} ${question.number} / ${state.session.questionCount}</span>
          <span>${selectLabel}</span>
        </div>
        <h1>${escapeHtml(questionPrompt(question))}</h1>
        ${renderQuestionBody(question)}
        <div class="options">
          ${question.options.map((option) => renderOption(question, option, selectedIds, checked)).join("")}
        </div>
        <div class="action-row">
          <button class="secondary" data-action="previous">${t(state.locale, "previousQuestion")}</button>
          <button class="primary" data-action="check">${t(state.locale, "checkAnswer")}</button>
          <button class="secondary" data-action="next">${t(state.locale, "nextQuestion")}</button>
        </div>
        ${renderStatus(question, result)}
      </section>

      <aside class="review-panel">
        ${renderReview(question, checked, selectedIds)}
        ${renderWeakAreas(weakAreas)}
        ${renderBankMeta()}
      </aside>
    </main>
  `;

  wireQuizEvents();
}

function renderHeader() {
  return `
    <header class="brand-block">
      <div class="brand-mark" aria-hidden="true">
        <span>1</span><span>2</span><span>3</span>
      </div>
      <div>
        <p class="eyebrow">ISMS-P</p>
        <h2>${t(state.locale, "appTitle")}</h2>
        <p>${t(state.locale, "appSubtitle")}</p>
      </div>
    </header>
  `;
}

function renderControls() {
  return `
    <section class="control-block">
      <label>
        <span>${t(state.locale, "sessionSize")}</span>
        <select data-control="session-size">
          ${[10, 25, 50].map((count) => optionHtml(count, `${count}`, count === state.sessionSize)).join("")}
        </select>
      </label>
      <label>
        <span>${t(state.locale, "language")}</span>
        <select data-control="locale">
          ${languages
            .map((language) => optionHtml(language.code, language.label, language.code === state.locale))
            .join("")}
        </select>
      </label>
      <button class="primary full-width" data-action="new-session">${t(state.locale, "newSession")}</button>
      <button class="secondary full-width" data-action="home">${t(state.locale, "backToHome")}</button>
    </section>
  `;
}

function renderStats(stats) {
  return `
    <section class="stats-grid" aria-label="${t(state.locale, "progress")}">
      <div><strong>${stats.answered}</strong><span>${t(state.locale, "answered")}</span></div>
      <div><strong>${stats.correct}</strong><span>${t(state.locale, "correct")}</span></div>
      <div><strong>${stats.scorePercent}%</strong><span>${t(state.locale, "accuracy")}</span></div>
    </section>
  `;
}

function renderQuestionNav() {
  return `
    <section>
      <h3>${t(state.locale, "questionNav")}</h3>
      <div class="question-nav">
        ${state.session.questions
          .map((question, index) => {
            const answer = state.answers[question.id] ?? [];
            const checked = Boolean(state.checked[question.id]);
            const result = checked ? evaluateQuestion(question, answer) : null;
            const statusClass = result?.isCorrect
              ? "correct"
              : checked
                ? "wrong"
                : answer.length
                  ? "selected"
                  : "";
            return `<button class="${index === state.currentIndex ? "active" : ""} ${statusClass}" data-jump="${index}">${question.number}</button>`;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderQuestionBody(question) {
  if (question.type !== "single") return "";
  const label =
    question.mode === STUDY_MODES.CHECK_ITEM
      ? t(state.locale, "checkItemLabel")
      : t(state.locale, "defectCaseLabel");
  const badge = question.badge
    ? `<span class="va-badge">${t(state.locale, "virtualAsset")}</span>`
    : "";
  return `
    <div class="question-body">
      <div class="question-body-top"><span>${label}</span>${badge}</div>
      <p>${escapeHtml(question.body)}</p>
    </div>
  `;
}

function renderOption(question, option, selectedIds, checked) {
  if (question.type === "single") return renderCriterionOption(option, selectedIds, checked);
  return renderJudgmentOption(option, selectedIds, checked);
}

function renderJudgmentOption(option, selectedIds, checked) {
  const selected = selectedIds.includes(option.id);
  const explanation = checked && !option.isCorrect ? explainIncorrectOption(option, state.bank) : null;
  const buttonClasses = [
    "option-button",
    selected ? "selected" : "",
    checked && option.isCorrect ? "is-correct" : "",
    checked && selected && !option.isCorrect ? "is-wrong" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const cardClasses = ["option-card", explanation ? "has-explanation" : ""].filter(Boolean).join(" ");

  return `
    <article class="${cardClasses}">
      <button class="${buttonClasses}" data-option="${escapeAttribute(option.id)}">
        <span class="option-label">${option.label}</span>
        <span class="option-text">${escapeHtml(option.statement)}</span>
      </button>
      ${explanation ? renderOptionExplanation(explanation) : ""}
    </article>
  `;
}

function renderCriterionOption(option, selectedIds, checked) {
  const selected = selectedIds.includes(option.id);
  const buttonClasses = [
    "option-button",
    "criterion-option",
    selected ? "selected" : "",
    checked && option.isCorrect ? "is-correct" : "",
    checked && selected && !option.isCorrect ? "is-wrong" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <article class="option-card">
      <button class="${buttonClasses}" data-option="${escapeAttribute(option.id)}">
        <span class="option-label">${option.label}</span>
        <span class="option-text"><strong>${escapeHtml(option.code)}</strong> ${escapeHtml(option.name)}</span>
      </button>
    </article>
  `;
}

function renderOptionExplanation(explanation) {
  return `
    <section class="option-explanation" aria-label="${escapeAttribute(t(state.locale, "inlineExplanationTitle"))}">
      <div class="explanation-topline">
        <strong>${t(state.locale, "inlineExplanationTitle")}</strong>
        <span>${escapeHtml(matchTypeLabel(explanation.matchType))}</span>
      </div>
      <p>${escapeHtml(explanation.summary)}</p>
      <ul>
        ${explanation.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderStatus(question, result) {
  if (!result) {
    return `<p class="status-line neutral">${t(state.locale, "reviewMode")}</p>`;
  }

  if (result.status === "incomplete" || result.status === "invalid-count") {
    const key = question.type === "single" ? "chooseExactlyOne" : "chooseExactlyTwo";
    return `<p class="status-line warning">${t(state.locale, key)}</p>`;
  }

  return `<p class="status-line ${result.isCorrect ? "success" : "danger"}">${
    result.isCorrect ? t(state.locale, "correct") : t(state.locale, "wrong")
  }</p>`;
}

function renderReview(question, checked, selectedIds) {
  if (!checked) {
    return `
      <section class="review-card">
        <h3>${t(state.locale, "explanation")}</h3>
        <p>${t(state.locale, "noAnswerYet")}</p>
      </section>
    `;
  }

  if (question.type === "single") {
    const explain =
      question.mode === STUDY_MODES.CHECK_ITEM ? explainCheckItemAnswer : explainDefectCriterionAnswer;
    const explanation = explain(question, selectedIds[0] ?? null, state.bank);
    return `
      <section class="review-card">
        <h3>${t(state.locale, "answerExplanation")}</h3>
        <p class="${explanation.isCorrect ? "explain-correct" : "explain-wrong"}">${escapeHtml(explanation.summary)}</p>
        <ul>
          ${explanation.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}
        </ul>
      </section>
    `;
  }

  return `
    <section class="review-card">
      <h3>${t(state.locale, "explanation")}</h3>
      <p>${t(state.locale, "inlineExplanationInfo")}</p>
    </section>
  `;
}

function renderWeakAreas(weakAreas) {
  return `
    <section class="review-card">
      <h3>${t(state.locale, "weakAreas")}</h3>
      ${
        weakAreas.length === 0
          ? `<p>${t(state.locale, "noWeakAreas")}</p>`
          : `<div class="weak-list">${weakAreas
              .slice(0, 5)
              .map(
                (item) => `
                  <div>
                    <strong>${escapeHtml(item.code)} ${escapeHtml(item.name)}</strong>
                    <span>${item.misses}</span>
                  </div>
                `,
              )
              .join("")}</div>`
      }
    </section>
  `;
}

function renderBankMeta() {
  const counts = state.bank.counts ?? {};
  return `
    <section class="meta-card">
      <h3>${t(state.locale, "dataLoaded")}</h3>
      <div><span>${t(state.locale, "criteriaCount")}</span><strong>${counts.criteria ?? 0}</strong></div>
      <div><span>${t(state.locale, "defectCasePool")}</span><strong>${counts.defectCasePool ?? counts.truePool ?? 0}</strong></div>
      <div><span>${t(state.locale, "checkItemPool")}</span><strong>${counts.checkItemPool ?? 0}</strong></div>
    </section>
  `;
}

function wireHomeEvents() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      platform.haptics.impact();
      startSession(button.dataset.mode, state.sessionSize);
    });
  });
  wireSharedControls();
}

function wireQuizEvents() {
  document.querySelector('[data-action="new-session"]')?.addEventListener("click", () => {
    startSession(state.mode, state.sessionSize);
  });
  document.querySelector('[data-action="home"]')?.addEventListener("click", () => {
    goHome();
  });
  document.querySelector('[data-action="check"]')?.addEventListener("click", () => {
    const question = currentQuestion();
    state.checked[question.id] = true;
    platform.haptics.impact();
    render();
  });
  document.querySelector('[data-action="next"]')?.addEventListener("click", () => {
    state.currentIndex = Math.min(state.currentIndex + 1, state.session.questions.length - 1);
    render();
  });
  document.querySelector('[data-action="previous"]')?.addEventListener("click", () => {
    state.currentIndex = Math.max(state.currentIndex - 1, 0);
    render();
  });
  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentIndex = Number(button.dataset.jump);
      render();
    });
  });
  document.querySelectorAll("[data-option]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleOption(button.dataset.option);
    });
  });
  wireSharedControls();
}

function wireSharedControls() {
  document.querySelector('[data-control="session-size"]')?.addEventListener("change", (event) => {
    state.sessionSize = Number(event.target.value);
    platform.storage.set("sessionSize", state.sessionSize);
    if (state.screen === "quiz") startSession(state.mode, state.sessionSize);
  });
  document.querySelector('[data-control="locale"]')?.addEventListener("change", (event) => {
    state.locale = event.target.value;
    platform.storage.set("locale", state.locale);
    document.documentElement.lang = state.locale;
    if (state.screen === "home") renderHome();
    else render();
  });
}

function toggleOption(optionId) {
  const question = currentQuestion();
  if (question.type === "single") {
    const current = state.answers[question.id]?.[0];
    state.answers[question.id] = current === optionId ? [] : [optionId];
  } else {
    const selected = new Set(state.answers[question.id] ?? []);
    if (selected.has(optionId)) {
      selected.delete(optionId);
    } else {
      selected.add(optionId);
    }
    state.answers[question.id] = [...selected];
  }
  state.checked[question.id] = false;
  render();
}

function evaluateQuestion(question, selectedIds) {
  if (question.type === "single") {
    return evaluateSingleAnswer(question, selectedIds[0] ?? null);
  }
  return evaluateAnswer(question, selectedIds);
}

function questionPrompt(question) {
  if (question.type === "single") {
    return question.mode === STUDY_MODES.CHECK_ITEM
      ? t(state.locale, "checkItemPrompt")
      : t(state.locale, "defectCriterionPrompt");
  }
  return question.prompt;
}

function currentQuestion() {
  return state.session.questions[state.currentIndex];
}

function optionHtml(value, label, selected) {
  return `<option value="${escapeAttribute(value)}" ${selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function matchTypeLabel(matchType) {
  if (matchType === "exact") return t(state.locale, "exactOriginal");
  if (matchType === "similar") return t(state.locale, "similarOriginal");
  return t(state.locale, "missingOriginal");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
