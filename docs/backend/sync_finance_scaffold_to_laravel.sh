#!/usr/bin/env bash
set -euo pipefail

# Sync finance parity scaffold from Menu_React docs into Laravel backend.
#
# Usage:
#   bash docs/backend/sync_finance_scaffold_to_laravel.sh
#   bash docs/backend/sync_finance_scaffold_to_laravel.sh /abs/path/to/Menu_API

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REACT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEFAULT_BACKEND_ROOT="$(cd "${REACT_ROOT}/../Menu_API" && pwd)"
BACKEND_ROOT="${1:-$DEFAULT_BACKEND_ROOT}"

if [[ ! -d "${BACKEND_ROOT}" ]]; then
  echo "Backend path not found: ${BACKEND_ROOT}" >&2
  exit 1
fi

if [[ ! -f "${BACKEND_ROOT}/artisan" ]]; then
  echo "Target does not look like a Laravel repo (missing artisan): ${BACKEND_ROOT}" >&2
  exit 1
fi

echo "Using backend: ${BACKEND_ROOT}"

mkdir -p "${BACKEND_ROOT}/app/Domain/Finance/Contracts"
mkdir -p "${BACKEND_ROOT}/app/Domain/Finance/DTO"
mkdir -p "${BACKEND_ROOT}/tests/Feature/Finance"
mkdir -p "${BACKEND_ROOT}/tests/Fixtures"

cp "${REACT_ROOT}/docs/backend/Contracts/FinanceCalculatorContract.php.example" \
  "${BACKEND_ROOT}/app/Domain/Finance/Contracts/FinanceCalculatorContract.php"

cp "${REACT_ROOT}/docs/backend/DTO/InvoicePreviewDTO.php.example" \
  "${BACKEND_ROOT}/app/Domain/Finance/DTO/InvoicePreviewDTO.php"

cp "${REACT_ROOT}/docs/backend/DTO/CashSettlementDTO.php.example" \
  "${BACKEND_ROOT}/app/Domain/Finance/DTO/CashSettlementDTO.php"

cp "${REACT_ROOT}/docs/backend/FinanceCalculator.php.example" \
  "${BACKEND_ROOT}/app/Domain/Finance/FinanceCalculator.php"

cp "${REACT_ROOT}/docs/backend/FinanceParityTest.php.example" \
  "${BACKEND_ROOT}/tests/Feature/Finance/FinanceParityTest.php"

cp "${REACT_ROOT}/tests/unit/fixtures/financeBackendParity.json" \
  "${BACKEND_ROOT}/tests/Fixtures/financeBackendParity.json"

cp "${REACT_ROOT}/docs/backend/FinanceServiceProviderSnippet.php.example" \
  "${BACKEND_ROOT}/app/Providers/FinanceServiceProvider.php"

echo ""
echo "Sync complete."
echo ""
echo "Next steps in backend:"
echo "1) Register provider:"
echo "   - Add App\\Providers\\FinanceServiceProvider::class to bootstrap/providers.php (Laravel 11+)"
echo "     or config/app.php providers array (older Laravel versions)."
echo "2) Run syntax checks:"
echo "   php -l app/Domain/Finance/FinanceCalculator.php"
echo "   php -l tests/Feature/Finance/FinanceParityTest.php"
echo "3) Run parity test:"
echo "   php artisan test --filter=FinanceParityTest"
echo ""
echo "Copied files:"
echo "  - app/Domain/Finance/Contracts/FinanceCalculatorContract.php"
echo "  - app/Domain/Finance/DTO/InvoicePreviewDTO.php"
echo "  - app/Domain/Finance/DTO/CashSettlementDTO.php"
echo "  - app/Domain/Finance/FinanceCalculator.php"
echo "  - app/Providers/FinanceServiceProvider.php"
echo "  - tests/Feature/Finance/FinanceParityTest.php"
echo "  - tests/Fixtures/financeBackendParity.json"

