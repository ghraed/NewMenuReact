#!/usr/bin/env bash
set -euo pipefail

react_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
api_root="${E2E_API_ROOT:-/tmp/menu-release-hardening/e2e-api}"
export E2E_RUN_ID="${E2E_RUN_ID:-QA_RUN_$(date -u +%Y%m%d%H%M%S)_$$}"
export E2E_LIVE=1
export E2E_API_URL="${E2E_API_URL:-http://127.0.0.1:8001/api}"
export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:5174}"

for candidate in "${E2E_API_URL}" "${PLAYWRIGHT_BASE_URL}"; do
  case "${candidate}" in
    http://127.0.0.1:*|http://localhost:*) ;;
    *) echo "Refusing live E2E against non-loopback URL: ${candidate}" >&2; exit 2 ;;
  esac
done

if [[ ! -f "${api_root}/artisan" || ! -f "${react_root}/playwright.live.config.ts" ]]; then
  echo "E2E worktrees were not found." >&2
  exit 2
fi

api_log="/tmp/${E2E_RUN_ID}_api.log"
vite_log="/tmp/${E2E_RUN_ID}_vite.log"
api_pid=""
vite_pid=""

cleanup() {
  status=$?
  if [[ -n "${vite_pid}" ]]; then kill "${vite_pid}" 2>/dev/null || true; fi
  if [[ -n "${api_pid}" ]]; then kill "${api_pid}" 2>/dev/null || true; fi
  APP_ENV=testing php "${api_root}/artisan" qa:e2e-fixture cleanup --env=testing --run-id="${E2E_RUN_ID}" >/dev/null 2>&1 || true
  if [[ ${status} -eq 0 ]]; then rm -f "${api_log}" "${vite_log}"; fi
  exit "${status}"
}
trap cleanup EXIT INT TERM

APP_ENV=testing php "${api_root}/artisan" migrate --env=testing --force
APP_ENV=testing php "${api_root}/artisan" qa:e2e-fixture setup --env=testing --run-id="${E2E_RUN_ID}"

(cd "${api_root}" && APP_ENV=testing php artisan serve --env=testing --host=127.0.0.1 --port=8001) >"${api_log}" 2>&1 &
api_pid=$!
(cd "${react_root}" && VITE_API_URL="${E2E_API_URL}" npm run dev -- --host 127.0.0.1 --port 5174 --strictPort) >"${vite_log}" 2>&1 &
vite_pid=$!

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:8001/up" >/dev/null 2>&1 && curl -fsS "${PLAYWRIGHT_BASE_URL}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS "http://127.0.0.1:8001/up" >/dev/null || { tail -n 80 "${api_log}" >&2; exit 1; }
curl -fsS "${PLAYWRIGHT_BASE_URL}" >/dev/null || { tail -n 80 "${vite_log}" >&2; exit 1; }

cd "${react_root}"
npx playwright test --config=playwright.live.config.ts
APP_ENV=testing php "${api_root}/artisan" qa:e2e-fixture verify --env=testing --run-id="${E2E_RUN_ID}"
