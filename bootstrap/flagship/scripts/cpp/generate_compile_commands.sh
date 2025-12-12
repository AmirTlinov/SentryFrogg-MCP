#!/usr/bin/env bash
set -euo pipefail
mkdir -p build
if command -v cmake >/dev/null 2>&1; then
  cmake -S . -B build -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
  ln -sf build/compile_commands.json . || true
elif command -v bear >/dev/null 2>&1; then
  echo "WARN: using bear to capture compile commands; run your build to populate file"
else
  echo "WARN: cmake/bear not found; cannot generate compile_commands.json"
fi
