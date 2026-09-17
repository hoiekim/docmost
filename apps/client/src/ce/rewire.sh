#!/usr/bin/env sh
# Normalise the open-source core's enterprise imports for this fork. Run after
# rebasing onto upstream. Idempotent.
#
# Two rewrites:
#
#   1. Relative imports into ee/ (e.g. "../../../ee/ai/hooks/use-ai-search.ts")
#      become "@/ee/..." so the build-time alias can redirect them to
#      ce/ee-stub. Upstream writes a couple of these by hand.
#   2. "@/ee/base/" becomes "@/ce/base/", because the bases UI is a real
#      implementation in this fork rather than a stub.
#
# Everything else under "@/ee/" is left alone: vite.config.ts and
# tsconfig.json alias it to ce/ee-stub, so those imports resolve without
# touching an open-source file.
set -eu

cd "$(dirname "$0")/.."   # apps/client/src

oss_files() {
  grep -rl --include='*.ts' --include='*.tsx' "$1" . \
    | grep -v '^\./ee/' | grep -v '^\./ce/' || true
}

# BSD and GNU sed differ on -i; write through a temp file instead.
rewrite() {
  sed "$2" "$1" > "$1.rewire.tmp" && mv "$1.rewire.tmp" "$1"
}

touched=0

for f in $(oss_files '\.\./ee/'); do
  # ../ee/x, ../../ee/x, ../../../ee/x … all become @/ee/x
  rewrite "$f" 's#\(["'\'']\)\(\.\./\)\{1,\}ee/#\1@/ee/#g'
  echo "rewire: $f (relative ee import -> @/ee/)"
  touched=1
done

for f in $(oss_files '@/ee/base/'); do
  rewrite "$f" 's#@/ee/base/#@/ce/base/#g'
  echo "rewire: $f (@/ee/base -> @/ce/base)"
  touched=1
done

if [ "$touched" -eq 0 ]; then
  echo "rewire: nothing to do"
  exit 0
fi

echo "rewire: done. Run tsc; a missing symbol means ce/base or ce/ee-stub"
echo "        needs to provide it."
