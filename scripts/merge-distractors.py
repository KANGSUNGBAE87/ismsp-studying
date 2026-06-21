"""Merge synthesized distractors into one final pool.

- Family A: deterministic synthesis (already guarded) -> kept as-is.
- Family B: join generated candidates (famB-gen/*) with verifier verdicts
  (famB-verified/*) by index. Apply verdict:
    keep   -> use statement
    revise -> use revisedStatement (fallback to statement)
    reject -> drop
Outputs public/data/synth-distractors.json + prints a summary.
"""
from __future__ import annotations

import glob
import json
import os
from collections import Counter
from pathlib import Path

FAM_A = Path("public/data/synth-family-a.json")
GEN_DIR = Path("scripts/famB-gen")
VER_DIR = Path("scripts/famB-verified")
OUT = Path("public/data/synth-distractors.json")


def main() -> None:
    merged: list[dict] = []

    # Family A
    fam_a = json.loads(FAM_A.read_text(encoding="utf-8")) if FAM_A.exists() else []
    merged.extend(fam_a)

    # Family B: per batch, join gen + verdict by index
    famB_kept = 0
    famB_seen = 0
    for gen_path in sorted(glob.glob(str(GEN_DIR / "batch-*.json"))):
        name = os.path.basename(gen_path)
        ver_path = VER_DIR / name
        gen = json.loads(Path(gen_path).read_text(encoding="utf-8"))
        verdicts = {}
        if ver_path.exists():
            for v in json.loads(ver_path.read_text(encoding="utf-8")):
                verdicts[v.get("index")] = v
        for i, cand in enumerate(gen):
            famB_seen += 1
            v = verdicts.get(i)
            if v is None:
                # not yet verified -> hold out (do not ship unverified)
                continue
            verdict = v.get("verdict")
            if verdict == "reject":
                continue
            statement = cand["statement"]
            if verdict == "revise" and v.get("revisedStatement"):
                statement = v["revisedStatement"]
            merged.append(
                {
                    "id": f"synB-{famB_kept + 1}",
                    "statement": statement,
                    "defectCase": cand["defectCase"],
                    "criteriaCode": cand["correctAnswer"],  # claimed code == its own correct (body-variant): mark via family
                    "correctAnswer": cand["correctAnswer"],
                    "isCorrect": False,
                    "family": "B",
                    "trapAxis": v.get("correctedTrapAxis") or cand.get("trapAxis"),
                    "difficulty": v.get("difficulty"),
                    "source": "llm",
                    "changedFrom": cand.get("changedFrom"),
                    "changedTo": cand.get("changedTo"),
                    "wrongnessReason": cand.get("wrongnessReason"),
                    "verifiedBy": ["subagent"],
                    "verdict": verdict,
                }
            )
            famB_kept += 1

    OUT.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")

    fam_counts = Counter(x["family"] for x in merged)
    diff_counts = Counter(x.get("difficulty") for x in merged if x["family"] == "B")
    a_tier = Counter(x.get("trapAxis") for x in merged if x["family"] == "A")
    print(json.dumps({
        "total": len(merged),
        "familyA": fam_counts.get("A", 0),
        "familyB_kept": famB_kept,
        "familyB_seen": famB_seen,
        "familyA_tier": dict(a_tier),
        "familyB_difficulty": dict(diff_counts),
        "out": str(OUT),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
