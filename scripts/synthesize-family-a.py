"""Family A distractor synthesis: same defect-case body + WRONG criterion code.

Deterministic. No LLM. Includes the correctness guard:
- never reuse the case's true code as a distractor,
- never reuse any code the workbook ever marked true for that exact case.

Difficulty tier by relationship:
- A1 same group  -> hard (5)   (e.g. 2.7.1 vs 2.7.2)
- A2 same domain -> medium (3)
- A3 diff domain -> easy (1)
"""
from __future__ import annotations

import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

BANK = Path("public/data/ismsp-defect-bank.json")
OUT = Path("public/data/synth-family-a.json")
PER_CASE = 6  # distractors per defect case (drawn from the ranked similar list)


def norm(s: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFC", s or ""))


def main() -> None:
    bank = json.loads(BANK.read_text(encoding="utf-8"))
    criteria = bank["criteria"]
    similar = bank["similarCriteriaByCode"]

    # Guard: every code the workbook ever marked TRUE for a given case.
    true_codes_by_case: dict[str, set[str]] = defaultdict(set)
    for t in bank["truePool"]:
        true_codes_by_case[norm(t["defectCase"])].add(t["criteriaCode"])

    out: list[dict] = []
    tier_count = {"A1": 0, "A2": 0, "A3": 0}

    for case in bank["defectCasePool"]:
        body = case["defectCase"]
        true_code = case["criteriaCode"]
        banned = true_codes_by_case.get(norm(body), set()) | {true_code}
        base = criteria.get(true_code, {})
        base_group = base.get("groupCode", "")
        base_domain = base.get("domain", "")

        picked = 0
        for code in similar.get(true_code, []):
            if picked >= PER_CASE:
                break
            if code in banned or code not in criteria:
                continue
            cand = criteria[code]
            if base_group and cand.get("groupCode") == base_group:
                axis, difficulty = "A1", 5
            elif base_domain and cand.get("domain") == base_domain:
                axis, difficulty = "A2", 3
            else:
                axis, difficulty = "A3", 1
            name = cand.get("name", "")
            out.append(
                {
                    "id": f"synA-{len(out) + 1}",
                    "statement": f"{body} {code} {name} 결함에 해당한다.",
                    "defectCase": body,
                    "criteriaCode": code,       # the WRONG code this distractor claims
                    "criteriaName": name,
                    "correctAnswer": true_code,
                    "correctAnswerName": case.get("criteriaName", ""),
                    "isCorrect": False,
                    "family": "A",
                    "trapAxis": axis,
                    "difficulty": difficulty,
                    "source": "heuristic",
                    "wrongnessReason": (
                        f"이 결함사례의 정답 기준은 {true_code}이며, {code}는 "
                        f"{'같은 분류군' if axis == 'A1' else ('같은 도메인' if axis == 'A2' else '다른 도메인')}의 "
                        f"다른 기준이라 오적용이다."
                    ),
                    "sourceRow": case.get("sourceRow"),
                }
            )
            tier_count[axis] += 1
            picked += 1

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"familyA": len(out), "byTier": tier_count, "out": str(OUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
