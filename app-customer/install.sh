#!/bin/bash
# ============================================================
#  INSTALLER - GenieACS Customer Portal
#  For Ubuntu / Armbian (ARM & x86)
#  Assumption: GenieACS runs on the same server (localhost:7557)
# ============================================================

set -e  # Stop script if there is an error

# ─── Terminal colors ─────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ─── Banner ─────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║     INSTALLER GENIEACS CUSTOMER PORTAL          ║${NC}"
echo -e "${CYAN}${BOLD}║     Ubuntu / Armbian Auto Setup                  ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Detect script directory ───────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR"
echo -e "${BLUE}[INFO]${NC} Application directory: ${BOLD}$APP_DIR${NC}"

# ─── Check root / sudo ────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}[WARN]${NC} This script requires sudo to install Node.js and PM2."
  echo -e "       Run again with: ${BOLD}sudo bash install.sh${NC}"
  echo -e "${YELLOW}[WARN]${NC} This script requires sudo to install Node.js and PM2."
  echo -e "       Run again with: ${BOLD}sudo bash install.sh${NC}"
  exit 1
fi

# ─── STEP 1: Update system ───────────────────────────────────
echo ""
echo -e "${BLUE}[STEP 1/6]${NC} Update package list..."
apt-get update -qq

# ─── STEP 2: Install system dependencies ──────────────────────
echo -e "${BLUE}[STEP 2/6]${NC} Install system dependencies (curl, git)..."
apt-get install -y curl git ca-certificates gnupg -qq

# ─── STEP 3: Check & Install Node.js ──────────────────────────
echo ""
echo -e "${BLUE}[STEP 3/6]${NC} Checking Node.js..."

NODE_REQUIRED=18
NODE_INSTALLED=0

if command -v node &> /dev/null; then
  NODE_VER=$(node -e "console.log(process.versions.node.split('.')[0])")
  if [ "$NODE_VER" -ge "$NODE_REQUIRED" ]; then
    echo -e "${GREEN}[OK]${NC} Node.js v$(node -v) already installed. Skipping installation."
    NODE_INSTALLED=1
  else
    echo -e "${YELLOW}[WARN]${NC} Node.js v$(node -v) is too old (need >= v${NODE_REQUIRED})."
  fi
fi

if [ "$NODE_INSTALLED" -eq 0 ]; then
  echo -e "${BLUE}[INFO]${NC} Installing Node.js v${NODE_REQUIRED} LTS via NodeSource..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_REQUIRED}.x" | bash -
  apt-get install -y nodejs -qq
  echo -e "${GREEN}[OK]${NC} Node.js $(node -v) successfully installed."
fi

# ─── STEP 4: Install PM2 ────────────────────────────────────
echo ""
echo -e "${BLUE}[STEP 4/6]${NC} Checking PM2..."
if command -v pm2 &> /dev/null; then
  echo -e "${GREEN}[OK]${NC} PM2 $(pm2 -v) already installed."
else
  echo -e "${BLUE}[INFO]${NC} Installing PM2..."
  npm install -g pm2 -q
  echo -e "${GREEN}[OK]${NC} PM2 $(pm2 -v) installed successfully."
fi

# ─── STEP 5: Install Node.js application dependencies ────────────
echo ""
echo -e "${BLUE}[STEP 5/6]${NC} Installing application dependencies..."
cd "$APP_DIR"
npm install --production --silent
echo -e "${GREEN}[OK]${NC} Dependencies installed successfully."

# ─── Configure settings.json ──────────────────────────────
echo ""
echo -e "${BLUE}[INFO]${NC} Configuring settings.json..."

# Detect server IP (for access info)
SERVER_IP=$(hostname -I | awk '{print $1}')

# Read existing values (if any)
CURRENT_PORT=$(node -e "try{const s=require('./settings.json');console.log(s.server_port||3001)}catch(e){console.log(3001)}" 2>/dev/null || echo "3001")
CURRENT_COMPANY=$(node -e "try{const s=require('./settings.json');console.log(s.company_header||'ISP Portal')}catch(e){console.log('ISP Portal')}" 2>/dev/null || echo "ISP Portal")

# Rewrite settings.json with GenieACS at localhost
cat > "$APP_DIR/settings.json" << EOF
{
  "genieacs_url": "http://localhost:7557",
  "genieacs_username": "admin",
  "genieacs_password": "admin",
  "company_header": "${CURRENT_COMPANY}",
  "footer_info": "Unlimited Internet",
  "server_port": ${CURRENT_PORT},
  "server_host": "localhost",
  "session_secret": "$(openssl rand -hex 32)"
}
EOF

echo -e "${GREEN}[OK]${NC} settings.json configured (GenieACS: localhost:7557, Port: ${CURRENT_PORT})"
echo -e "${YELLOW}[INFO]${NC} If GenieACS username/password is not 'admin', edit file: ${BOLD}$APP_DIR/settings.json${NC}"

# ─── STEP 6: Run with PM2 ────────────────────────────
echo ""
echo -e "${BLUE}[STEP 6/6]${NC} Running application with PM2..."

# Stop old instance if exists
pm2 delete app-customer 2>/dev/null || true

# Run application
# Run application
pm2 start "$APP_DIR/app-customer.js" \
  --name "app-customer" \
  --log "$APP_DIR/logs/pm2.log" \
  --time \
  -- 

# Save PM2 configuration
pm2 save

# Setup PM2 to auto-start on reboot
pm2 startup systemd -u root --hp /root 2>/dev/null || \
  pm2 startup 2>/dev/null || true

# Open port in firewall if ufw is active
if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow ${CURRENT_PORT}/tcp -qq
  echo -e "${GREEN}[OK]${NC} Firewall port ${CURRENT_PORT} opened."
fi

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║          INSTALLATION SUCCESSFUL!                   ${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Customer Portal can be accessed at:${NC}"
echo -e "  ${CYAN}➜  http://${SERVER_IP}:${CURRENT_PORT}/login${NC}"
echo -e "  ${CYAN}➜  http://localhost:${CURRENT_PORT}/login${NC}"
echo ""
echo -e "  ${BOLD}Available shortcut URLs:${NC}"
echo -e "  ${YELLOW}http://[IP]:${CURRENT_PORT}/login${NC}     → login page (short)"
echo -e "  ${YELLOW}http://[IP]:${CURRENT_PORT}${NC}          → automatic redirect to login"
echo ""
echo -e "  ${BOLD}Useful PM2 commands:${NC}"
echo -e "  ${YELLOW}pm2 status${NC}              → view application status"
echo -e "  ${YELLOW}pm2 logs app-customer${NC}   → view real-time logs"
echo -e "  ${YELLOW}pm2 restart app-customer${NC} → restart application"
echo -e "  ${YELLOW}pm2 stop app-customer${NC}   → stop application"
echo ""
echo -e "  ${BOLD}Edit configuration:${NC} ${YELLOW}nano $APP_DIR/settings.json${NC}"
echo -e "  ${BOLD}After editing, restart:${NC} ${YELLOW}pm2 restart app-customer${NC}"
echo ""
