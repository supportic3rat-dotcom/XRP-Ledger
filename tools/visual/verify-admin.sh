#!/usr/bin/env bash
# verify-admin.sh [width] — pixel- and text-diff every admin view against screens-html (needs the dev server on :3100).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
W="${1:-1440}"
while read -r route name; do
  echo "== $name"
  "$ROOT/tools/visual/compare-admin.sh" "$route" "$name" "$W"
  "$ROOT/tools/visual/td-admin.sh" "$route" "$name" "$W" | grep -v "^$" | tail -n +1 | grep -E "DIFF|MISSING|EXTRA|issues" | head -20
done <<LIST
/ 01-Overview
/queue 02-Approval-queue
/transactions 03-Transactions
/reconciliation 04-Reconciliation
/users 05-Users
/custody 06-Custody
/audit 07-Audit-log
LIST
