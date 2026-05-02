#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# Deploy the BI Excellence Dashboard via Databricks Asset Bundles.
#
# All configuration is read from databricks.yml — no --var flags needed.
#
# Prerequisites:
#   1. Databricks CLI >= 0.250.0  (databricks -v)
#   2. CLI profile configured     (databricks configure --profile <name>)
#   3. Fill in your values in databricks.yml (app_slug, team_name, targets)
#
# Usage:
#   ./deploy-databricks.sh              # deploys to "dev" (default)
#   ./deploy-databricks.sh prod         # deploys to "prod"
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colors & helpers ──────────────────────────────────────────────────

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
DIM="\033[2m"
RESET="\033[0m"

DEPLOY_START=$(date +%s)

step_num=0
step() {
  step_num=$((step_num + 1))
  local ts
  ts=$(date "+%H:%M:%S")
  echo ""
  echo -e "${CYAN}${BOLD}[${ts}] Step ${step_num}: $1${RESET}"
  echo -e "${DIM}$(printf '%.0s─' {1..60})${RESET}"
}

ok() {
  echo -e "  ${GREEN}✔ $1${RESET}"
}

warn() {
  echo -e "  ${YELLOW}⚠ $1${RESET}"
}

fail() {
  echo -e "  ${RED}✖ $1${RESET}"
}

elapsed() {
  local end
  end=$(date +%s)
  local diff=$((end - DEPLOY_START))
  local mins=$((diff / 60))
  local secs=$((diff % 60))
  echo -e "${DIM}  (elapsed: ${mins}m ${secs}s)${RESET}"
}

# ── Arguments ─────────────────────────────────────────────────────────

TARGET="${1:-dev}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"

# ── Read app_slug from databricks.yml ─────────────────────────────────

APP_SLUG=$(grep -A5 '^ *app_slug:' databricks.yml | grep 'default:' | head -1 | sed 's/.*default: *"\([^"]*\)".*/\1/' | tr -d '[:space:]') || true
if [ -z "${APP_SLUG}" ]; then
  APP_SLUG="bi-excellence"
fi
APP_NAME="${APP_SLUG}-${TARGET}"

# ── Banner ────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  BI Excellence Suite — Databricks Deployment${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════${RESET}"
echo -e "  Target       : ${CYAN}${TARGET}${RESET}"
echo -e "  App name     : ${CYAN}${APP_NAME}${RESET}"
echo -e "  Config       : ${CYAN}databricks.yml → targets.${TARGET}${RESET}"
echo -e "  Started at   : ${DIM}$(date "+%Y-%m-%d %H:%M:%S")${RESET}"
echo -e "${DIM}──────────────────────────────────────────────────────────${RESET}"

# ── Step 1: Pre-flight checks ────────────────────────────────────────

step "Pre-flight checks"

if ! command -v databricks &>/dev/null; then
  fail "Databricks CLI not found. Install: https://docs.databricks.com/en/dev-tools/cli/install.html"
  exit 1
fi

CLI_VERSION=$(databricks -v 2>/dev/null | head -1)
ok "Databricks CLI: ${CLI_VERSION}"

if [ ! -f "databricks.yml" ]; then
  fail "databricks.yml not found in ${SCRIPT_DIR}"
  exit 1
fi
ok "Bundle config found: databricks.yml"
ok "App slug: ${APP_SLUG} (from databricks.yml)"
ok "Reading all variables from databricks.yml → targets.${TARGET}"

elapsed

# ── Step 2: Validate bundle ──────────────────────────────────────────

step "Validating bundle configuration"

if databricks bundle validate -t "${TARGET}" 2>&1; then
  ok "Bundle validation passed"
else
  fail "Bundle validation failed — check the errors above"
  exit 1
fi

elapsed

# ── Step 3: Deploy bundle ────────────────────────────────────────────

step "Deploying bundle to Databricks (target: ${TARGET})"

echo -e "  ${DIM}Uploading source code and configuring the app resource...${RESET}"

if databricks bundle deploy -t "${TARGET}" 2>&1; then
  ok "Bundle deployed successfully"
else
  fail "Bundle deployment failed"
  exit 1
fi

elapsed

# ── Step 4: Start / restart the app ──────────────────────────────────

step "Starting the app"

echo -e "  ${DIM}This triggers: npm install → npm run build → uvicorn startup${RESET}"
echo -e "  ${DIM}The app will create metadata Delta tables on first boot${RESET}"

if databricks bundle run bi_dashboard -t "${TARGET}" 2>&1; then
  ok "App started successfully"
else
  warn "App run command returned non-zero — check the Databricks Apps UI for status"
fi

elapsed

# ── Summary ───────────────────────────────────────────────────────────

DEPLOY_END=$(date +%s)
TOTAL=$((DEPLOY_END - DEPLOY_START))
TOTAL_MINS=$((TOTAL / 60))
TOTAL_SECS=$((TOTAL % 60))

echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  Deployment complete!${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════${RESET}"
echo -e "  Target       : ${CYAN}${TARGET}${RESET}"
echo -e "  App name     : ${CYAN}${APP_NAME}${RESET}"
echo -e "  Total time   : ${CYAN}${TOTAL_MINS}m ${TOTAL_SECS}s${RESET}"
echo -e "  Finished at  : ${DIM}$(date "+%Y-%m-%d %H:%M:%S")${RESET}"
echo ""
echo -e "  ${DIM}What happens on first startup:${RESET}"
echo -e "  ${DIM}  1. Frontend is built (npm install + npm run build)${RESET}"
echo -e "  ${DIM}  2. Backend starts (uvicorn)${RESET}"
echo -e "  ${DIM}  3. Metadata Delta tables are auto-created${RESET}"
echo ""
echo -e "  ${BOLD}Next steps:${RESET}"
echo -e "    • Check the app URL in the Databricks Apps UI"
echo -e "    • View app logs:  databricks apps get-logs ${APP_NAME}"
echo ""
