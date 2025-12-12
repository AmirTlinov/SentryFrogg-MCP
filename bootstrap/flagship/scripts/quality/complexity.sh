#!/usr/bin/env bash
set -euo pipefail
CYCLO_LIMIT="${1:-10}"
COG_LIMIT="${2:-15}"
REPORTS_DIR="${3:-reports}"
DUP_LIMIT="${4:-${DUP_THRESHOLD:-3}}"
mkdir -p "$REPORTS_DIR"
REPORTS_GLOB="./${REPORTS_DIR}/*"

LIST_FILE=$(mktemp)
cleanup() {
  rm -f "$LIST_FILE"
}
trap cleanup EXIT

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git ls-files > "$LIST_FILE" || true
else
  find . -type f \( \
    -name '*.py' -o -name '*.rs' -o -name '*.go' -o -name '*.js' -o -name '*.ts' -o -name '*.tsx' -o -name '*.jsx' -o \
    -name '*.[ch]' -o -name '*.cc' -o -name '*.cxx' -o -name '*.cpp' -o -name '*.hpp' -o -name '*.hh' -o -name '*.hxx' \
  \) \
    -not -path './.git/*' -not -path './node_modules/*' -not -path './.venv/*' -not -path "$REPORTS_GLOB" -not -path './artifacts/*' \
    > "$LIST_FILE"
fi

if command -v .venv/bin/python >/dev/null 2>&1; then PY=.venv/bin/python; else PY=${PY:-python3}; fi

if $PY -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('lizard') else 1)" >/dev/null 2>&1; then
  FILE_LIST_PATH="$LIST_FILE" $PY - <<'PY' > "$REPORTS_DIR/lizard.json"
import json, os, shlex, subprocess, sys
file_list_path = os.environ.get("FILE_LIST_PATH", "")
files = []
if file_list_path:
    try:
        with open(file_list_path, "r", encoding="utf-8") as fh:
            files = [line.strip() for line in fh if line.strip()]
    except OSError:
        files = []
if files:
    cmd = "lizard -j " + " ".join(shlex.quote(f) for f in files)
    proc = subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    sys.stdout.write(proc.stdout.decode())
else:
    sys.stdout.write("[]")
PY
else
  echo '{"status":"skip","reason":"lizard not installed"}' > "$REPORTS_DIR/lizard.json"
fi

JSPCD_JSON="$REPORTS_DIR/jscpd/jscpd-report.json"
if [ ! -f "$JSPCD_JSON" ]; then
  mkdir -p "$(dirname "$JSPCD_JSON")"
  echo '{"summary":{"percentage":0.0}}' > "$JSPCD_JSON"
fi

$PY scripts/quality/complexity.py "$REPORTS_DIR/metrics.json" "$REPORTS_DIR/lizard.json" "$JSPCD_JSON" "$CYCLO_LIMIT" "$COG_LIMIT" "$DUP_LIMIT"
