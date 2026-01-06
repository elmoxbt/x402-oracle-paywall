<div align="center">

# x402 Paywalled Oracle

**Pay-per-query oracle API powered by Solana x402 + Pyth Network**

[![Solana](https://img.shields.io/badge/Solana-Devnet-14F195?logo=solana&logoColor=white)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Pyth Network](https://img.shields.io/badge/Pyth-Oracle-7C3AED?logo=pyth)](https://pyth.network)
[![x402](https://img.shields.io/badge/x402-Protocol-FF6B6B)](https://github.com/x402-protocol)

Real-time BTC/USD, ETH/USD, and SOL/USD prices behind a payment wall. Clients pay micro-USDC on-chain to access fresh oracle data. Production-ready TypeScript implementation with automated payment flows.

</div>

---

## What This Does

A Node.js/Express API that monetizes Pyth oracle prices using Solana's x402 payment protocol:

- **Client requests price** → Server returns `402 Payment Required`
- **Client sends USDC payment** → On-chain transaction on devnet
- **Client retries with proof** → Server verifies payment and returns live price data

Built for DePIN, RWA, and oracle infrastructure projects. Demonstrates full-stack Web3 payment integration with real on-chain verification.

---

## Quickstart

### 1. Install & Configure

```bash
git clone x402-oracle-paywall
cd x402-oracle-paywall
npm install
cp .env.example .env
```

Edit `.env` and set your recipient wallet:
```env
RECIPIENT_WALLET=your_solana_wallet_address_here
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

| Feature | Description |
|---------|-------------|
| **Real-time Prices** | BTC/USD, ETH/USD, SOL/USD from Pyth Hermes |
| **x402 Protocol** | HTTP 402 payment wall with Solana integration |
| **USDC Payments** | Micro-payments on devnet (100k micro-USDC = $0.10) |
| **On-chain Verification** | Server validates transactions before serving data |
| **Auto Token Accounts** | Client creates recipient ATA if needed |
| **Full TypeScript** | Type-safe server, oracle module, and demo client |

---

## Tech Stack

```
Backend:     Node.js + Express
Oracle:      Pyth Network (Hermes Client)
Payments:    x402-solana SDK
Blockchain:  Solana Web3.js + SPL Token
Language:    TypeScript
Network:     Solana Devnet
```

**Key Dependencies:**
- `@pythnetwork/hermes-client` - Pyth price feeds
- `x402-solana` - Payment protocol SDK
- `@solana/web3.js` + `@solana/spl-token` - Solana interactions
- `express` - HTTP server
- `axios` - Client HTTP requests

---

## How It Works

### x402 Payment Flow

1. **Initial Request (No Payment)**
   ```bash
   GET /api/price/btc-usd
   → 402 Payment Required + payment details
   ```

2. **Client Sends Payment**
   - Creates USDC transfer transaction
   - Auto-creates recipient ATA if needed
   - Submits to Solana devnet

3. **Retry with Proof**
   ```bash
   GET /api/price/btc-usd
   Headers: X-Solana-Payment: signature=<tx>,amount=100000,...
   → 200 OK + live price data
   ```

4. **Server Verification**
   - Checks transaction exists on-chain
   - Validates amount, mint, recipient
   - Serves data only on valid payment
```

## Troubleshooting

**"Insufficient SOL balance"**
```bash
solana airdrop 2 --url devnet
```

**"USDC token account not found"**
```bash
spl-token create-account 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --owner <WALLET_PUBLIC_KEY>
```

**"Transaction simulation failed: Error 0x1"**
- Insufficient USDC for payment (get devnet USDC)
- Insufficient SOL for token account rent (~0.002 SOL)

**"RECIPIENT_WALLET not set"**
- Edit `.env` file with your wallet address
- Restart server

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
