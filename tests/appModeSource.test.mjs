import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const appJsContent = fs.readFileSync(path.resolve("public/app.js"), "utf-8");
const i18nContent = fs.readFileSync(path.resolve("src/i18n.js"), "utf-8");
const adaptersContent = fs.readFileSync(path.resolve("src/platform/adapters.js"), "utf-8");

test("home exposes binary defect judgment modes and hides the legacy five-option judgment mode", () => {
  assert.ok(appJsContent.includes("STUDY_MODES.DEFECT_JUDGMENT_INCORRECT"));
  assert.ok(appJsContent.includes("STUDY_MODES.DEFECT_JUDGMENT_CORRECT"));
  assert.equal(appJsContent.includes("mode: STUDY_MODES.DEFECT_JUDGMENT,"), false);
  assert.equal(i18nContent.includes("결함사항 판단문 공부"), false);
  assert.equal(i18nContent.includes("5개 판단문 중 틀린 2개"), false);
});

test("browser state defaults stale session sizes back to ten questions", () => {
  assert.ok(appJsContent.includes("DEFAULT_SESSION_COUNT"));
  assert.ok(appJsContent.includes("normalizeSessionSize"));
  assert.ok(appJsContent.includes('platform.storage.get("sessionSize", DEFAULT_SESSION_COUNT)'));
  assert.ok(appJsContent.includes("SESSION_SIZE_OPTIONS = [DEFAULT_SESSION_COUNT]"));
  assert.ok(i18nContent.includes("결함판단 틀린거 1개 찾기"));
  assert.ok(i18nContent.includes("결함판단 올바른거 1개 찾기"));
});

test("status renderer does not contain duplicate unreachable return text", () => {
  const statusStart = appJsContent.indexOf("function renderStatus");
  const statusEnd = appJsContent.indexOf("function renderReview");
  const statusBody = appJsContent.slice(statusStart, statusEnd);
  const returnCount = (statusBody.match(/return `<p class=\"status-line/g) ?? []).length;
  assert.equal(returnCount, 3);
});

test("binary judgment questions render their own judgment prompt instead of criterion-match prompt", () => {
  const promptStart = appJsContent.indexOf("function questionPrompt");
  const promptEnd = appJsContent.indexOf("function currentQuestion");
  const promptBody = appJsContent.slice(promptStart, promptEnd);
  assert.ok(promptBody.includes('question.presentation === "judgment"'));
  assert.ok(promptBody.includes("return question.prompt"));
});

test("app loads the prebuilt criteria similarity graph with the question bank", () => {
  assert.ok(appJsContent.includes("./data/criteria-similarity.json"));
  assert.ok(appJsContent.includes("criteriaSimilarityResponse"));
  assert.ok(appJsContent.includes("criteriaSimilarity: await criteriaSimilarityResponse.json()"));
});

test("app is Korean-only without English locale controls", () => {
  assert.equal(i18nContent.includes("English"), false);
  assert.equal(i18nContent.includes("en:"), false);
  assert.equal(appJsContent.includes("languages"), false);
  assert.equal(appJsContent.includes('data-control="locale"'), false);
  assert.equal(appJsContent.includes('platform.storage.get("locale"'), false);
  assert.equal(appJsContent.includes('platform.storage.set("locale"'), false);
  assert.equal(adaptersContent.includes('startsWith("en")'), false);
  assert.ok(adaptersContent.includes('return "ko";'));
});
