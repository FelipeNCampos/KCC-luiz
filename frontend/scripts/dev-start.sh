#!/bin/sh
set -eu

LOCKFILE="package-lock.json"
STAMP_FILE="node_modules/.package-lock.sha256"

current_checksum() {
  sha256sum "$LOCKFILE" | awk '{print $1}'
}

needs_install="false"

if [ ! -d node_modules ]; then
  needs_install="true"
elif [ ! -f "$STAMP_FILE" ]; then
  needs_install="true"
else
  installed_checksum="$(cat "$STAMP_FILE")"
  if [ "$(current_checksum)" != "$installed_checksum" ]; then
    needs_install="true"
  fi
fi

if [ "$needs_install" = "true" ]; then
  echo "Syncing frontend dependencies with $LOCKFILE..."
  npm ci || npm install
  mkdir -p node_modules
  current_checksum > "$STAMP_FILE"
fi

exec npm run dev -- --host 0.0.0.0
