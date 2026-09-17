#!/usr/bin/env sh
# Point every open-source import of the enterprise bases UI at the fork's
# implementation. Run after rebasing onto upstream. Idempotent.
set -eu

cd "$(dirname "$0")/.."   # apps/client/src

files=$(grep -rl --include='*.ts' --include='*.tsx' '@/ee/base/' . | grep -v '^\./ee/' | grep -v '^\./ce/' || true)

if [ -z "$files" ]; then
  echo "rewire: nothing to do"
  exit 0
fi

for f in $files; do
  # BSD and GNU sed differ on -i; write through a temp file instead.
  sed 's#@/ee/base/#@/ce/base/#g' "$f" > "$f.rewire.tmp" && mv "$f.rewire.tmp" "$f"
  echo "rewire: $f"
done

echo "rewire: done. Run tsc to find any new symbols ce/base must provide."
