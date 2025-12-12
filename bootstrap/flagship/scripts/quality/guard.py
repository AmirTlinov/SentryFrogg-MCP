#!/usr/bin/env python3
import json, sys, os
from pathlib import Path

if len(sys.argv) < 3:
    print("BLOCKER: guard.py usage: guard.py <configs/guardrails.json> <reports/metrics.json>", file=sys.stderr)
    sys.exit(2)

cfg_path, met_path = Path(sys.argv[1]), Path(sys.argv[2])
if not cfg_path.exists():
    print(f"BLOCKER: missing {cfg_path}", file=sys.stderr); sys.exit(2)
if not met_path.exists():
    print(f"BLOCKER: missing {met_path}", file=sys.stderr); sys.exit(2)

cfg = json.load(open(cfg_path))
met = json.load(open(met_path))
viol = []

if met.get("dup_pct", 0) > cfg.get("dup_threshold_pct", 1e9): viol.append("dup_pct")
if met.get("cyclomatic_max", 0) > cfg.get("cyclomatic_max", 1e9): viol.append("cyclomatic_max")
if met.get("cognitive_max", 0) > cfg.get("cognitive_max", 1e9): viol.append("cognitive_max")

p95b = cfg.get("p95_budget_ms", 0); p99b = cfg.get("p99_budget_ms", 0)
if p95b and met.get("p95_ms", 0) > p95b: viol.append("p95_ms")
if p99b and met.get("p99_ms", 0) > p99b: viol.append("p99_ms")

if viol:
    print("BLOCKER: guardrails violated → " + ",".join(viol))
    sys.exit(2)
print("OK: guardrails pass")
