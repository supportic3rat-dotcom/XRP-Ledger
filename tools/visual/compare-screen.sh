#!/usr/bin/env bash
# compare-screen.sh <name> <appPath> <refFile> [theme]  → writes cmp-<name>.png and prints the diff score
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${OUT:?set OUT dir}"
THEME="${4:-dark}"
REF="file://$ROOT/reference/screens-html/XRP-Screens-HTML/mobile-$THEME/$3"
THEME="$THEME" node "$ROOT/tools/visual/shots.mjs" "$OUT" "app-$1=http://localhost:8081$2" "ref-$1=$REF" >/dev/null
"${PY:-python3}" "$ROOT/tools/visual/compare.py" "$OUT/ref-$1.png" "$OUT/app-$1.png" "$OUT/cmp-$1.png"
