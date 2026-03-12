#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
REPO_NAME="pixelstake"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo -e "${CYAN}[1/3] Creating GitHub repo...${NC}"
gh repo create "${REPO_NAME}" \
  --public \
  --description "PixelStake — A 32×32 on-chain pixel canvas built on Stellar Soroban" \
  --source "${ROOT_DIR}" \
  --remote origin \
  --push

CONTRACT_ID=$(grep VITE_CONTRACT_ID "${ROOT_DIR}/frontend/.env" 2>/dev/null | cut -d= -f2 || echo "")
[ -n "$CONTRACT_ID" ] && gh secret set VITE_CONTRACT_ID --body "${CONTRACT_ID}" \
  --repo "$(gh api user -q .login)/${REPO_NAME}"

echo -e "${CYAN}[2/3] Deploying to Vercel...${NC}"
cd "${ROOT_DIR}/frontend" && vercel --prod --yes

echo -e "${GREEN}✓ Published! Check GitHub + Vercel for live links.${NC}"
