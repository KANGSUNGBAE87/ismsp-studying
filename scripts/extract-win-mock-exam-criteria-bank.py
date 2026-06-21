from __future__ import annotations

import argparse
import json
import re
import subprocess
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_WIN_MOCK_DIR = "/Users/kangsungbae/Downloads/win모의고사"
DEFAULT_OUTPUT = "ai/analysis/win-mockexam-criteria-question-bank.json"
DEFAULT_OCR_OUTPUT = "ai/analysis/win-mockexam-ocr-pages.jsonl"
DEFAULT_PAGE_INDEX_OUTPUT = "ai/analysis/win-mockexam-page-index.json"
DEFAULT_BANK = "public/data/ismsp-defect-bank.json"
DEFAULT_RENDER_DIR = "tmp/win-mock-exam-ocr"
PDFINFO = "/Users/kangsungbae/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pdfinfo"
PDFTOPPM = "/Users/kangsungbae/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pdftoppm"
VISION_OCR = Path(__file__).with_name("vision-ocr.swift")

CODE_RE = re.compile(r"\b(?:1|2|3)\.\d{1,2}\.\d{1,2}\b")
QUESTION_START_RE = re.compile(r"^(\d{1,3})\.\s+(.*)$")
ANSWER_START_RE = re.compile(r"(?m)^\s*(\d{1,3})번\s*정답\s*$")
EXPLANATION_MARK_RE = re.compile(r"(?m)^\s*[\[\{\(]?\s*해설\s*[\]\}\)]?\s*$")
COPYRIGHT_SUFFIX_RE = re.compile(r"\s*저작재산권을 침해한 경우에는.*$")
CIRCLED_TO_INDEX = {"①": 1, "②": 2, "③": 3, "④": 4, "⑤": 5}
INDEX_TO_CIRCLED = {value: key for key, value in CIRCLED_TO_INDEX.items()}
OPTION_RE = re.compile(r"^([①②③④⑤])\s*(.*)$")
URL_RE = re.compile(r"https?://\S+")
AUDITOR_JUDGMENT_TERMS = ("심사원", "결함", "인증기준", "적절하지 않은", "판단")


def normalize_text(value: Any) -> str:
  return re.sub(r"[ \t]+", " ", unicodedata.normalize("NFC", str(value or ""))).strip()


def normalize_block(value: Any) -> str:
  text = unicodedata.normalize("NFC", str(value or ""))
  text = text.replace("\r\n", "\n").replace("\r", "\n")
  lines = [normalize_text(line) for line in text.splitlines()]
  return "\n".join(line for line in lines if line)


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


def source_id_from_path(path: Path) -> str:
  name = unicodedata.normalize("NFC", path.name)
  stem = Path(name).stem
  return re.sub(r"[^0-9A-Za-z가-힣_-]+", "-", stem).strip("-")


def clean_ocr_text(text: str) -> str:
  text = normalize_block(URL_RE.sub("", text or ""))
  text = re.sub(
    r"저작재산권을\s*침해한\s*경우에는\s*5년 이하의 징역 또는(?:\s*5,000만원 이하의 벌금에 처할)?\s*수 있습니다\.?",
    "",
    text,
  )
  cleaned: list[str] = []
  skip_exact = {
    "저작재산권을 침해한 경우에는 5년 이하의 징역 또는",
    "저작재산권을 침해한 경우에는 5년 이하의 징역 또는 5,000만원 이하의 벌금에 처할 수 있습니다.",
    "저작재산권을 침해한",
    "저작재산권을",
    "침해한",
    "경우에는 5년 이하의 징역 또는",
    "5,000만원 이하의 벌금에 처할 수 있습니다",
    "5,000만원 이하의 벌금에 처할 수 있습니다.",
  }
  for line in text.splitlines():
    line = COPYRIGHT_SUFFIX_RE.sub("", line).strip()
    if not line:
      continue
    if line in skip_exact:
      continue
    if re.fullmatch(r"\d{1,3}", line):
      continue
    if line.startswith("5,000만원 이하의 벌금"):
      continue
    cleaned.append(line)
  return "\n".join(cleaned)


def raw_question_numbers(text: str) -> list[int]:
  result: list[int] = []
  for line in text.splitlines():
    match = QUESTION_START_RE.match(line)
    if match:
      result.append(int(match.group(1)))
  return result


def has_option_markers(text: str) -> bool:
  markers = {
    match.group(1)
    for match in re.finditer(r"(?m)^([①②③④⑤])\s+", text)
  }
  return len(markers) >= 2


def has_question_prompt(text: str) -> bool:
  prompts = ("고르시오", "적절", "옳은", "옳지", "몇 개")
  return any(prompt in text for prompt in prompts)


def question_numbers(text: str) -> list[int]:
  if not has_option_markers(text) and not has_question_prompt(text):
    return []
  return raw_question_numbers(text)


def answer_numbers(text: str) -> list[int]:
  return [int(value) for value in ANSWER_START_RE.findall(text)]


def analyze_page_text(text: str) -> dict[str, Any]:
  cleaned = clean_ocr_text(text)
  raw_q_numbers = raw_question_numbers(cleaned)
  q_numbers = question_numbers(cleaned)
  a_numbers = answer_numbers(cleaned)
  codes = extract_codes(cleaned)
  has_auditor_terms = any(term in cleaned for term in AUDITOR_JUDGMENT_TERMS)
  text_chars = len(cleaned)

  if text_chars < 20:
    kind = "blank_or_low_text"
    confidence = 0.2
  elif "응시자 필독 사항" in cleaned or "표지를 넘기지 마시오" in cleaned:
    kind = "cover_or_notice"
    confidence = 0.9
  elif a_numbers:
    kind = "answer_explanation"
    confidence = 0.95
  elif q_numbers:
    kind = "question"
    confidence = 0.9 if "①" in cleaned or "②" in cleaned else 0.75
  elif (
    "주요 기술" in cleaned
    or "정의 및 특징" in cleaned
    or "출처:" in cleaned
    or "참고" in cleaned
    or "제16조" in cleaned
    or (raw_q_numbers and not has_option_markers(cleaned) and not has_question_prompt(cleaned))
  ):
    kind = "reference_material"
    confidence = 0.75
  else:
    kind = "other"
    confidence = 0.5

  return {
    "pageKind": kind,
    "questionNumbers": q_numbers,
    "answerNumbers": a_numbers,
    "criteriaCodes": codes,
    "hasCriteriaCode": bool(codes),
    "hasAuditorJudgmentTerms": has_auditor_terms,
    "textChars": text_chars,
    "confidence": confidence,
  }


def page_kind(text: str) -> str:
  return analyze_page_text(text)["pageKind"]


def classify_question(stem: str, options: list[dict[str, Any]]) -> str:
  text = stem + " " + " ".join(option["text"] for option in options)
  if "적절하지 않은 것은 몇 개" in text or ("결함" in text and "몇 개" in text):
    return "auditor_wrong_count"
  if "인증기준" in text and "고르" in text:
    return "criteria_selection_like"
  if "결함" in text:
    return "defect_judgment"
  return "unknown"


def parse_options(lines: list[str]) -> tuple[str, list[dict[str, Any]]]:
  stem_lines: list[str] = []
  options: list[dict[str, Any]] = []
  current: dict[str, Any] | None = None

  for line in lines:
    match = OPTION_RE.match(line)
    if match:
      if current:
        options.append(current)
      marker = match.group(1)
      current = {
        "index": CIRCLED_TO_INDEX[marker],
        "marker": marker,
        "textLines": [match.group(2).strip()] if match.group(2).strip() else [],
      }
      continue
    if current:
      current["textLines"].append(line)
    else:
      stem_lines.append(line)

  if current:
    options.append(current)

  normalized_options = []
  stem_suffixes: list[str] = []
  for option in options:
    text = normalize_text(" ".join(option.pop("textLines")))
    count_match = re.match(r"^(\d+개)\s+(.+)$", text)
    if count_match and option["index"] == 1:
      text = count_match.group(1)
      stem_suffixes.append(count_match.group(2))
    normalized_options.append(
      {
        "index": option["index"],
        "marker": option["marker"],
        "text": text,
        "criteriaCodes": extract_codes(text),
      }
    )
  stem = normalize_text(" ".join([*stem_lines, *stem_suffixes]))
  return stem, normalized_options


def parse_question_blocks(page_texts: list[dict[str, Any]], source_id: str, bank: dict[str, Any]) -> list[dict[str, Any]]:
  pages = []
  for page in page_texts:
    text = clean_ocr_text(page.get("text", ""))
    if page_kind(text) != "question":
      continue
    pages.append({"page": int(page.get("page", 0) or 0), "text": text})

  combined_lines: list[tuple[int, str]] = []
  for page in pages:
    for line in page["text"].splitlines():
      combined_lines.append((page["page"], line))

  questions: list[dict[str, Any]] = []
  current: dict[str, Any] | None = None
  set_index = 1
  last_question_no: int | None = None

  def starts_new_question(question_no: int, page_no: int) -> bool:
    nonlocal set_index, last_question_no
    if last_question_no is None:
      last_question_no = question_no
      return True
    if question_no == 1 and last_question_no == 1 and current and page_no > current["startPage"]:
      set_index += 1
      last_question_no = question_no
      return True
    if question_no == 1 and last_question_no >= 20:
      set_index += 1
      last_question_no = question_no
      return True
    if question_no > last_question_no and question_no - last_question_no <= 5:
      last_question_no = question_no
      return True
    return False

  for page_no, line in combined_lines:
    match = QUESTION_START_RE.match(line)
    if match and starts_new_question(int(match.group(1)), page_no):
      if current:
        questions.append(finalize_question(current, source_id, bank))
      current = {
        "questionNo": int(match.group(1)),
        "setIndex": set_index,
        "startPage": page_no,
        "lines": [match.group(2)],
      }
      continue
    if current:
      current["lines"].append(line)

  if current:
    questions.append(finalize_question(current, source_id, bank))
  return questions


def finalize_question(draft: dict[str, Any], source_id: str, bank: dict[str, Any]) -> dict[str, Any]:
  stem, options = parse_options(draft["lines"])
  codes: list[str] = []
  for code in extract_codes(stem):
    if code not in codes:
      codes.append(code)
  for option in options:
    for code in option["criteriaCodes"]:
      if code not in codes:
        codes.append(code)
  return {
    "id": f"{source_id}:s{draft['setIndex']}:p{draft['startPage']}:q{draft['questionNo']}",
    "setIndex": draft["setIndex"],
    "questionNo": draft["questionNo"],
    "questionType": classify_question(stem, options),
    "pageNumber": draft["startPage"],
    "stem": stem,
    "options": options,
    "criteriaCodes": codes,
    "criteriaLabels": [criteria_label(code, bank) for code in codes],
    "isCriteriaRelated": bool(codes) or "인증기준" in stem,
  }


def extract_answer_markers(text: str) -> list[str]:
  markers: list[str] = []
  for marker in CIRCLED_TO_INDEX:
    if marker in text and marker not in markers:
      markers.append(marker)
  for value in re.findall(r"\b[1-5]\b", text):
    marker = INDEX_TO_CIRCLED[int(value)]
    if marker not in markers:
      markers.append(marker)
  return markers


def parse_answers(page_texts: list[dict[str, Any]], source_id: str) -> list[dict[str, Any]]:
  answers: list[dict[str, Any]] = []
  set_index = 1
  last_answer_no: int | None = None
  for page in page_texts:
    page_no = int(page.get("page", 0) or 0)
    text = clean_ocr_text(page.get("text", ""))
    matches = list(ANSWER_START_RE.finditer(text))
    for index, match in enumerate(matches):
      question_no = int(match.group(1))
      if last_answer_no is not None and question_no <= last_answer_no:
        set_index += 1
      last_answer_no = question_no
      start = match.end()
      end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
      block = text[start:end].strip()
      explanation_match = EXPLANATION_MARK_RE.search(block)
      if explanation_match:
        answer_part = block[: explanation_match.start()]
        explanation = block[explanation_match.end() :]
      else:
        answer_part = block
        explanation = block
      markers = extract_answer_markers(answer_part)
      answers.append(
        {
          "id": f"{source_id}:s{set_index}:p{page_no}:a{question_no}",
          "setIndex": set_index,
          "questionNo": question_no,
          "pageNumber": page_no,
          "answerMarkers": markers,
          "answerOptions": [CIRCLED_TO_INDEX[marker] for marker in markers],
          "explanation": normalize_text(explanation or block),
          "explanationCriteriaCodes": extract_codes(explanation or block),
        }
      )
  return answers


def attach_answers(questions: list[dict[str, Any]], answers: list[dict[str, Any]], bank: dict[str, Any]) -> None:
  answer_by_key = {(answer["setIndex"], answer["questionNo"]): answer for answer in answers}
  for question in questions:
    answer = answer_by_key.get((question["setIndex"], question["questionNo"]))
    if not answer:
      question["answerStatus"] = "question_only"
      continue
    if not question.get("options"):
      question["answerStatus"] = "needs_review"
    else:
      question["answerStatus"] = "matched" if answer["answerOptions"] else "explanation_only"
    question["answerMarkers"] = answer["answerMarkers"]
    question["answerOptions"] = answer["answerOptions"]
    question["answerPageNumber"] = answer["pageNumber"]
    question["explanation"] = answer["explanation"]
    question["explanationCriteriaCodes"] = answer["explanationCriteriaCodes"]
    for code in answer["explanationCriteriaCodes"]:
      if code not in question["criteriaCodes"]:
        question["criteriaCodes"].append(code)
        question["criteriaLabels"].append(criteria_label(code, bank))


def load_fixture_sources(path: Path) -> list[dict[str, Any]]:
  payload = json.loads(path.read_text(encoding="utf-8"))
  if not isinstance(payload, list):
    raise ValueError("--text-fixture must be a JSON array")
  return payload


def parse_page_ranges(value: str) -> list[tuple[int, int]]:
  ranges: list[tuple[int, int]] = []
  for part in value.split(","):
    part = part.strip()
    if not part:
      continue
    if "-" in part:
      start, end = part.split("-", 1)
      ranges.append((int(start), int(end)))
    else:
      page = int(part)
      ranges.append((page, page))
  return ranges


def page_count(pdf_path: Path) -> int:
  completed = subprocess.run([PDFINFO, str(pdf_path)], text=True, capture_output=True, check=True)
  match = re.search(r"^Pages:\s+(\d+)", completed.stdout, re.M)
  if not match:
    raise ValueError(f"Could not determine page count for {pdf_path.name}")
  return int(match.group(1))


def chunk_range(start: int, end: int, batch_size: int) -> list[tuple[int, int]]:
  chunks = []
  current = start
  while current <= end:
    chunk_end = min(end, current + batch_size - 1)
    chunks.append((current, chunk_end))
    current = chunk_end + 1
  return chunks


def render_pdf_pages(pdf_path: Path, ranges: list[tuple[int, int]], output_dir: Path, dpi: int) -> list[Path]:
  output_dir.mkdir(parents=True, exist_ok=True)
  images: list[Path] = []
  for start, end in ranges:
    prefix = output_dir / "page"
    for page_no in range(start, end + 1):
      stale_image = output_dir / f"page-{page_no:03d}.png"
      if stale_image.exists():
        stale_image.unlink()
    subprocess.run(
      [PDFTOPPM, "-png", "-f", str(start), "-l", str(end), "-r", str(dpi), str(pdf_path), str(prefix)],
      check=True,
    )
    for page_no in range(start, end + 1):
      image = output_dir / f"page-{page_no:03d}.png"
      if image.exists():
        images.append(image)
  return images


def ocr_images(images: list[Path]) -> list[dict[str, Any]]:
  if not images:
    return []
  completed = subprocess.run(
    ["swift", str(VISION_OCR), *[str(image) for image in images]],
    text=True,
    capture_output=True,
    check=True,
  )
  payload = json.loads(completed.stdout)
  page_texts: list[dict[str, Any]] = []
  for item in payload:
    file_name = Path(item["file"]).name
    page_match = re.search(r"-(\d{3})\.png$", file_name)
    page_texts.append(
      {
        "page": int(page_match.group(1)) if page_match else 0,
        "imageFile": item["file"],
        "text": item.get("text", ""),
        "ocrError": item.get("error"),
      }
    )
  return sorted(page_texts, key=lambda item: item["page"])


def ocr_row(
  pdf_path: Path,
  page_number: int,
  text: str,
  ocr_error: str | None,
  dpi: int,
  generated_at: str,
) -> dict[str, Any]:
  file_name = unicodedata.normalize("NFC", pdf_path.name)
  return {
    "sourceId": source_id_from_path(pdf_path),
    "fileName": file_name,
    "pageNumber": page_number,
    "text": text or "",
    "textChars": len(clean_ocr_text(text or "")),
    "ocrError": ocr_error,
    "renderDpi": dpi,
    "generatedAt": generated_at,
  }


def ocr_pdf_to_rows(
  pdf_path: Path,
  ranges: list[tuple[int, int]],
  render_dir: Path,
  dpi: int,
  batch_size: int,
  allow_ocr_errors: bool,
  keep_rendered_images: bool,
) -> list[dict[str, Any]]:
  source_id = source_id_from_path(pdf_path)
  image_dir = render_dir / source_id
  generated_at = datetime.now(timezone.utc).isoformat()
  rows: list[dict[str, Any]] = []

  for range_start, range_end in ranges:
    for start, end in chunk_range(range_start, range_end, batch_size):
      images = render_pdf_pages(pdf_path, [(start, end)], image_dir, dpi)
      ocr_results = {item["page"]: item for item in ocr_images(images)}

      for page_no in range(start, end + 1):
        item = ocr_results.get(page_no)
        text = item.get("text", "") if item else ""
        error = item.get("ocrError") if item else "missing_ocr_result"
        if error and not allow_ocr_errors:
          raise ValueError(f"OCR failed for {pdf_path.name}: page {page_no}: {error}")
        rows.append(ocr_row(pdf_path, page_no, text, error, dpi, generated_at))

      if not keep_rendered_images:
        for image in images:
          image.unlink(missing_ok=True)
  return rows


def fixture_to_ocr_rows(path: Path, dpi: int = 0) -> list[dict[str, Any]]:
  generated_at = datetime.now(timezone.utc).isoformat()
  rows: list[dict[str, Any]] = []
  for source in load_fixture_sources(path):
    source_file = Path(source.get("sourceFile", "fixture.pdf"))
    for page in source.get("pageTexts", []):
      rows.append(
        ocr_row(
          source_file,
          int(page.get("page", 0) or 0),
          page.get("text", ""),
          page.get("ocrError"),
          dpi,
          generated_at,
        )
      )
  return rows


def write_ocr_jsonl(rows: list[dict[str, Any]], output_path: Path) -> None:
  output_path.parent.mkdir(parents=True, exist_ok=True)
  with output_path.open("w", encoding="utf-8") as handle:
    for row in rows:
      handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def read_ocr_jsonl(input_path: Path) -> list[dict[str, Any]]:
  rows: list[dict[str, Any]] = []
  with input_path.open(encoding="utf-8") as handle:
    for line in handle:
      if line.strip():
        rows.append(json.loads(line))
  return rows


def build_page_index(rows: list[dict[str, Any]]) -> dict[str, Any]:
  pages: list[dict[str, Any]] = []
  for row in rows:
    signals = analyze_page_text(row.get("text", ""))
    pages.append(
      {
        "sourceId": row["sourceId"],
        "fileName": row["fileName"],
        "pageNumber": row["pageNumber"],
        "pageKind": signals["pageKind"],
        "questionNumbers": signals["questionNumbers"],
        "answerNumbers": signals["answerNumbers"],
        "criteriaCodes": signals["criteriaCodes"],
        "hasCriteriaCode": signals["hasCriteriaCode"],
        "hasAuditorJudgmentTerms": signals["hasAuditorJudgmentTerms"],
        "textChars": signals["textChars"],
        "ocrError": row.get("ocrError"),
        "confidence": signals["confidence"],
      }
    )
  kind_counts = Counter(page["pageKind"] for page in pages)
  return {
    "version": "0.1.0",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "sourceKind": "win_mock_exam_ocr_page_index",
    "counts": {
      "pages": len(pages),
      "sources": len({page["sourceId"] for page in pages}),
      "ocrErrors": sum(1 for page in pages if page.get("ocrError")),
      "byPageKind": dict(sorted(kind_counts.items())),
    },
    "pages": pages,
  }


def write_page_index(rows: list[dict[str, Any]], output_path: Path) -> dict[str, Any]:
  payload = build_page_index(rows)
  output_path.parent.mkdir(parents=True, exist_ok=True)
  output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
  return payload


def build_source(source: dict[str, Any], bank: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
  source_file = source.get("sourceFile", "win-mockexam.pdf")
  source_id = source_id_from_path(Path(source_file))
  page_texts = source.get("pageTexts", [])
  ocr_errors = [page for page in page_texts if page.get("ocrError")]
  if ocr_errors:
    details = ", ".join(f"page {page.get('page')}: {page.get('ocrError')}" for page in ocr_errors[:5])
    raise ValueError(f"OCR failed for {source_file}: {details}")
  for page_text in page_texts:
    page_text["kind"] = page_kind(clean_ocr_text(page_text.get("text", "")))
  questions = parse_question_blocks(page_texts, source_id, bank)
  answers = parse_answers(page_texts, source_id)
  attach_answers(questions, answers, bank)
  for question in questions:
    question["sourceId"] = source_id
    question["sourceFileName"] = unicodedata.normalize("NFC", Path(source_file).name)
  for answer in answers:
    answer["sourceId"] = source_id
    answer["sourceFileName"] = unicodedata.normalize("NFC", Path(source_file).name)
  source_summary = {
    "id": source_id,
    "file": unicodedata.normalize("NFC", Path(source_file).name),
    "fileName": unicodedata.normalize("NFC", Path(source_file).name),
    "pagesWithText": len(page_texts),
    "questions": len(questions),
    "answers": len(answers),
    "pageKinds": {
      kind: sum(1 for page in page_texts if page.get("kind") == kind)
      for kind in sorted({page.get("kind", "other") for page in page_texts})
    },
  }
  return source_summary, questions, answers


def build_from_ocr_rows(rows: list[dict[str, Any]], bank: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
  grouped: dict[str, dict[str, Any]] = {}
  for row in rows:
    source_id = row["sourceId"]
    source = grouped.setdefault(
      source_id,
      {
        "sourceFile": row["fileName"],
        "pageTexts": [],
      },
    )
    source["pageTexts"].append(
      {
        "page": row["pageNumber"],
        "text": row.get("text", ""),
        "ocrError": row.get("ocrError"),
      }
    )

  sources: list[dict[str, Any]] = []
  questions: list[dict[str, Any]] = []
  answers: list[dict[str, Any]] = []
  for source_id in sorted(grouped):
    grouped[source_id]["pageTexts"].sort(key=lambda item: item["page"])
    source_summary, source_questions, source_answers = build_source(grouped[source_id], bank)
    sources.append(source_summary)
    questions.extend(source_questions)
    answers.extend(source_answers)
  return sources, questions, answers


def build_from_fixture(path: Path, bank: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
  return build_from_ocr_rows(fixture_to_ocr_rows(path), bank)


def build_from_pdf(pdf_path: Path, pages: str, bank: dict[str, Any], render_dir: Path, dpi: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
  ranges = parse_page_ranges(pages)
  rows = ocr_pdf_to_rows(
    pdf_path,
    ranges,
    render_dir,
    dpi,
    batch_size=12,
    allow_ocr_errors=False,
    keep_rendered_images=True,
  )
  return build_from_ocr_rows(rows, bank)


def build_from_fixture_source(pdf_path: Path, page_texts: list[dict[str, Any]], bank: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
  source_summary, questions, answers = build_source(
    {"sourceFile": str(pdf_path), "pageTexts": page_texts},
    bank,
  )
  return [source_summary], questions, answers


def iter_source_pdfs(source_dir: Path) -> list[Path]:
  return sorted(path for path in source_dir.iterdir() if path.is_file() and path.suffix.lower() == ".pdf")


def build_candidate_type(question: dict[str, Any]) -> str:
  text = " ".join(
    [
      question.get("stem", ""),
      question.get("explanation", ""),
      " ".join(option.get("text", "") for option in question.get("options", [])),
    ]
  )
  if question.get("questionType") == "auditor_wrong_count":
    return "defect_count"
  if question.get("questionType") == "criteria_selection_like":
    return "criteria_choice"
  if "심사원" in text and ("결함" in text or "판단" in text):
    return "auditor_judgment"
  if "법" in text or "고시" in text or "인증 제도" in text:
    return "policy_or_law"
  return "needs_review"


def build_candidate_items(questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
  items: list[dict[str, Any]] = []
  for question in questions:
    text = " ".join(
      [
        question.get("stem", ""),
        question.get("explanation", ""),
        " ".join(option.get("text", "") for option in question.get("options", [])),
      ]
    )
    has_signal = bool(question.get("criteriaCodes")) or any(term in text for term in AUDITOR_JUDGMENT_TERMS)
    if not has_signal:
      continue
    candidate_type = build_candidate_type(question)
    review_status = (
      "draft_usable"
      if question.get("answerStatus") == "matched"
      and question.get("options")
      and (question.get("criteriaCodes") or question.get("explanationCriteriaCodes"))
      else "needs_review"
    )
    items.append(
      {
        "id": f"win-candidate:{stable_text_id(question['id'])}",
        "sourceQuestionId": question["id"],
        "sourceId": question.get("sourceId", ""),
        "sourceFileName": question.get("sourceFileName", ""),
        "questionNo": question.get("questionNo"),
        "pageNumber": question.get("pageNumber"),
        "candidateType": candidate_type,
        "reviewStatus": review_status,
        "answerStatus": question.get("answerStatus"),
        "optionCount": len(question.get("options", [])),
        "answerOptions": question.get("answerOptions", []),
        "criteriaCodes": question.get("criteriaCodes", []),
        "criteriaLabels": question.get("criteriaLabels", []),
      }
    )
  return items


def build_payload(sources: list[dict[str, Any]], questions: list[dict[str, Any]], answers: list[dict[str, Any]]) -> dict[str, Any]:
  criteria_related_count = sum(1 for question in questions if question.get("isCriteriaRelated"))
  matched_question_count = sum(1 for question in questions if question.get("answerStatus") == "matched")
  candidate_items = build_candidate_items(questions)
  candidate_type_counts = Counter(item["candidateType"] for item in candidate_items)
  review_status_counts = Counter(item["reviewStatus"] for item in candidate_items)
  answer_status_counts = Counter(question.get("answerStatus", "unknown") for question in questions)
  return {
    "version": "0.1.0",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "sourceKind": "win_mock_exam_ocr",
    "sources": sources,
    "counts": {
      "sources": len(sources),
      "questions": len(questions),
      "answers": len(answers),
      "criteriaRelatedQuestions": criteria_related_count,
      "questionsWithMatchedAnswers": matched_question_count,
      "questionsWithAnswerExplanations": len(answers),
      "candidateItems": len(candidate_items),
      "needsReviewCandidateItems": sum(1 for item in candidate_items if item["reviewStatus"] == "needs_review"),
      "candidateTypes": dict(sorted(candidate_type_counts.items())),
      "reviewStatuses": dict(sorted(review_status_counts.items())),
      "answerStatuses": dict(sorted(answer_status_counts.items())),
    },
    "questions": questions,
    "answers": answers,
    "candidateItems": candidate_items,
    "needsReview": [item for item in candidate_items if item["reviewStatus"] == "needs_review"],
  }


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("--source-dir", default=DEFAULT_WIN_MOCK_DIR)
  parser.add_argument("--pdf", default="")
  parser.add_argument("--pages", default="")
  parser.add_argument("--ocr-all", action="store_true")
  parser.add_argument("--ocr-input", default="")
  parser.add_argument("--ocr-output", default="")
  parser.add_argument("--page-index-output", default="")
  parser.add_argument("--allow-ocr-errors", action="store_true")
  parser.add_argument("--keep-rendered-images", action="store_true")
  parser.add_argument("--batch-size", type=int, default=12)
  parser.add_argument("--dpi", type=int, default=180)
  parser.add_argument("--render-dir", default=DEFAULT_RENDER_DIR)
  parser.add_argument("--bank", default=DEFAULT_BANK)
  parser.add_argument("--output", default=DEFAULT_OUTPUT)
  parser.add_argument("--text-fixture", default="")
  args = parser.parse_args()

  bank = load_bank(Path(args.bank))
  ocr_rows: list[dict[str, Any]] = []
  try:
    if args.ocr_input:
      ocr_rows = read_ocr_jsonl(Path(args.ocr_input))
      sources, questions, answers = build_from_ocr_rows(ocr_rows, bank)
    elif args.ocr_all:
      pdfs = [Path(args.pdf)] if args.pdf else iter_source_pdfs(Path(args.source_dir))
      for pdf_path in pdfs:
        total_pages = page_count(pdf_path)
        print(json.dumps({"ocrSource": pdf_path.name, "pages": total_pages}, ensure_ascii=False))
        ocr_rows.extend(
          ocr_pdf_to_rows(
            pdf_path,
            [(1, total_pages)],
            Path(args.render_dir),
            args.dpi,
            args.batch_size,
            args.allow_ocr_errors,
            args.keep_rendered_images,
          )
        )
      sources, questions, answers = build_from_ocr_rows(ocr_rows, bank)
    elif args.text_fixture:
      ocr_rows = fixture_to_ocr_rows(Path(args.text_fixture))
      sources, questions, answers = build_from_ocr_rows(ocr_rows, bank)
    elif args.pdf and args.pages:
      ranges = parse_page_ranges(args.pages)
      ocr_rows = ocr_pdf_to_rows(
        Path(args.pdf),
        ranges,
        Path(args.render_dir),
        args.dpi,
        args.batch_size,
        args.allow_ocr_errors,
        args.keep_rendered_images,
      )
      sources, questions, answers = build_from_ocr_rows(ocr_rows, bank)
    else:
      raise ValueError("Provide --text-fixture, --ocr-all, or both --pdf and --pages.")
  except ValueError as error:
    raise SystemExit(str(error)) from None

  if args.ocr_output:
    write_ocr_jsonl(ocr_rows, Path(args.ocr_output))
  if args.page_index_output:
    write_page_index(ocr_rows, Path(args.page_index_output))

  payload = build_payload(sources, questions, answers)

  output = Path(args.output)
  output.parent.mkdir(parents=True, exist_ok=True)
  output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
  print(json.dumps({"output": str(output), **payload["counts"]}, ensure_ascii=False))


if __name__ == "__main__":
  main()
