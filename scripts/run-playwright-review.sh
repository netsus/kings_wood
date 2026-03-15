#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-4173}"
BASE_PATH="${BASE_PATH:-/kings_wood/}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/.artifacts/playwright-review}"
PREVIEW_LOG="$OUT_DIR/preview.log"

cleanup() {
  if [[ -n "${PREVIEW_PID:-}" ]]; then
    kill "$PREVIEW_PID" 2>/dev/null || true
    wait "$PREVIEW_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

mkdir -p "$OUT_DIR"

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

node scripts/playwright-review-loop.mjs "http://$HOST:$PORT$BASE_PATH" --out "$OUT_DIR"

echo "Artifacts saved in $OUT_DIR"
