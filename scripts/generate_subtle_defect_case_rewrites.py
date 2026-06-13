#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import openpyxl


CODE_RE = re.compile(r"^(?:1|2|3)\.\d{1,2}\.\d{1,2}$")


def cell(value: Any) -> str:
  if value is None:
    return ""

  normalized = (
    str(value)
    .replace("ʻ", "'")
    .replace("ʼ", "'")
    .replace("‘", "'")
    .replace("’", "'")
    .replace("“", '"')
    .replace("”", '"')
    .replace("\u00a0", " ")
  )
  return re.sub(r"\s+", " ", normalized).strip()


def find_file(source_dir: Path, *parts: str) -> Path:
  for path in sorted(source_dir.iterdir(), key=lambda item: item.name):
    name = unicodedata.normalize("NFC", path.name)
    if path.is_file() and all(part in name for part in parts):
      return path
  raise FileNotFoundError(f"Could not find file containing: {parts}")



def normalize(value: str) -> str:
  return re.sub(r"\s+", "", str(value or "")).strip().lower()


def char_ngrams(value: str, size: int = 2) -> set[str]:
  text = re.sub(r"\s+", "", value or "")
  if len(text) < size:
    return {text} if text else set()
  return {text[index : index + size] for index in range(len(text) - size + 1)}


def similarity_score(left: str, right: str) -> float:
  left_grams = char_ngrams(left)
  right_grams = char_ngrams(right)
  if not left_grams or not right_grams:
    return 0.0
  intersection = len(left_grams & right_grams)
  return (2 * intersection) / (len(left_grams) + len(right_grams))


def _replace_once(text: str, pattern: str, repl: str) -> str:
  result = re.sub(pattern, repl, text, count=1)
  return result if result != text else text


def _pick_and_apply(text: str, mutators: list[Callable[[str], str]], rng: random.Random) -> str:
  transformed = text
  attempts = 0
  while attempts < 4:
    mutator = rng.choice(mutators)
    candidate = mutator(transformed)
    if candidate != transformed:
      return candidate
    attempts += 1
  return text


def _mutate_time_scope(text: str, rng: random.Random) -> str:
  adders = [
    "다만 일부 자산군에서만 조치가 반영되어 예외 구간이 남은 상태",
    "다만 최근 변경 직후에만 확인 지연이 나타난 것으로 보임",
    "다만 영업시간 외 운영에서만 간헐적으로 점검되어 있음",
    "다만 핵심 구간은 반영됐으나 일부 구간만 미검토 상태",
  ]
  candidates = [item for item in adders if item not in text]
  if not candidates:
    return text
  return f"{text}, {rng.choice(candidates)}"


def _mutate_quantifier(text: str) -> str:
  replacements = [
    (r"\b모두\b", "대부분"),
    (r"\b항상\b", "대체로"),
    (r"\b전면\b", "일부 구간"),
    (r"\b누락\b", "일부 누락"),
    (r"\b미흡\b", "부분적 미흡"),
    (r"\b지체 없이\b", "영향이 적은 시점에"),
    (r"\b즉시\b", "영업시간 내"),
  ]
  for pattern, repl in replacements:
    candidate = _replace_once(text, pattern, repl)
    if candidate != text:
      return candidate
  return text


def _mutate_boundary(text: str) -> str:
  boundary_patterns = [
    ("이루지", "대체로 이루지"),
    ("없다", "일부만 없다"),
    ("안했다", "완전히 안 하지 않았음"),
    ("않고", "전체적으로 하지 않고"),
  ]
  for pattern, repl in boundary_patterns:
    candidate = _replace_once(text, pattern, repl)
    if candidate != text:
      return candidate
  return text


def _mutate_conjunction(text: str, rng: random.Random) -> str:
  if "다만" in text or "다만," in text:
    return text
  if rng.random() < 0.4:
    tail = "다만 특정 구간은 감사 시점만 확인된 상태"
    if tail in text:
      return text
    return f"{text}, {tail}"
  return text


def generate_subtle_variant(source: str, rng: random.Random) -> str:
  text = source
  mutators = [
    _mutate_quantifier,
    _mutate_boundary,
    lambda value: _mutate_time_scope(value, rng),
  ]
  for _ in range(2):
    text = _pick_and_apply(text, mutators, rng)
  text = _mutate_conjunction(text, rng)

  if text == source:
    text = f"{text}, 다만 일부 기록이 즉시 반영되지 않음"

  return text


def load_true_items(path: Path) -> list[dict[str, Any]]:
  workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
  sheet = workbook["(참고) 소스1"]
  rows: list[dict[str, Any]] = []
  for row_index, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
    cells = [cell(value) for value in row]
    if len(cells) < 9:
      continue

    criteria_code = cells[3]
    criteria_name = cells[4]
    defect_case = cells[5]
    truth = cells[8]

    if not CODE_RE.match(criteria_code) or truth != "1" or not defect_case:
      continue

    statement = (
      cells[7] or f"{defect_case} {criteria_code} {criteria_name} 결함에 해당한다."
    )
    source_key = f"{criteria_code}|{normalize(defect_case)}"
    source_hash = hashlib.sha256(source_key.encode("utf-8")).hexdigest()[:16]
    rows.append(
      {
        "sourceId": f"t-{row_index}",
        "criteriaCode": criteria_code,
        "criteriaName": criteria_name,
        "sourceRow": row_index,
        "sourceHash": source_hash,
        "defectCase": defect_case,
        "statement": statement,
      },
    )
  return rows


def build_markdown(rows: list[dict[str, Any]], output_path: Path) -> None:
  lines = [
    "# Defect Case Rewrite Samples",
    "",
    "Generated: " + datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    "",
    "Purpose: 원문 결함사례를 앱에 그대로 노출하지 않고, 미세 오차형 문장으로 바꾼 검토용 샘플입니다.",
    "",
    "Policy: 원문 문장은 이 파일에 포함하지 않는다. `sourceRow`, `sourceId`, `sourceHash`는 내부 추적용이다.",
    "",
    "| No | 기준 | 상태 | 원문유사도 | 새 학습 문장 | 핵심 패턴 |",
    "|---:|---|---|---:|---|---|",
  ]

  for index, row in enumerate(rows, start=1):
    lines.append(
      f"| {index} | {row['criteriaCode']} {row['criteriaName']} | {row['status']} | {row['sourceSimilarity']:.3f} | {row['generatedCaseText']} | {row['defectPattern']} |",
    )

  lines.append("")
  lines.append("## Review Notes")
  for index, row in enumerate(rows, start=1):
    lines.append(
      f"- {index}. {row['criteriaCode']} {row['criteriaName']}: 원문은 근거로만 두고 새 상황 문장으로 사용 가능 "
      f"(sourceRow {row['sourceRow']}, sourceHash {row['sourceHash']})",
    )

  output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_json(rows: list[dict[str, Any]], output_path: Path) -> None:
  payload = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "policy": "sourceTextIncluded: false",
    "samples": rows,
  }
  output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument(
    "--source-dir",
    default="/Users/kangsungbae/Downloads/drive-download-20260613T123004Z-3-001",
  )
  parser.add_argument("--count", type=int, default=20)
  parser.add_argument("--seed", type=int, default=20260613)
  parser.add_argument(
    "--json-output",
    default="ai/generated/defect-case-rewrite-samples-2026-06-13.json",
  )
  parser.add_argument(
    "--md-output",
    default="ai/generated/defect-case-rewrite-samples-2026-06-13.md",
  )
  args = parser.parse_args()

  rng = random.Random(args.seed)
  source_dir = Path(args.source_dir)
  candidates_path = find_file(source_dir, "결함", "테스트", "240712v2")

  true_items = load_true_items(candidates_path)
  if len(true_items) < args.count:
    raise ValueError(f"Need at least {args.count} true items, got {len(true_items)}")

  rng.shuffle(true_items)
  selected = true_items[: args.count]
  samples: list[dict[str, Any]] = []
  for item in selected:
    generated = generate_subtle_variant(item["defectCase"], rng)
    similarity = similarity_score(normalize(item["defectCase"]), normalize(generated))

    samples.append(
      {
        "criteriaCode": item["criteriaCode"],
        "criteriaName": item["criteriaName"],
        "sourceId": item["sourceId"],
        "sourceRow": item["sourceRow"],
        "sourceHash": item["sourceHash"],
        "sourceTextIncluded": False,
        "defectPattern": "boundary-gap",
        "generatedCaseText": generated,
        "sourceSimilarity": round(similarity, 3),
        "status": "draft",
      },
    )

  build_json(samples, Path(args.json_output))
  build_markdown(samples, Path(args.md_output))

  summary = {
    "json": str(args.json_output),
    "markdown": str(args.md_output),
    "count": len(samples),
    "maxSimilarity": max(item["sourceSimilarity"] for item in samples),
    "minSimilarity": min(item["sourceSimilarity"] for item in samples),
  }
  print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
  main()
