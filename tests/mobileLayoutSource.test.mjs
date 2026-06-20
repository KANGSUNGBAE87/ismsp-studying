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

test("mobile layout puts the workbook intro first and hides the duplicate side question nav", () => {
  assert.ok(appJsContent.includes("renderMobileQuestionNav"));
  assert.ok(appJsContent.includes('class="mobile-question-nav"'));
  assert.ok(appJsContent.includes('class="question-nav-section"'));
  assert.ok(appJsContent.includes('class="quiz-intro-panel"'));

  const mobileSection = stylesContent.split("@media (max-width: 780px)")[1]?.split("@media")[0];
  assert.ok(mobileSection, "missing 780px media query block");
  assert.ok(mobileSection.includes(".quiz-intro-panel"));
  assert.ok(mobileSection.includes("order: 1"));
  assert.ok(mobileSection.includes(".quiz-panel"));
  assert.ok(mobileSection.includes("order: 2"));
  assert.ok(mobileSection.includes(".side-panel"));
  assert.ok(mobileSection.includes("order: 3"));
  assert.ok(mobileSection.includes(".question-nav-section"));
  assert.ok(mobileSection.includes("display: none"));
  assert.ok(mobileSection.includes(".mobile-question-nav"));
  assert.ok(mobileSection.includes("display: block"));
});

test("mobile question navigation uses a fixed grid instead of horizontal scrolling", () => {
  const mobileSection = stylesContent.split("@media (max-width: 780px)")[1]?.split("@media")[0];
  assert.ok(mobileSection.includes("grid-template-columns: repeat(5, minmax(0, 1fr))"));
  assert.equal(mobileSection.includes("overflow-x: auto"), false);
  assert.equal(mobileSection.includes("overscroll-behavior-x"), false);
});

test("answer explanations collapse long detail evidence behind a details disclosure", () => {
  assert.ok(appJsContent.includes('class="option-explanation-details"'));
  assert.ok(appJsContent.includes("<details"));
  assert.ok(appJsContent.includes("<summary>"));
  assert.ok(i18nContent.includes("detailEvidence"));
});

test("judgment feedback is shown inside option cards without the old right-side helper cards", () => {
  assert.ok(appJsContent.includes("renderOptionResultBadges"));
  assert.ok(appJsContent.includes("choice-badge selected"));
  assert.ok(appJsContent.includes("choice-badge answer"));
  assert.ok(i18nContent.includes("내 선택"));
  assert.ok(i18nContent.includes("오답 판단 해설"));
  assert.equal(appJsContent.includes("renderWeakAreas"), false);
  assert.equal(appJsContent.includes("${renderBankMeta()}\\n      </aside>"), false);
  assert.equal(i18nContent.includes("오답 후보 해설"), false);
});

test("mobile touch targets meet the 44px minimum", () => {
  assert.ok(stylesContent.includes("min-height: 44px"));
  assert.ok(stylesContent.includes("min-height: 46px"));
});
