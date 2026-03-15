#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${HOST:-localhost}"
PORT="${PORT:-4173}"
BASE_PATH="${BASE_PATH:-/kings_wood/}"
ARTIFACT_ROOT="${OUT_DIR:-$ROOT_DIR/.artifacts/playwright-review}"
RUNS_DIR="$ARTIFACT_ROOT/runs"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="$RUNS_DIR/$RUN_ID"
LATEST_DIR="$ARTIFACT_ROOT/latest"
PREVIEW_LOG="$RUN_DIR/preview.log"

cleanup() {
  if [[ -n "${PREVIEW_PID:-}" ]]; then
    kill "$PREVIEW_PID" 2>/dev/null || true
    wait "$PREVIEW_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

mkdir -p "$ARTIFACT_ROOT"
mkdir -p "$RUN_DIR"

cd "$ROOT_DIR"
pnpm build
pnpm preview --host "$HOST" --port "$PORT" >"$PREVIEW_LOG" 2>&1 &
PREVIEW_PID=$!

for _ in $(seq 1 30); do
  if curl -fsS "http://$HOST:$PORT$BASE_PATH" >/dev/null; then
    break
  fi
  sleep 1
done

node scripts/playwright-review-loop.mjs "http://$HOST:$PORT$BASE_PATH" --out "$RUN_DIR"

rm -rf "$LATEST_DIR"
ln -s "$RUN_DIR" "$LATEST_DIR"

echo "Artifacts saved in $RUN_DIR"
echo "Latest alias: $LATEST_DIR"
