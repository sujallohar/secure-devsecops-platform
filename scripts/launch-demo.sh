#!/usr/bin/env bash
# ==============================================================================
# SECURE DEVSECOPS PLATFORM — MASTER DEMO LAUNCHER
# ==============================================================================
# Single-entrypoint script for faculty presentation and demonstration.
# Works out-of-the-box on any laptop (macOS, Linux, Windows WSL2).
#
# Usage:
#   ./scripts/launch-demo.sh            # Interactive menu
#   ./scripts/launch-demo.sh --compose  # Launch Docker Compose stack
#   ./scripts/launch-demo.sh --showcase # Open Showcase Web Dashboard
#   ./scripts/launch-demo.sh --attacks  # Run all 5 Phase 19 Attack Demos
#   ./scripts/launch-demo.sh --stop     # Clean up and stop all containers
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_banner() {
  echo -e "${CYAN}"
  echo "╔════════════════════════════════════════════════════════════════════════╗"
  echo "║          SECURE DEVSECOPS PLATFORM — MASTER DEMO LAUNCHER              ║"
  echo "║     Zero-Trust • Multi-Tier Microservices • Runtime IDS • ₹0 Spend    ║"
  echo "╚════════════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

check_docker() {
  if ! docker info &>/dev/null; then
    echo -e "${RED}❌ Docker is not running!${NC}"
    echo "Please start Docker Desktop on this laptop and try again."
    exit 1
  fi
  echo -e "${GREEN}✅ Docker daemon is active and responsive.${NC}"
}

open_url() {
  local URL="$1"
  if command -v open &>/dev/null; then
    open "${URL}" # macOS
  elif command -v xdg-open &>/dev/null; then
    xdg-open "${URL}" # Linux
  elif command -v powershell.exe &>/dev/null; then
    powershell.exe Start "${URL}" # WSL2 Windows
  else
    echo -e "Open your browser to: ${CYAN}${URL}${NC}"
  fi
}

start_compose() {
  print_banner
  check_docker
  echo -e "${YELLOW}>>> Starting Full Microservices Stack via Docker Compose...${NC}"
  echo "Services: PostgreSQL 16 + User Svc + Product Svc + Order Svc + API Gateway + Frontend"
  cd "${PROJECT_ROOT}"

  docker compose -f docker/docker-compose.yml up -d --build

  echo -e "\n${YELLOW}>>> Waiting for containers to become healthy...${NC}"
  sleep 5

  docker compose -f docker/docker-compose.yml ps

  echo -e "\n${GREEN}======================================================================${NC}"
  echo -e "${GREEN}🎉 FULL STACK IS LIVE!${NC}"
  echo -e "  🌐 Frontend Web UI:    ${CYAN}http://localhost:8080${NC}"
  echo -e "  🚪 API Gateway:        ${CYAN}http://localhost:3000${NC}"
  echo -e "  🐘 PostgreSQL DB:      ${CYAN}localhost:5432${NC}"
  echo -e "${GREEN}======================================================================${NC}"

  echo "Opening Frontend in your browser..."
  open_url "http://localhost:8080"
}

stop_compose() {
  print_banner
  echo -e "${YELLOW}>>> Stopping all Docker containers and reclaiming system memory...${NC}"
  cd "${PROJECT_ROOT}"
  if docker compose -f docker/docker-compose.yml ps -q &>/dev/null; then
    docker compose -f docker/docker-compose.yml down
  fi
  echo -e "${GREEN}✅ All containers stopped. Host CPU and RAM are 100% idle.${NC}"
}

open_showcase() {
  print_banner
  echo -e "${GREEN}>>> Opening Interactive Showcase Web Dashboard...${NC}"
  local DASHBOARD_PATH="${PROJECT_ROOT}/showcase/index.html"
  open_url "${DASHBOARD_PATH}"
  echo -e "${CYAN}Showcase Dashboard launched: file://${DASHBOARD_PATH}${NC}"
}

run_attacks() {
  print_banner
  echo -e "${YELLOW}>>> Executing the 5 Controlled Attack Demonstrations (Phase 19)...${NC}"
  bash "${PROJECT_ROOT}/scripts/demo/run-all-demos.sh"
}

interactive_menu() {
  print_banner
  echo -e "Select what you want to present to faculty:\n"
  echo -e "  ${GREEN}1)${NC} 🌐 ${CYAN}Launch Full Live Microservices Stack${NC} (Docker Compose: Frontend + 5 Services + DB)"
  echo -e "  ${GREEN}2)${NC} 📊 ${CYAN}Open Interactive Showcase Web Dashboard${NC} (Instant UI • Topology • Gates)"
  echo -e "  ${GREEN}3)${NC} ⚔️  ${CYAN}Execute 5 Attack Demonstrations${NC} (Phase 19: SCA, Secrets, Trivy, Falco, CNI)"
  echo -e "  ${GREEN}4)${NC} 🛑 ${CYAN}Stop All Running Containers${NC} (Cool down laptop & free memory)"
  echo -e "  ${GREEN}5)${NC} 🚪 Exit\n"

  read -r -p "Enter choice [1-5]: " CHOICE
  case "${CHOICE}" in
    1) start_compose ;;
    2) open_showcase ;;
    3) run_attacks ;;
    4) stop_compose ;;
    5) exit 0 ;;
    *) echo -e "${RED}Invalid option.${NC}"; exit 1 ;;
  esac
}

# Command line argument routing
case "${1:-}" in
  --compose)  start_compose ;;
  --showcase) open_showcase ;;
  --attacks)  run_attacks ;;
  --stop)     stop_compose ;;
  "")         interactive_menu ;;
  *)
    echo "Usage: $0 [--compose | --showcase | --attacks | --stop]"
    exit 1
    ;;
esac
