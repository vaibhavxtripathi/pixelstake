#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}  ██████╗ ██╗██╗  ██╗███████╗██╗     ${NC}"
echo -e "${CYAN}  ██╔══██╗██║╚██╗██╔╝██╔════╝██║     ${NC}"
echo -e "${CYAN}  ██████╔╝██║ ╚███╔╝ █████╗  ██║     ${NC}"
echo -e "${CYAN}  ██╔═══╝ ██║ ██╔██╗ ██╔══╝  ██║     ${NC}"
echo -e "${CYAN}  ██║     ██║██╔╝ ██╗███████╗███████╗${NC}"
echo -e "${CYAN}  ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝${NC}"
echo -e "${CYAN}  PIXELSTAKE — Deploy${NC}"
echo ""

echo -e "${YELLOW}[1/5] Generating testnet identity...${NC}"
stellar keys generate --global deployer --network testnet 2>/dev/null || true
stellar keys fund deployer --network testnet
DEPLOYER_ADDR=$(stellar keys address deployer)
echo -e "${GREEN}✓ Deployer: ${DEPLOYER_ADDR}${NC}"

echo -e "${YELLOW}[2/5] Building contract WASM...${NC}"
cd contract
cargo build --target wasm32-unknown-unknown --release
WASM="target/wasm32-unknown-unknown/release/pixelstake.wasm"
echo -e "${GREEN}✓ Built${NC}"
cd ..

echo -e "${YELLOW}[3/5] Uploading WASM...${NC}"
WASM_HASH=$(stellar contract upload \
  --network testnet \
  --source deployer \
  --wasm contract/${WASM})
echo -e "${GREEN}✓ WASM Hash: ${WASM_HASH}${NC}"

echo -e "${YELLOW}[4/5] Deploying contract...${NC}"
CONTRACT_ID=$(stellar contract deploy \
  --network testnet \
  --source deployer \
  --wasm-hash ${WASM_HASH})
echo -e "${GREEN}✓ CONTRACT_ID: ${CONTRACT_ID}${NC}"

echo -e "${YELLOW}[5/5] Painting proof pixel (0,0) neon green...${NC}"
TX_RESULT=$(stellar contract invoke \
  --network testnet \
  --source deployer \
  --id ${CONTRACT_ID} \
  -- \
  paint_pixel \
  --painter ${DEPLOYER_ADDR} \
  --x 0 \
  --y 0 \
  --color 4259840 2>&1)   # 0x40FF00 = neon green

TX_HASH=$(echo "$TX_RESULT" | grep -oP '[0-9a-f]{64}' | head -1)
echo -e "${GREEN}✓ Proof TX: ${TX_HASH}${NC}"

cat > frontend/.env << EOF
VITE_CONTRACT_ID=${CONTRACT_ID}
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
EOF

echo ""
echo -e "${CYAN}┌────────────────────────────────────────────────────────┐${NC}"
echo -e "${CYAN}│                 DEPLOYMENT COMPLETE                   │${NC}"
echo -e "${CYAN}├────────────────────────────────────────────────────────┤${NC}"
echo -e "${CYAN}│${NC} Contract : ${GREEN}${CONTRACT_ID}${NC}"
echo -e "${CYAN}│${NC} Proof TX : ${GREEN}${TX_HASH}${NC}"
echo -e "${CYAN}│${NC} Explorer : ${GREEN}https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}${NC}"
echo -e "${CYAN}└────────────────────────────────────────────────────────┘${NC}"
echo ""
echo "Next: cd frontend && npm install && npm run dev"
