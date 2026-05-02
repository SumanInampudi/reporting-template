#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# Deploy the BI Excellence Dashboard via Databricks Asset Bundles.
# Replace with a Jenkins pipeline when CI/CD is set up.
#
# Prerequisites:
#   1. Databricks CLI >= 0.250.0  (databricks -v)
#   2. CLI profile configured     (databricks configure --profile <name>)
#
# Usage:
#   ./deploy.sh <warehouse-id> [target]
#
# Examples:
#   ./deploy.sh abc123def456          # deploys to "dev" (default)
#   ./deploy.sh abc123def456 prod     # deploys to "prod"
#
# Additional variables can be passed via env:
#   CATALOG=my_catalog SCHEMA=my_schema ./deploy.sh abc123def456
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

WAREHOUSE_ID="${1:?Usage: ./deploy.sh <warehouse-id> [target]}"
TARGET="${2:-dev}"
CATALOG="${CATALOG:-main}"
SCHEMA="${SCHEMA:-default}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"

echo "==> BI Excellence Dashboard — Databricks Bundle Deploy"
echo "    Target       : ${TARGET}"
echo "    Warehouse ID : ${WAREHOUSE_ID}"
echo "    Catalog      : ${CATALOG}"
echo "    Schema       : ${SCHEMA}"
echo ""

echo "==> Validating bundle..."
databricks bundle validate -t "${TARGET}" \
  --var "warehouse_id=${WAREHOUSE_ID}" \
  --var "catalog=${CATALOG}" \
  --var "schema=${SCHEMA}"

echo ""
echo "==> Deploying bundle..."
databricks bundle deploy -t "${TARGET}" \
  --var "warehouse_id=${WAREHOUSE_ID}" \
  --var "catalog=${CATALOG}" \
  --var "schema=${SCHEMA}"

echo ""
echo "==> Starting app..."
databricks bundle run bi_dashboard -t "${TARGET}" \
  --var "warehouse_id=${WAREHOUSE_ID}" \
  --var "catalog=${CATALOG}" \
  --var "schema=${SCHEMA}"

echo ""
echo "==> Done. Check the app URL in the output above or in the Databricks Apps UI."
