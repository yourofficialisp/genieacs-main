#!/bin/bash
# ============================================================
#  UPDATE - GenieACS Customer Portal
#  For Ubuntu / Armbian
#  Use this script to update application without resetting configuration
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}     UPDATE GENIEACS CUSTOMER PORTAL             ${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}[WARN]${NC} Run with: ${BOLD}sudo bash update.sh${NC}"
  exit 1
fi

cd "$SCRIPT_DIR"

# Backup settings.json before update
echo -e "${BLUE}[INFO]${NC} Backup settings.json..."
cp settings.json settings.json.bak
echo -e "${GREEN}[OK]${NC} Backup saved to settings.json.bak"

# Update dependencies
echo -e "${BLUE}[INFO]${NC} Update npm dependencies..."
npm install --production --silent
echo -e "${GREEN}[OK]${NC} Dependencies updated."

# Restart application
echo -e "${BLUE}[INFO]${NC} Restart application..."
pm2 restart app-customer
echo -e "${GREEN}[OK]${NC} Application successfully restarted."

# Display status
pm2 status app-customer

echo ""
echo -e "${GREEN}${BOLD}Update completed!${NC}"
echo -e "Old configuration saved to: ${YELLOW}settings.json.bak${NC}"
echo ""
