#!/usr/bin/env python3
"""Compute complexity metrics (cyclomatic, cognitive, duplication) and enforce limits."""
from __future__ import annotations

import json
import sys
from pathlib import Path

USAGE = "complexity.py <metrics_json> <lizard_json> <jscpd_json> <cyclo_limit> <cog_limit> <dup_limit>"


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text())
    except Exception:
        return default


def cyclomatic_from_lizard(data) -> int:
    cyclo = 0
    if isinstance(data, list):
        for file_info in data:
            for func in file_info.get("functions", []):
                try:
                    cyclo = max(cyclo, int(func.get("cyclomatic_complexity", 0)))
                except Exception:
                    continue
    return cyclo


def cognitive_from_lizard(data) -> int:
    cog = 0
    if isinstance(data, list):
        for file_info in data:
            for func in file_info.get("functions", []):
                try:
                    cog = max(cog, int(func.get("cognitive_complexity", 0)))
                except Exception:
                    continue
    return cog


def duplication_from_jscpd(data) -> float:
    if isinstance(data, dict):
        summary = data.get("summary", {})
        try:
            return float(summary.get("percentage", 0.0))
        except Exception:
            return 0.0
    return 0.0


def main(argv: list[str]) -> int:
    if len(argv) != 7:
        print(f"BLOCKER: {USAGE}", file=sys.stderr)
        return 2

    metrics_path = Path(argv[1])
    lizard_path = Path(argv[2])
    jscpd_path = Path(argv[3])
    try:
        cyclo_limit = int(argv[4])
        cog_limit = int(argv[5])
        dup_limit = float(argv[6])
    except ValueError:
        print("BLOCKER: invalid numeric limits", file=sys.stderr)
        return 2

    metrics = load_json(metrics_path, {})
    lizard = load_json(lizard_path, [])
    jscpd = load_json(jscpd_path, {})

    cyclo = cyclomatic_from_lizard(lizard)
    cog = cognitive_from_lizard(lizard)
    dup = duplication_from_jscpd(jscpd)

    metrics.update(
        {
            "cyclomatic_max": cyclo,
            "cognitive_max": cog,
            "dup_pct": dup,
        }
    )

    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.write_text(json.dumps(metrics, indent=2))

    print(
        "Complexity metrics → cyclomatic_max={cyclo}, cognitive_max={cog}, dup_pct={dup:.2f}%".format(
            cyclo=cyclo,
            cog=cog,
            dup=dup,
        )
    )

    if cyclo > cyclo_limit:
        print("BLOCKER: cyclomatic complexity over limit", file=sys.stderr)
        return 2
    if cog > cog_limit:
        print("BLOCKER: cognitive complexity over limit", file=sys.stderr)
        return 2
    if dup > dup_limit:
        # jscpd already enforces, but keep guard for completeness
        print("BLOCKER: duplication percentage over limit", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
