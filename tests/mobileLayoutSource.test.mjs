import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const stylesContent = fs.readFileSync(path.resolve("public/styles.css"), "utf-8");
const appJsContent = fs.readFileSync(path.resolve("public/app.js"), "utf-8");
const i18nContent = fs.readFileSync(path.resolve("src/i18n.js"), "utf-8");

test("quiz keeps action buttons in a sticky footer without premium or analytics slots", () => {
  assert.ok(appJsContent.includes("quiz-footer-slot"));
  assert.ok(appJsContent.includes("renderQuizFooter"));
  assert.ok(stylesContent.includes(".quiz-footer-slot"));
  assert.ok(stylesContent.includes("position: sticky"));
  assert.ok(stylesContent.includes("bottom: 0"));

  assert.equal(appJsContent.includes("renderPremiumCta"), false);
  assert.equal(appJsContent.includes("createAnalytics"), false);
  assert.equal(appJsContent.includes("observeScrollToBottom"), false);
  assert.equal(stylesContent.includes("premium-cta"), false);
  assert.equal(i18nContent.includes("premiumCta"), false);
});

test("mobile layout shows quiz first and hides the duplicate side question nav", () => {
  assert.ok(appJsContent.includes("renderMobileQuestionNav"));
  assert.ok(appJsContent.includes('class="mobile-question-nav"'));
  assert.ok(appJsContent.includes('class="question-nav-section"'));

  const mobileSection = stylesContent.split("@media (max-width: 780px)")[1]?.split("@media")[0];
  assert.ok(mobileSection, "missing 780px media query block");
  assert.ok(mobileSection.includes(".quiz-panel"));
  assert.ok(mobileSection.includes("order: 1"));
  assert.ok(mobileSection.includes(".side-panel"));
  assert.ok(mobileSection.includes("order: 2"));
  assert.ok(mobileSection.includes(".review-panel"));
  assert.ok(mobileSection.includes("order: 3"));
  assert.ok(mobileSection.includes(".question-nav-section"));
  assert.ok(mobileSection.includes("display: none"));
  assert.ok(mobileSection.includes(".mobile-question-nav"));
  assert.ok(mobileSection.includes("display: block"));
});

test("answer explanations collapse long detail evidence behind a details disclosure", () => {
  assert.ok(appJsContent.includes('class="option-explanation-details"'));
  assert.ok(appJsContent.includes("<details"));
  assert.ok(appJsContent.includes("<summary>"));
  assert.ok(i18nContent.includes("detailEvidence"));
});

test("mobile touch targets meet the 44px minimum", () => {
  assert.ok(stylesContent.includes("min-height: 44px"));
  assert.ok(stylesContent.includes("min-height: 46px"));
});
