#!/usr/bin/env bash
set -euo pipefail
VER="${1:-v1.33.0}"
DEST="${2:-tools/syft}"
mkdir -p "$DEST"

if [ -x "$DEST/syft" ]; then
  existing="$($DEST/syft version 2>/dev/null | awk '{print $3}' || true)"
  if [ "$existing" = "${VER#v}" ]; then
    echo "Syft v${existing} already installed at $DEST"
    exit 0
  fi
fi

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH=amd64 ;;
  arm64|aarch64) ARCH=arm64 ;;
  *) echo "Unsupported arch: $ARCH"; exit 1 ;;
esac
TAR="syft_${VER#v}_${OS}_${ARCH}.tar.gz"
URL="https://github.com/anchore/syft/releases/download/${VER}/${TAR}"
tmpfile="$(mktemp /tmp/syft.XXXXXX)"
echo "Downloading $URL"
curl -fsSL "$URL" -o "$tmpfile"
tar -xzf "$tmpfile" -C "$DEST"
rm -f "$tmpfile"
chmod +x "$DEST/syft"
echo "Installed syft → $DEST/syft"
