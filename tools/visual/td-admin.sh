#!/usr/bin/env bash
# td-admin.sh <route> <NN-Name> [width] — text-diff an admin console route against its screens-html reference.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
node "$ROOT/tools/visual/textdiff.mjs" "http://localhost:3100$1" "file://$ROOT/reference/screens-html/XRP-Screens-HTML/admin-console/$2.html" --width="${3:-1440}" --height=1000
