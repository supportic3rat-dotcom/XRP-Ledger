#!/usr/bin/env bash
# compare-admin.sh <route> <NN-Name> [width]  → screenshots app + reference at 1440×1000 (1×) and prints the diff score
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${OUT:?set OUT dir}"
W="${3:-1440}"
REF="file://$ROOT/reference/screens-html/XRP-Screens-HTML/admin-console/$2.html"
WIDTH="$W" HEIGHT=1000 SCALE=1 node "$ROOT/tools/visual/shots.mjs" "$OUT" "app-$2-$W=http://localhost:3100$1" "ref-$2-$W=$REF" >/dev/null
"${PY:-python3}" "$ROOT/tools/visual/compare.py" "$OUT/ref-$2-$W.png" "$OUT/app-$2-$W.png" "$OUT/cmp-$2-$W.png"
