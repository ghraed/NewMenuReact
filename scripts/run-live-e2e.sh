#!/usr/bin/env bash
set -euo pipefail
react_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
api_root="${E2E_API_ROOT:-$(dirname "${react_root}")/Menu_API}"
if [[ ! -f "${api_root}/scripts/qa/run.py" ]]; then
  echo 'The paired guarded QA runner is required.' >&2
  exit 2
fi
# Retired runner overrides must not silently select a normal application/database.
if [[ -n "${E2E_API_URL:-}" || -n "${PLAYWRIGHT_BASE_URL:-}" || -n "${E2E_LIVE:-}" ]]; then
  echo 'Remove legacy runtime overrides. This command creates its own disposable runtime.' >&2
  exit 2
fi
qa_run_id="legacy_live_$(date -u +%Y%m%d%H%M%S)_$$"
qa_evidence="${E2E_EVIDENCE_DIR:-/tmp/menu-${qa_run_id}}"
exec python3 "${api_root}/scripts/qa/run.py" --launch --browser-matrix --browser-only \
  --react-root "${react_root}" --run-id "${qa_run_id}" --evidence "${qa_evidence}"
