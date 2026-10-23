#!/usr/bin/env bash
# td.sh <route> <NN-Name> [theme] — text-diff an app route against its screens-html reference.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
THEME="${3:-dark}"
node "$ROOT/tools/visual/textdiff.mjs" "http://localhost:8081/$1" "file://$ROOT/reference/screens-html/XRP-Screens-HTML/mobile-$THEME/$2-$THEME.html" --theme="$THEME"
