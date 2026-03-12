# PixelStake ██

> **A 32×32 shared pixel canvas. Every pixel permanently owned on the Stellar blockchain.**

Paint pixels. Own coordinates. Each claim is a real Soroban transaction with your wallet address permanently linked to that pixel. All 1,024 pixels are up for grabs — repaint, reclaim, or leave your mark.

---

## Live Links

| | |
|---|---|
| **Frontend** | `https://pixelstake.vercel.app` _(update after deploy)_ |
| **GitHub Repo** | `https://github.com/YOUR_USERNAME/pixelstake` |
| **Contract on Stellar Expert** | `https://stellar.expert/explorer/testnet/contract/CONTRACT_ID_HERE` |
| **Proof Transaction** | `https://stellar.expert/explorer/testnet/tx/TX_HASH_HERE` |

---

## What Makes This Different

Unlike traditional pixel board games (r/place, PixelMap), every single paint operation is:
- A signed Soroban smart contract invocation
- Verifiable on-chain via Stellar Expert
- Permanently linked to the painter's wallet address
- Queryable by anyone via `get_pixel(x, y)` or `get_region()`

---

## Contract Functions

```rust
// Paint a pixel — requires painter's wallet auth
paint_pixel(painter: Address, x: u32, y: u32, color: u32)

// Read a single pixel
get_pixel(x: u32, y: u32) -> Option<Pixel>

// Batch read a 16×16 region (returns Vec<u32> of RGB colors)
get_region(x_start: u32, y_start: u32, w: u32, h: u32) -> Vec<u32>

// Stats
painted_count() -> u32   // unique pixels ever painted
total_paints()  -> u32   // total paint ops including repaints
grid_size()     -> (u32, u32)  // (32, 32)
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Smart Contract | Rust + Soroban SDK v22 |
| Network | Stellar Testnet |
| Frontend | React 18 + Vite |
| Wallet | Freighter (`@stellar/freighter-api`) |
| RPC | Soroban RPC |
| Hosting | Vercel |

---

## Run Locally

```bash
# Deploy contract (needs Rust + stellar-cli)
chmod +x scripts/deploy.sh && ./scripts/deploy.sh

# Run frontend
cd frontend && npm install && npm run dev
```

---

## Project #2 of 30 — Stellar Hackathon MOU
