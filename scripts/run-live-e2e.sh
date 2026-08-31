#!/usr/bin/env bash
set -euo pipefail

react_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
api_root="${E2E_API_ROOT:-/tmp/menu-release-hardening/e2e-api}"
export E2E_RUN_ID="${E2E_RUN_ID:-QA_RUN_$(date -u +%Y%m%d%H%M%S)_$$}"
export E2E_LIVE=1
export E2E_API_URL="${E2E_API_URL:-http://127.0.0.1:8001/api}"
export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:5174}"

parse_loopback_url() {
  local candidate="$1"
  local expected_path="$2"
  if [[ ! "${candidate}" =~ ^http://(127\.0\.0\.1|localhost):([0-9]+)${expected_path}$ ]]; then
    echo "Refusing live E2E against non-loopback or malformed URL: ${candidate}" >&2
    return 1
  fi
  printf '%s %s\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
}

read -r api_host api_port < <(parse_loopback_url "${E2E_API_URL}" '/api')
read -r vite_host vite_port < <(parse_loopback_url "${PLAYWRIGHT_BASE_URL}" '')

if [[ ! -f "${api_root}/artisan" || ! -f "${react_root}/playwright.live.config.ts" ]]; then
  echo "E2E worktrees were not found." >&2
  exit 2
fi

port_is_occupied() {
  ss -H -ltn "sport = :$1" 2>/dev/null | grep -q .
}

for port in "${api_port}" "${vite_port}"; do
  if port_is_occupied "${port}"; then
    echo "Refusing to reuse occupied local port ${port}." >&2
    exit 2
  fi
done

api_log="/tmp/${E2E_RUN_ID}_api.log"
vite_log="/tmp/${E2E_RUN_ID}_vite.log"
api_pid=""
vite_pid=""
fixture_setup=0
cleanup_status=0

terminate_group() {
  local pid="$1"
  [[ -z "${pid}" ]] && return 0
  if kill -0 "${pid}" 2>/dev/null; then
    kill -TERM -- "-${pid}" 2>/dev/null || return 1
    for _ in $(seq 1 40); do
      kill -0 "${pid}" 2>/dev/null || break
      sleep 0.1
    done
    if kill -0 "${pid}" 2>/dev/null; then
      kill -KILL -- "-${pid}" 2>/dev/null || return 1
    fi
  fi
  wait "${pid}" 2>/dev/null || true
}

cleanup() {
  local run_status=$?
  trap - EXIT INT TERM

  terminate_group "${vite_pid}" || cleanup_status=1
  terminate_group "${api_pid}" || cleanup_status=1

  if [[ ${fixture_setup} -eq 1 ]]; then
    if ! (cd "${api_root}" && APP_ENV=testing php artisan qa:e2e-fixture cleanup --env=testing --run-id="${E2E_RUN_ID}"); then
      echo "Fixture cleanup failed for ${E2E_RUN_ID}." >&2
      cleanup_status=1
    fi
  fi

  for port in "${api_port}" "${vite_port}"; do
    if port_is_occupied "${port}"; then
      echo "Owned process group left port ${port} occupied after cleanup." >&2
      cleanup_status=1
    fi
  done

  if [[ ${run_status} -eq 0 && ${cleanup_status} -eq 0 ]]; then
    rm -f "${api_log}" "${vite_log}"
    rm -rf "${react_root}/test-results/live" "${react_root}/playwright-report-live"
  fi

  if [[ ${run_status} -ne 0 ]]; then
    exit "${run_status}"
  fi
  exit "${cleanup_status}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cd "${api_root}"
# Deliberately read-only and before the first migration.
APP_ENV=testing php artisan qa:e2e-fixture guard --env=testing --run-id="${E2E_RUN_ID}"
APP_ENV=testing php artisan migrate --env=testing --force
fixture_setup=1
APP_ENV=testing php artisan qa:e2e-fixture setup --env=testing --run-id="${E2E_RUN_ID}"

setsid bash -c 'cd "$1" && exec env APP_ENV=testing CORS_ALLOWED_ORIGINS="$4" FRONTEND_URL="$4" php artisan serve --env=testing --host="$2" --port="$3"' \
  _ "${api_root}" "${api_host}" "${api_port}" "${PLAYWRIGHT_BASE_URL}" >"${api_log}" 2>&1 &
api_pid=$!
setsid bash -c 'cd "$1" && exec env VITE_API_URL=/api VITE_PROXY_TARGET="$2" npm run dev -- --host "$3" --port "$4" --strictPort' \
  _ "${react_root}" "http://${api_host}:${api_port}" "${vite_host}" "${vite_port}" >"${vite_log}" 2>&1 &
vite_pid=$!

for _ in $(seq 1 60); do
  if kill -0 "${api_pid}" 2>/dev/null \
    && kill -0 "${vite_pid}" 2>/dev/null \
    && curl -fsS "http://${api_host}:${api_port}/up" | grep -q 'Application up' \
    && curl -fsS "${PLAYWRIGHT_BASE_URL}" | grep -q '/src/main.tsx'; then
    break
  fi
  sleep 1
done

kill -0 "${api_pid}" 2>/dev/null || { tail -n 80 "${api_log}" >&2; exit 1; }
kill -0 "${vite_pid}" 2>/dev/null || { tail -n 80 "${vite_log}" >&2; exit 1; }
ps -p "${api_pid}" -o args= | grep -q 'artisan serve' || { echo 'API PID identity check failed.' >&2; exit 1; }
ps -p "${vite_pid}" -o args= | grep -q 'npm run dev' || { echo 'Vite PID identity check failed.' >&2; exit 1; }
curl -fsS "http://${api_host}:${api_port}/up" | grep -q 'Application up' || { tail -n 80 "${api_log}" >&2; exit 1; }
curl -fsS "${PLAYWRIGHT_BASE_URL}" | grep -q '/src/main.tsx' || { tail -n 80 "${vite_log}" >&2; exit 1; }

cd "${react_root}"
npx playwright test --config=playwright.live.config.ts
cd "${api_root}"
APP_ENV=testing php artisan qa:e2e-fixture verify --env=testing --run-id="${E2E_RUN_ID}"
