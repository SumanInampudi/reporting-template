#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# Local development helper for BI Excellence Dashboard.
#
# Usage:
#   ./dev.sh              # kill → build frontend → start backend + frontend
#   ./dev.sh build        # kill → rebuild frontend only (no servers)
#   ./dev.sh restart      # kill → start backend + frontend (skip build)
#   ./dev.sh stop         # kill all running processes
#   ./dev.sh backend      # kill → start backend only
#   ./dev.sh frontend     # kill → start frontend dev server only
#
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/backend"
FRONTEND_DIR="${SCRIPT_DIR}/frontend"
BACKEND_PORT=8000
FRONTEND_PORT=5173

# ── Colors ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[dev]${NC} $*"; }
ok()   { echo -e "${GREEN}[dev]${NC} $*"; }
warn() { echo -e "${YELLOW}[dev]${NC} $*"; }

# ── Stop processes ────────────────────────────────────────────────────
kill_port() {
    local port=$1
    local pids
    pids=$(lsof -ti:"${port}" 2>/dev/null || true)
    if [ -n "${pids}" ]; then
        echo "${pids}" | xargs kill -9 2>/dev/null || true
        log "Killed process(es) on port ${port}"
    fi
}

stop_all() {
    log "Stopping existing processes..."
    kill_port ${BACKEND_PORT}
    kill_port ${FRONTEND_PORT}
    ok "All processes stopped."
}

# ── Build frontend ────────────────────────────────────────────────────
build_frontend() {
    log "Building frontend..."
    cd "${FRONTEND_DIR}"
    npm run build
    ok "Frontend build complete."
}

# ── Start backend ─────────────────────────────────────────────────────
start_backend() {
    log "Starting backend on port ${BACKEND_PORT}..."
    cd "${SCRIPT_DIR}"
    source "${BACKEND_DIR}/.venv/bin/activate"
    uvicorn backend.main:app --reload --port ${BACKEND_PORT} &
    BACKEND_PID=$!
    ok "Backend started (PID ${BACKEND_PID})"
}

# ── Start frontend dev server ─────────────────────────────────────────
start_frontend_dev() {
    log "Starting frontend dev server on port ${FRONTEND_PORT}..."
    cd "${FRONTEND_DIR}"
    npm run dev &
    FRONTEND_PID=$!
    ok "Frontend dev server started (PID ${FRONTEND_PID})"
}

# ── Wait for backend to be ready ──────────────────────────────────────
wait_for_backend() {
    log "Waiting for backend to be ready..."
    for i in $(seq 1 30); do
        if curl -s http://localhost:${BACKEND_PORT}/health > /dev/null 2>&1; then
            ok "Backend is ready!"
            return 0
        fi
        sleep 1
    done
    warn "Backend did not respond within 30s — it may still be starting."
}

# ── Main ──────────────────────────────────────────────────────────────
CMD="${1:-all}"

case "${CMD}" in
    stop)
        stop_all
        ;;
    build)
        stop_all
        build_frontend
        ;;
    restart)
        stop_all
        start_backend
        wait_for_backend
        start_frontend_dev
        echo ""
        ok "Ready!"
        ok "  Backend:  http://localhost:${BACKEND_PORT}"
        ok "  Frontend: http://localhost:${FRONTEND_PORT}"
        echo ""
        wait
        ;;
    backend)
        kill_port ${BACKEND_PORT}
        start_backend
        wait_for_backend
        wait
        ;;
    frontend)
        kill_port ${FRONTEND_PORT}
        start_frontend_dev
        wait
        ;;
    all|"")
        stop_all
        build_frontend
        echo ""
        start_backend
        wait_for_backend
        start_frontend_dev
        echo ""
        ok "Ready!"
        ok "  Backend:  http://localhost:${BACKEND_PORT}"
        ok "  Frontend: http://localhost:${FRONTEND_PORT}"
        echo ""
        wait
        ;;
    *)
        echo "Usage: ./dev.sh [all|build|restart|stop|backend|frontend]"
        exit 1
        ;;
esac
