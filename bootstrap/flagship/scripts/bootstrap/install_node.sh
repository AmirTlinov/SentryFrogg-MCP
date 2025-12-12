#!/usr/bin/env bash
set -euo pipefail
VER="${1:-v20.18.0}"
DEST="${2:-tools/node}"
mkdir -p "$DEST"

if [ -x "$DEST/bin/node" ]; then
  existing="$($DEST/bin/node -v 2>/dev/null || true)"
  if [ "$existing" = "$VER" ]; then
    echo "Node $existing already installed at $DEST"
    exit 0
  fi
fi

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH=x64 ;;
  arm64|aarch64) ARCH=arm64 ;;
  *) echo "Unsupported arch: $ARCH"; exit 1 ;;
esac
case "$OS" in
  linux) PKG="node-${VER}-linux-${ARCH}.tar.xz" ;;
  darwin) PKG="node-${VER}-darwin-${ARCH}.tar.xz" ;;
  *) echo "Unsupported OS: $OS"; exit 1 ;;
esac
URL="https://nodejs.org/dist/${VER}/${PKG}"
tmpfile="$(mktemp /tmp/node.XXXXXX)"
echo "Downloading $URL"
curl -fsSL "$URL" -o "$tmpfile"
tar -xf "$tmpfile" -C "$DEST" --strip-components=1
rm -f "$tmpfile"
echo "Installed node → $DEST (node --version: $("$DEST/bin/node" -v))"
