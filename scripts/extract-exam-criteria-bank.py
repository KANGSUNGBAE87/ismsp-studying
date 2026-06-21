from __future__ import annotations

import argparse
import json
import logging
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


CODE_RE = re.compile(r"\b(?:1|2|3)\.\d{1,2}\.\d{1,2}\b")
QUESTION_LINE_RE = re.compile(r"^(?:\d{1,2}/10\s*)?(\d{1,3})\.\s+(.*)$")
OPTION_LINE_RE = re.compile(r"^([1-5])[\).]\s+(.*)$")
ANSWER_MARK_RE = re.compile(r"(?:^|\n)\s*([1-5])[\).]\s+")
ANSWER_LIST_RE = re.compile(r"정답\s*[:：]\s*([1-5](?:\s*,\s*[1-5])*)")
URL_RE = re.compile(r"https?://\S+")

DEFAULT_GOOGLE_CLASSROOM_DIR = (
  "/Users/kangsungbae/Library/CloudStorage/MYBOX-venimaru/"
  "개인 폴더/각종자료/2025구글클래스룸문제"
)


def cell(value: Any) -> str:
  if value is None:
    return ""
  return re.sub(r"\s+", " ", str(value)).strip()


def normalize_name(path: Path) -> str:
  return unicodedata.normalize("NFC", path.name)


def normalize_text(value: Any) -> str:
  return re.sub(r"\s+", " ", unicodedata.normalize("NFC", str(value or ""))).strip()


def stable_text_id(value: str) -> str:
  import hashlib

  return hashlib.sha1(normalize_text(value).encode("utf-8")).hexdigest()[:12]


def load_bank(path: Path) -> dict[str, Any]:
  return json.loads(path.read_text(encoding="utf-8"))


def criteria_label(code: str, bank: dict[str, Any]) -> str:
  criteria = bank.get("criteria", {}).get(code) or {}
  name = criteria.get("name", "")
  return f"{code} {name}".strip()


def extract_codes(text: str) -> list[str]:
  seen: set[str] = set()
  result: list[str] = []
  for code in CODE_RE.findall(text or ""):
    if code in seen:
      continue
    seen.add(code)
    result.append(code)
  return result


def read_pdf_text(path: Path) -> tuple[str, int]:
  logging.getLogger("pdfminer").setLevel(logging.ERROR)
  import pdfplumber

  pages: list[str] = []
  with pdfplumber.open(path) as pdf:
    for page in pdf.pages:
      pages.append(page.extract_text() or "")
    return "\n".join(pages), len(pdf.pages)


def load_fixture_texts(path: Path) -> list[dict[str, Any]]:
  payload = json.loads(path.read_text(encoding="utf-8"))
  if not isinstance(payload, list):
    raise ValueError("--text-fixture must be a JSON array")
  return payload


def clean_text_for_parsing(text: str) -> str:
  text = unicodedata.normalize("NFC", text or "")
  text = URL_RE.sub("", text)
  cleaned: list[str] = []
  skip_prefixes = (
    "이 콘텐츠는 Google",
    "양식이 의심스러운가요",
    "양식 소유자에게 문의",
    "서비스 약관",
    "개인정보처리방침",
    "설문지",
    "이메일*",
    "이메일 *",
    "이메일 주소",
    "계정 전환",
    "* 표시는 필수 질문임",
  )
  for raw_line in text.splitlines():
    line = normalize_text(raw_line)
    if not line:
      continue
    if any(line.startswith(prefix) for prefix in skip_prefixes):
      continue
    if re.match(r"^\d{2}\.\s*\d{1,2}\.\s*\d{1,2}\.", line):
      continue
    if re.match(r"^\d+/\d+$", line):
      continue
    if re.match(r"^\d+\s+\d{2}\.$", line):
      continue
    if line.startswith("총점 "):
      continue
    if re.fullmatch(r"[\w.+-]+@[\w.-]+", line):
      continue
    cleaned.append(line)
  return "\n".join(cleaned)


def classify_question(stem: str, options: list[dict[str, Any]]) -> str:
  text = stem + " " + " ".join(option["text"] for option in options)
  if "심사원이 결함으로 판단" in text and "잘못된 것" in text:
    return "auditor_wrong_judgment"
  if "인증기준" in text and "고르" in text:
    return "criteria_selection_like"
  if "결함으로 판단" in text:
    return "defect_judgment"
  return "unknown"


def infer_answer_options(explanation: str) -> list[int]:
  text = normalize_text(explanation)
  if not text:
    return []

  list_match = ANSWER_LIST_RE.search(text)
  if list_match:
    return [int(value) for value in re.findall(r"[1-5]", list_match.group(1))]

  # Common answer PDFs write "4) 2.1.2 ..." or "해설 : 5) 결함이 아니다".
  head = text.replace("해설 :", "").replace("해설:", "").strip()
  marked = [int(match.group(1)) for match in ANSWER_MARK_RE.finditer(head)]
  result: list[int] = []
  for value in marked:
    if value not in result:
      result.append(value)
  return result


def parse_claimed_criteria(option_text: str, bank: dict[str, Any]) -> dict[str, str]:
  codes = extract_codes(option_text)
  if not codes:
    return {"code": "", "name": ""}

  code = codes[-1]
  name = (bank.get("criteria", {}).get(code) or {}).get("name", "")
  # Prefer the official name, but keep a lightweight fallback if source has one.
  if not name:
    match = re.search(rf"{re.escape(code)}\s+([^\s]+(?:\s+[^\s]+){{0,3}}?)\s+결함", option_text)
    name = cell(match.group(1)) if match else ""
  return {"code": code, "name": name}


def scenario_from_option(option_text: str, claimed_code: str) -> str:
  if not claimed_code:
    return normalize_text(option_text)
  pattern = re.compile(rf"\s*{re.escape(claimed_code)}\s+.*?결함(?:으로)?\s*(?:판단\s*)?(?:하였다|하였음|했다)?\.?$")
  scenario = pattern.sub("", normalize_text(option_text))
  return scenario.strip(" .")


def _strip_score_marker(line: str) -> str:
  line = re.sub(r"\s+\d{1,2}/10$", "", line)
  line = re.sub(r"\s+10점$", "", line)
  return line.strip()


def finalize_question(
  draft: dict[str, Any] | None, source_id: str, bank: dict[str, Any]
) -> dict[str, Any] | None:
  if not draft:
    return None

  options: list[dict[str, Any]] = []
  for index, option_lines in draft.get("options", []):
    option_text = normalize_text(" ".join(option_lines))
    claimed = parse_claimed_criteria(option_text, bank)
    options.append(
      {
        "index": index,
        "text": option_text,
        "criteriaCodes": extract_codes(option_text),
        "claimedCriteriaCode": claimed["code"],
        "claimedCriteriaName": claimed["name"],
      }
    )
  if not options:
    return None

  stem = normalize_text(" ".join(draft.get("stemLines", [])))
  explanation = normalize_text("\n".join(draft.get("explanationLines", [])))
  explanation = re.sub(r"^해설\s*[:：]\s*", "", explanation).strip()
  answer_options = infer_answer_options(explanation)
  codes = []
  for code in [*extract_codes(stem), *extract_codes(explanation)]:
    if code not in codes:
      codes.append(code)
  for option in options:
    for code in option["criteriaCodes"]:
      if code not in codes:
        codes.append(code)

  question_id = f"{source_id}:q{draft['questionNo']}"
  question_type = classify_question(stem, options)
  return {
    "id": question_id,
    "questionNo": draft["questionNo"],
    "questionType": question_type,
    "stem": stem,
    "options": options,
    "answerOptions": answer_options,
    "answerOption": answer_options[0] if len(answer_options) == 1 else None,
    "answerStatus": "inferred" if answer_options else "unknown",
    "explanation": explanation,
    "explanationCriteriaCodes": extract_codes(explanation),
    "criteriaCodes": codes,
    "isCriteriaRelated": bool(codes) or "인증기준" in stem,
  }


def parse_questions_from_text(text: str, source_id: str, bank: dict[str, Any]) -> list[dict[str, Any]]:
  questions: list[dict[str, Any]] = []
  draft: dict[str, Any] | None = None
  current_option: tuple[int, list[str]] | None = None
  in_explanation = False

  for raw_line in clean_text_for_parsing(text).splitlines():
    line = _strip_score_marker(normalize_text(raw_line))
    if not line:
      continue

    question_match = QUESTION_LINE_RE.match(line)
    if question_match and (draft is None or in_explanation):
      parsed = finalize_question(draft, source_id, bank)
      if parsed:
        questions.append(parsed)
      draft = {
        "questionNo": int(question_match.group(1)),
        "stemLines": [_strip_score_marker(question_match.group(2))],
        "options": [],
        "explanationLines": [],
      }
      current_option = None
      in_explanation = False
      continue

    if draft is None:
      continue

    if line.startswith("의견 보내기"):
      if current_option:
        draft["options"].append(current_option)
      current_option = None
      in_explanation = True
      remainder = line.replace("의견 보내기", "", 1).strip()
      if remainder:
        draft["explanationLines"].append(remainder)
      continue

    if in_explanation:
      draft["explanationLines"].append(line)
      continue

    option_match = OPTION_LINE_RE.match(line)
    if option_match:
      if current_option:
        draft["options"].append(current_option)
      current_option = (int(option_match.group(1)), [option_match.group(2)])
      continue

    if current_option:
      current_option[1].append(line)
    else:
      draft["stemLines"].append(line)

  if current_option and draft:
    draft["options"].append(current_option)
  parsed = finalize_question(draft, source_id, bank)
  if parsed:
    questions.append(parsed)
  return questions


def build_criteria_selection_items(
  questions: list[dict[str, Any]], bank: dict[str, Any]
) -> list[dict[str, Any]]:
  items: list[dict[str, Any]] = []
  for question in questions:
    if question["questionType"] != "auditor_wrong_judgment":
      continue

    answer_options = set(question.get("answerOptions") or [])
    for option in question["options"]:
      code = option.get("claimedCriteriaCode")
      if not code:
        continue

      if answer_options:
        if option["index"] in answer_options:
          label_status = "source_marks_as_wrong_judgment"
          usable = False
        else:
          label_status = "source_non_answer_option"
          usable = True
      else:
        label_status = "needs_review"
        usable = False

      scenario = scenario_from_option(option["text"], code)
      items.append(
        {
          "id": f"criteria-src:{stable_text_id(question['id'] + ':' + str(option['index']))}",
          "sourceQuestionId": question["id"],
          "sourceOptionIndex": option["index"],
          "scenario": scenario,
          "claimedCriteriaCode": code,
          "claimedCriteriaName": option.get("claimedCriteriaName") or criteria_label(code, bank).replace(code, "").strip(),
          "claimedCriteriaLabel": criteria_label(code, bank),
          "sourceLabelStatus": label_status,
          "usableForTraining": usable,
          "reviewStatus": "draft" if usable else "needs_review",
        }
      )
  return items


def source_id_from_path(path: Path) -> str:
  name = normalize_name(path)
  stem = Path(name).stem
  return re.sub(r"[^0-9A-Za-z가-힣_-]+", "-", stem).strip("-")


def iter_answer_pdfs(source_dir: Path) -> list[Path]:
  pdfs = []
  for path in source_dir.iterdir():
    if not path.is_file() or path.suffix.lower() != ".pdf":
      continue
    name = normalize_name(path)
    if "답" in name:
      pdfs.append(path)
  return sorted(pdfs, key=lambda item: normalize_name(item))


def build_from_pdf_dir(source_dir: Path, bank: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
  sources: list[dict[str, Any]] = []
  questions: list[dict[str, Any]] = []
  for path in iter_answer_pdfs(source_dir):
    text, pages = read_pdf_text(path)
    source_id = source_id_from_path(path)
    parsed = parse_questions_from_text(text, source_id, bank)
    sources.append(
      {
        "id": source_id,
        "file": str(path),
        "fileName": normalize_name(path),
        "pages": pages,
        "questions": len(parsed),
        "textChars": len(text),
      }
    )
    for question in parsed:
      question["sourceFile"] = str(path)
      question["sourceFileName"] = normalize_name(path)
      questions.append(question)
  return sources, questions


def build_from_fixture(path: Path, bank: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
  sources: list[dict[str, Any]] = []
  questions: list[dict[str, Any]] = []
  for item in load_fixture_texts(path):
    source_file = item.get("sourceFile", "fixture.pdf")
    source_id = source_id_from_path(Path(source_file))
    text = item.get("text", "")
    parsed = parse_questions_from_text(text, source_id, bank)
    sources.append(
      {
        "id": source_id,
        "file": source_file,
        "fileName": source_file,
        "pages": item.get("pages", 0),
        "questions": len(parsed),
        "textChars": len(text),
      }
    )
    for question in parsed:
      question["sourceFile"] = source_file
      question["sourceFileName"] = source_file
      questions.append(question)
  return sources, questions


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("--source-dir", default=DEFAULT_GOOGLE_CLASSROOM_DIR)
  parser.add_argument("--bank", default="public/data/ismsp-defect-bank.json")
  parser.add_argument("--output", default="ai/analysis/google-classroom-criteria-question-bank.json")
  parser.add_argument("--text-fixture", default="")
  args = parser.parse_args()

  bank = load_bank(Path(args.bank))
  if args.text_fixture:
    sources, questions = build_from_fixture(Path(args.text_fixture), bank)
  else:
    sources, questions = build_from_pdf_dir(Path(args.source_dir), bank)

  criteria_selection_items = build_criteria_selection_items(questions, bank)
  known_answer_count = sum(1 for question in questions if question.get("answerOption"))
  usable_selection_count = sum(1 for item in criteria_selection_items if item["usableForTraining"])
  criteria_related_count = sum(1 for question in questions if question.get("isCriteriaRelated"))

  payload = {
    "version": "0.1.0",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "sourceKind": "google_classroom_answer_pdfs",
    "sources": sources,
    "counts": {
      "sources": len(sources),
      "questions": len(questions),
      "criteriaRelatedQuestions": criteria_related_count,
      "questionsWithInferredAnswer": known_answer_count,
      "criteriaSelectionItems": len(criteria_selection_items),
      "usableCriteriaSelectionItems": usable_selection_count,
      "needsReviewCriteriaSelectionItems": len(criteria_selection_items) - usable_selection_count,
    },
    "questions": questions,
    "criteriaSelectionItems": criteria_selection_items,
  }

  output = Path(args.output)
  output.parent.mkdir(parents=True, exist_ok=True)
  output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
  print(json.dumps({"output": str(output), **payload["counts"]}, ensure_ascii=False))


if __name__ == "__main__":
  main()
