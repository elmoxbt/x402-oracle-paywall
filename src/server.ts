import express, { Request, Response } from 'express';
import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';
import { pythService, SupportedSymbol } from './pyth';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PRICE_PER_QUERY = parseInt(process.env.PRICE_PER_QUERY || '100000');
const RECIPIENT_WALLET = process.env.RECIPIENT_WALLET;
const USDC_MINT = process.env.USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Validate environment
if (!RECIPIENT_WALLET || RECIPIENT_WALLET === 'your_wallet_address_here') {
  console.error('ERROR: RECIPIENT_WALLET not set in .env file');
  console.error('Please copy .env.example to .env and set your wallet address');
  process.exit(1);
}

interface PaymentHeader {
  signature: string;
  amount: number;
  mint: string;
  recipient: string;
  timestamp: number;
}

/**
 * Parse x402 payment header from request
 */
function parsePaymentHeader(req: Request): PaymentHeader | null {
  const paymentHeader = req.headers['x-solana-payment'] as string;

  if (!paymentHeader) {
    return null;
  }

  try {
    const parts = paymentHeader.split(',');
    const headerData: any = {};

    parts.forEach(part => {
      const [key, value] = part.trim().split('=');
      headerData[key] = value;
    });

    return {
      signature: headerData.signature,
      amount: parseInt(headerData.amount),
      mint: headerData.mint,
      recipient: headerData.recipient,
      timestamp: parseInt(headerData.timestamp || '0'),
    };
  } catch (error) {
    console.error('Failed to parse payment header:', error);
    return null;
  }
}

/**
 * Verify payment transaction on-chain
 */
async function verifyPayment(payment: PaymentHeader): Promise<boolean> {
  try {
    // Verify basic payment details
    if (payment.amount < PRICE_PER_QUERY) {
      console.log('Payment amount too low:', payment.amount, 'required:', PRICE_PER_QUERY);
      return false;
    }

    if (payment.mint !== USDC_MINT) {
      console.log('Invalid mint:', payment.mint, 'expected:', USDC_MINT);
      return false;
    }

    if (payment.recipient !== RECIPIENT_WALLET) {
      console.log('Invalid recipient:', payment.recipient, 'expected:', RECIPIENT_WALLET);
      return false;
    }

    // Verify transaction exists on-chain
    const tx = await connection.getTransaction(payment.signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      console.log('Transaction not found:', payment.signature);
      return false;
    }

    console.log('Payment verified:', payment.signature);
    return true;
  } catch (error) {
    console.error('Payment verification error:', error);
    return false;
  }
}

/**
 * Create 402 Payment Required response
 */
function create402Response(res: Response) {
  res.status(402).json({
    error: 'Payment Required',
    message: 'This endpoint requires payment via x402 protocol',
    payment: {
      amount: PRICE_PER_QUERY,
      mint: USDC_MINT,
      recipient: RECIPIENT_WALLET,
      network: 'devnet',
    },
  });
}

/**
 * GET /api/price/:symbol
 * Fetch Pyth oracle price behind x402 paywall
 */
app.get('/api/price/:symbol', async (req: Request, res: Response) => {
  const symbol = req.params.symbol.toLowerCase() as SupportedSymbol;

  // Validate symbol
  if (!pythService.isSupported(symbol)) {
    return res.status(400).json({
      error: 'Invalid symbol',
      message: 'Symbol must be one of: ' + pythService.getSupportedSymbols().join(', '),
    });
  }

  // Check for payment header
  const payment = parsePaymentHeader(req);

  if (!payment) {
    console.log('No payment header found, returning 402');
    return create402Response(res);
  }

  // Verify payment
  const isValid = await verifyPayment(payment);

  if (!isValid) {
    console.log('Payment verification failed');
    return res.status(403).json({
      error: 'Payment Verification Failed',
      message: 'The provided payment could not be verified',
    });
  }

  // Payment verified - fetch and return price
  try {
    console.log('Fetching price for:', symbol);
    const priceData = await pythService.getPrice(symbol);

    res.json({
      success: true,
      data: priceData,
      payment: {
        signature: payment.signature,
        amount: payment.amount,
        verified: true,
      },
    });
  } catch (error) {
    console.error('Error fetching price:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to fetch price data',
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: {
      pricePerQuery: PRICE_PER_QUERY,
      usdcMint: USDC_MINT,
      recipient: RECIPIENT_WALLET,
      supportedSymbols: pythService.getSupportedSymbols(),
    },
  });
});

/**
 * GET /
 * Root endpoint with API info
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'x402 Paywalled Oracle',
    description: 'Pyth oracle prices behind x402 paywall on Solana devnet',
    endpoints: {
      price: '/api/price/:symbol (btc-usd, eth-usd)',
      health: '/health',
    },
    payment: {
      protocol: 'x402',
      amount: PRICE_PER_QUERY,
      mint: USDC_MINT,
      recipient: RECIPIENT_WALLET,
      network: 'devnet',
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('x402 Paywalled Oracle Server');
  console.log('='.repeat(60));
  console.log('Server running on port:', PORT);
  console.log('Price per query:', PRICE_PER_QUERY, 'micro-USDC');
  console.log('Recipient wallet:', RECIPIENT_WALLET);
  console.log('USDC mint:', USDC_MINT);
  console.log('Supported symbols:', pythService.getSupportedSymbols().join(', '));
  console.log('='.repeat(60));
  console.log('Ready to accept x402 payments!');
  console.log('='.repeat(60));
});
