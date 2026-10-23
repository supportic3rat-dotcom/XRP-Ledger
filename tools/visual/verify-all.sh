#!/usr/bin/env bash
# Runs the numeric text-run diff for every mobile screen in one or both themes. Needs `pnpm mobile -- --web` on :8081.
# Usage: verify-all.sh [dark|light|both]
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
THEMES="${1:-both}"; [ "$THEMES" = both ] && THEMES="dark light"
SCREENS=(
  "welcome|01-Welcome" "sign-in|02-SignIn" "connect-wallet|03-ConnectWallet" "create-account|04-CreateAccount"
  "verify?status=not_started|05-Verify" "identity|06-IdentityCapture" "?session=1|07-Home" "notifications?session=1|08-Notifications"
  "asset/XRP?session=1|09-AssetDetail" "markets?session=1|10-Markets" "deposit?session=1|11-Deposit" "withdraw?session=1|12-Withdraw"
  "exchange?session=1|13-Exchange" "earn?session=1|14-Earn" "borrow?session=1|15-Borrow" "loan/manage?session=1|16-LoanManage"
  "custody?session=1|17-Custody" "profile?session=1|18-Profile" "security?session=1|19-Security" "support?session=1|20-Support" "legal?session=1|21-Legal"
)
for theme in $THEMES; do
  for s in "${SCREENS[@]}"; do
    route="${s%%|*}"; name="${s##*|}"
    out="$("$ROOT/tools/visual/td.sh" "$route" "$name" "$theme" 2>&1)"
    summary="$(echo "$out" | tail -1)"
    colors="$(echo "$out" | grep -c 'color ' || true)"
    printf '%-6s %-20s %s%s\n' "$theme" "$name" "$summary" "$([ "$colors" != 0 ] && echo "  ⚠ $colors colour diffs")"
  done
done
