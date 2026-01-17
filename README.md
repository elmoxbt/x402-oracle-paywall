# Pricemaxxer

**Session-based HFT oracle with multi-chain support**

[![Solana](https://img.shields.io/badge/Solana-Devnet%20%7C%20Mainnet-14F195?logo=solana&logoColor=white)](https://solana.com)
[![EVM](https://img.shields.io/badge/EVM-Base%20%7C%20Ethereum%20%7C%20Arbitrum%20%7C%20Polygon%20%7C%20BSC-627EEA)](https://ethereum.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Pyth Network](https://img.shields.io/badge/Pyth-Oracle-7C3AED?logo=pyth)](https://pyth.network)

Real-time BTC/USD, ETH/USD, and SOL/USD prices with session-based payments. Deposit once, query thousands of times at $0.0001 per query. Multi-chain support for Solana and EVM networks.

**Live Demo:** [pricemaxxer.vercel.app](https://pricemaxxer.vercel.app)

---

## What This Does

A multi-chain oracle API with session-based payments for high-frequency trading:

- **Deposit tokens once** → Create a session with thousands of query credits
- **Query prices at HFT speeds** → No per-call payment overhead
- **Multi-chain support** → Solana (devnet/mainnet), Base, Ethereum, Arbitrum, Polygon, BSC
- **Multi-token support** → USDC, USDT, SOL, ETH, MATIC, BNB

Built for DePIN, RWA, and HFT infrastructure. Sessions persist for 24 hours with SQLite storage.

---

## Quickstart

### 1. Install & Configure

```bash
git clone x402-oracle-paywall
cd x402-oracle-paywall
npm install
cp .env.example .env
```

Edit `.env` and set your recipient wallet(s):
```env
# Default wallet for all chains
RECIPIENT_WALLET=your_wallet_address_here

# Optional: Chain-specific wallets
RECIPIENT_WALLET_SOLANA_DEVNET=your_solana_wallet
RECIPIENT_WALLET_BASE=your_base_wallet
```

### 2. Get Devnet Tokens

```bash
# Get SOL for transaction fees
solana airdrop 2 --url devnet

# Get USDC for testing payments
Get USDC solana devnet tokens from:
- https://faucet.circle.com/

### 3. Run

**Terminal 1** - Start server:
```bash
npm run dev
```

**Terminal 2** - Run demo client:
```bash
npm run demo ~/.config/solana/id.json
```

---

## Features

**Real-time Prices** - BTC/USD, ETH/USD, SOL/USD from Pyth Hermes

**Session-Based** - Deposit once, query thousands of times

**Multi-Chain** - Solana, Base, Ethereum, Arbitrum, Polygon, BSC

**Multi-Token** - USDC, USDT, SOL, ETH, MATIC, BNB support

**HFT Optimized** - $0.0001 per query, no per-call payment overhead

**On-chain Verification** - Validates deposits on Solana and EVM chains

**SQLite Persistence** - Sessions survive server restarts

**Full TypeScript** - Type-safe server, oracle module, and demo client

---

## Tech Stack

```
Backend:     Node.js + Express 5
Oracle:      Pyth Network (Hermes Client)
Database:    SQLite (better-sqlite3)
Solana:      @solana/web3.js
EVM:         viem (Base, Ethereum, Arbitrum, Polygon)
Language:    TypeScript
```

**Key Dependencies:**
- `@pythnetwork/hermes-client` - Pyth price feeds
- `@solana/web3.js` - Solana transaction verification
- `viem` - EVM transaction verification
- `better-sqlite3` - Session persistence
- `express` - HTTP server

---

## How It Works

### Session-Based Payment Flow

1. **Get Pricing Info**
   ```bash
   GET /api/pricing/base
   → Returns supported tokens and recipient wallet
   ```

2. **Send Deposit Transaction**
   - Transfer tokens to recipient wallet on your preferred chain
   - Keep the transaction signature/hash

3. **Create Session**
   ```bash
   POST /api/session
   Body: { walletAddress, chain, depositTxSignature, depositAmount, token }
   → Returns sessionId with query credits
   ```

4. **Query Prices (No Payment Overhead)**
   ```bash
   GET /api/price/btc-usd
   Headers: X-Session-Id: <sessionId>
   → 200 OK + live price data
   ```

Credits are calculated as: `depositAmount / 0.0001` (in USD equivalent)

---

## Usage

### Using Live Deployment

**1. Get pricing info:**
```bash
curl https://pricemaxxer.vercel.app/api/pricing/solana-devnet
```

**2. Send tokens to recipient wallet (from response above)**

**3. Create session:**
```bash
curl -X POST https://pricemaxxer.vercel.app/api/session \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "YOUR_WALLET",
    "chain": "solana-devnet",
    "depositTxSignature": "TX_SIGNATURE",
    "depositAmount": 100000,
    "token": "USDC"
  }'
```

**4. Query prices:**
```bash
curl https://pricemaxxer.vercel.app/api/price/btc-usd \
  -H "X-Session-Id: YOUR_SESSION_ID"
```

### HFT Integration

HFT tools can integrate with the REST API.

## API Endpoints

**GET /** - Service info

**GET /api/chains** - List supported chains

**GET /api/pricing/:chain** - Pricing info for chain

**POST /api/session** - Create session

**GET /api/session/:sessionId** - Session status

**GET /api/price/:symbol** - Get price (BTC/ETH/SOL)

**POST /api/prices** - Batch prices

**GET /health** - Health check

## Troubleshooting

**"Session creation failed"**
- Verify deposit transaction is confirmed on-chain
- Check correct chain and token are specified

**"Invalid or expired session"**
- Sessions expire after 24 hours
- Create new session with fresh deposit

**"Transaction already used"**
- Each transaction can only be used once
- Send new deposit to create/extend session

**Solana: "Insufficient SOL balance"**
```bash
solana airdrop 2 --url devnet
```

**Solana: Get devnet USDC**
- https://faucet.circle.com/

---

## Open to Collaboration

This project demonstrates core infrastructure patterns for DePIN and RWA monetization. If you're building in oracles, paid APIs, or Solana payments, feel free to fork or reach out.

Interested in similar work? DM on **X: [https://x.com/elmoxbt]** or open an issue.

---

## License

MIT - See [LICENSE](LICENSE) for details.

---

## Resources

- [Pyth Network Docs](https://docs.pyth.network/)
- [x402 Protocol Spec](https://github.com/x402-protocol)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Hermes Client API](https://github.com/pyth-network/pyth-crosschain)

---

<div align="center">

**Built for the Solana ecosystem**

</div>
