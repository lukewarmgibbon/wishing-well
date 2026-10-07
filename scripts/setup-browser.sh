#!/usr/bin/env bash
# Make the Playwright Chromium build runnable in this sandbox.
#
# There is no root here, so `playwright install-deps` / `apt-get install` both
# fail. The missing shared libraries are extracted from Debian .deb packages
# into a local prefix instead, and Chromium is pointed at it via
# LD_LIBRARY_PATH. Nothing is installed system-wide.
#
#   bash scripts/setup-browser.sh
#   export LD_LIBRARY_PATH=$PWD/.browser-libs/root/usr/lib/x86_64-linux-gnu:$PWD/.browser-libs/root/lib/x86_64-linux-gnu
#
# Note: this is only needed for the Chromium checks (extension regression,
# screenshots). The app itself and its tests need none of it.
set -euo pipefail

PREFIX="${PWD}/.browser-libs"
mkdir -p "$PREFIX/debs" "$PREFIX/root"
cd "$PREFIX/debs"

# Debian 13 "trixie" renamed several of these with a t64 suffix.
PKGS=(
  libnss3 libnspr4 libxdamage1 libxkbcommon0 libxcomposite1 libxrandr2
  libgbm1 libpango-1.0-0 libcairo2 libdrm2 libxfixes3
  libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64
  libcups2t64 libasound2t64 libavahi-client3 libavahi-common3 libx11-xcb1 libxcb-dri3-0
)

for p in "${PKGS[@]}"; do
  url=$(curl -s "https://packages.debian.org/trixie/amd64/$p/download" \
         | grep -oE 'http://ftp[^"]*\.deb' | head -1)
  if [ -n "$url" ]; then
    curl -sL -o "$p.deb" "$url"
    dpkg-deb -x "$p.deb" "$PREFIX/root"
    echo "  got $p"
  else
    echo "  MISS $p (skipping)"
  fi
done

CHROME=$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null | head -1)
if [ -n "$CHROME" ]; then
  export LD_LIBRARY_PATH="$PREFIX/root/usr/lib/x86_64-linux-gnu:$PREFIX/root/lib/x86_64-linux-gnu"
  echo
  "$CHROME" --version && echo "Chromium is runnable."
else
  echo "Playwright's Chromium is not downloaded yet — run: npx playwright install chromium"
fi
