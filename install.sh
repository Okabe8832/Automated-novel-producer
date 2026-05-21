#!/usr/bin/env bash
set -euo pipefail

INSTALLER_URL="${OPENCODE_NOVEL_INSTALLER_URL:-https://raw.githubusercontent.com/Okabe8832/Automated-novel-producer-release/main/install.mjs}"

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' "Error: node is required to run the installer." >&2
  exit 1
fi

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/opencode-novel-install.XXXXXX")"
tmp_installer="$tmp_dir/install.mjs"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$INSTALLER_URL" -o "$tmp_installer"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$tmp_installer" "$INSTALLER_URL"
else
  printf '%s\n' "Error: curl or wget is required to download the installer." >&2
  exit 1
fi

node "$tmp_installer" "$@"
