#!/usr/bin/env bash
# Screenshot a URL at the design's 390×844 frame, 3× (same pixels as reference/screens PNGs).
# Usage: shoot.sh <url> <out.png> [width] [height] [scale]
set -euo pipefail
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-color-profile=srgb \
  --window-size="${3:-390},${4:-844}" --force-device-scale-factor="${5:-3}" \
  --virtual-time-budget="${BUDGET:-25000}" --screenshot="$2" "$1" >/dev/null 2>&1
echo "$2"
