#!/usr/bin/env bash
set -euo pipefail
REPORTS_DIR="${1:-reports}"
mkdir -p "$REPORTS_DIR"
OUT="$REPORTS_DIR/metrics.json"
tmp="$(mktemp)"; [ -f "$OUT" ] && cp "$OUT" "$tmp" || echo '{}' > "$tmp"

# pytest-benchmark JSON
if [ -f "$REPORTS_DIR/bench_py.json" ]; then
  ${PY:-python3} - "$REPORTS_DIR/bench_py.json" "$tmp" <<'PY'
import json,sys
bench=json.load(open(sys.argv[1])); metrics=json.load(open(sys.argv[2]))
p95=p99=0.0
for b in bench.get("benchmarks",[]):
    stats=b.get("stats",{}); perc=stats.get("percentile",{})
    p95=max(p95, float(perc.get("95.0", 0.0))); p99=max(p99, float(perc.get("99.0", 0.0)))
metrics["p95_ms"]=p95; metrics["p99_ms"]=p99
json.dump(metrics, open(sys.argv[2],"w"))
print(f"pytest-benchmark: p95={p95} p99={p99}")
PY
fi

# Criterion proxy (Rust)
if [ -d target/criterion ]; then
  ${PY:-python3} - "$tmp" <<'PY'
import json,sys,glob
metrics=json.load(open(sys.argv[1]))
p=0.0
for path in glob.glob("target/criterion/*/new/estimates.json"):
    try:
        est=json.load(open(path))
        mean_ns=est.get("mean",{}).get("point_estimate",0.0)
        p=max(p, mean_ns/1e6)
    except Exception: pass
metrics["p95_ms"]=max(metrics.get("p95_ms",0.0), p)
metrics["p99_ms"]=max(metrics.get("p99_ms",0.0), p)
json.dump(metrics, open(sys.argv[1],"w"))
print(f"criterion proxy mean_ms={p}")
PY
fi

mv "$tmp" "$OUT"
echo "Bench metrics aggregated → $OUT"
${PY:-python3} scripts/bench/generate_baseline.py "$OUT"
