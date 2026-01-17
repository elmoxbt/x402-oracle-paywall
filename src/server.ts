import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { pythService, SupportedSymbol } from './pyth';
import { SessionManager } from './session';
import { getSupportedChains } from './chains';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DEFAULT_CHAIN = process.env.DEFAULT_CHAIN || 'solana-devnet';
const USE_KV = process.env.USE_KV === 'true';

const recipientWallets: Record<string, string> = {};
for (const chain of getSupportedChains()) {
  const envKey = `RECIPIENT_WALLET_${chain.toUpperCase().replace(/-/g, '_')}`;
  const wallet = process.env[envKey] || process.env.RECIPIENT_WALLET;
  if (wallet && wallet !== 'your_wallet_address_here') {
    recipientWallets[chain] = wallet;
  }
}

if (Object.keys(recipientWallets).length === 0) {
  console.error('ERROR: No recipient wallets configured. Set RECIPIENT_WALLET or chain-specific wallets.');
  process.exit(1);
}

const sessionManager = new SessionManager(recipientWallets, DEFAULT_CHAIN, USE_KV);

setInterval(() => sessionManager.cleanupExpiredSessions(), 60 * 1000);

app.get('/', (_req: Request, res: Response) => {
  const pricing = sessionManager.getPricingInfo();
  res.json({
    name: 'x402 Paywalled Oracle',
    description: 'Multi-chain HFT oracle with session-based payments',
    endpoints: {
      createSession: 'POST /api/session',
      sessionStatus: 'GET /api/session/:sessionId',
      walletSession: 'GET /api/wallet/:chain/:walletAddress',
      price: 'GET /api/price/:symbol',
      prices: 'POST /api/prices',
      pricing: 'GET /api/pricing/:chain',
      chains: 'GET /api/chains',
      health: 'GET /health',
    },
    supportedChains: sessionManager.getSupportedChains(),
    supportedSymbols: pythService.getSupportedSymbols(),
  });
});

app.get('/api/chains', (_req: Request, res: Response) => {
  res.json({ chains: sessionManager.getSupportedChains() });
});

app.get('/api/pricing', (_req: Request, res: Response) => {
  res.json(sessionManager.getPricingInfo(DEFAULT_CHAIN));
});

app.get('/api/pricing/:chain', (req: Request, res: Response) => {
  res.json(sessionManager.getPricingInfo(req.params.chain));
});

app.post('/api/session', async (req: Request, res: Response) => {
  const { walletAddress, chain, depositTxSignature, depositAmount, token } = req.body;
  const chainId = chain || DEFAULT_CHAIN;

  if (!walletAddress || !depositTxSignature || !depositAmount || !token) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['walletAddress', 'depositTxSignature', 'depositAmount', 'token'],
      optional: ['chain'],
      supportedChains: sessionManager.getSupportedChains(),
      supportedTokens: sessionManager.getSupportedTokens(chainId).map(t => t.symbol),
    });
  }

  const tokenConfig = sessionManager.getTokenConfig(chainId, token);
  if (!tokenConfig) {
    return res.status(400).json({
      error: 'Unsupported token for chain',
      chain: chainId,
      supportedTokens: sessionManager.getSupportedTokens(chainId).map(t => t.symbol),
    });
  }

  const result = await sessionManager.createSession(
    walletAddress,
    chainId,
    depositTxSignature,
    depositAmount,
    token
  );

  if (!result) {
    return res.status(400).json({
      error: 'Session creation failed',
      message: 'Could not verify deposit or amount too low',
    });
  }

  if ('error' in result) {
    return res.status(409).json({
      error: result.error,
    });
  }

  res.json({
    success: true,
    chain: chainId,
    session: result,
  });
});

app.get('/api/session/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const status = await sessionManager.getSessionStatus(sessionId);

  if (!status) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  res.json(status);
});

app.get('/api/wallet/:chain/:walletAddress', async (req: Request, res: Response) => {
  const { chain, walletAddress } = req.params;
  const session = await sessionManager.getSessionByWallet(walletAddress, chain);

  if (!session) {
    return res.json({ hasSession: false, chain });
  }

  const status = await sessionManager.getSessionStatus(session.id);
  res.json({
    hasSession: true,
    chain,
    sessionId: session.id,
    remainingCredits: status?.remainingCredits,
    expiresAt: status?.expiresAt,
  });
});

app.get('/api/price/:symbol', async (req: Request, res: Response) => {
  const symbol = req.params.symbol.toLowerCase() as SupportedSymbol;
  const sessionId = req.headers['x-session-id'] as string;

  if (!pythService.isSupported(symbol)) {
    return res.status(400).json({
      error: 'Invalid symbol',
      supported: pythService.getSupportedSymbols(),
    });
  }

  if (!sessionId) {
    return res.status(402).json({
      error: 'Payment Required',
      message: 'Create a session first by depositing tokens',
      pricing: sessionManager.getPricingInfo(),
    });
  }

  const session = await sessionManager.getSession(sessionId);
  if (!session) {
    return res.status(401).json({
      error: 'Invalid or expired session',
      message: 'Create a new session',
    });
  }

  if (!(await sessionManager.useCredit(sessionId))) {
    return res.status(402).json({
      error: 'Insufficient credits',
      message: 'Deposit more tokens to continue',
      remainingCredits: 0,
    });
  }

  try {
    const priceData = await pythService.getPrice(symbol);
    const status = await sessionManager.getSessionStatus(sessionId);

    res.json({
      success: true,
      data: priceData,
      session: {
        remainingCredits: status?.remainingCredits,
        expiresAt: status?.expiresAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch price',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/prices', async (req: Request, res: Response) => {
  const sessionId = req.headers['x-session-id'] as string;
  const { symbols } = req.body as { symbols?: string[] };

  if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
    return res.status(400).json({ error: 'symbols array required' });
  }

  const validSymbols = symbols
    .map(s => s.toLowerCase())
    .filter(s => pythService.isSupported(s)) as SupportedSymbol[];

  if (validSymbols.length === 0) {
    return res.status(400).json({
      error: 'No valid symbols',
      supported: pythService.getSupportedSymbols(),
    });
  }

  if (!sessionId) {
    return res.status(402).json({
      error: 'Payment Required',
      pricing: sessionManager.getPricingInfo(),
    });
  }

  const session = await sessionManager.getSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  if (!(await sessionManager.useCredit(sessionId))) {
    return res.status(402).json({ error: 'Insufficient credits' });
  }

  try {
    const prices = await pythService.getPrices(validSymbols);
    const status = await sessionManager.getSessionStatus(sessionId);

    res.json({
      success: true,
      data: prices,
      session: { remainingCredits: status?.remainingCredits },
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: {
      defaultChain: DEFAULT_CHAIN,
      supportedChains: sessionManager.getSupportedChains(),
      supportedSymbols: pythService.getSupportedSymbols(),
    },
  });
});

app.listen(PORT, () => {
  console.log('x402 Multi-Chain Oracle');
  console.log('Port:', PORT);
  console.log('Default Chain:', DEFAULT_CHAIN);
  console.log('Chains:', sessionManager.getSupportedChains().join(', '));
  console.log('Price Feeds:', pythService.getSupportedSymbols().join(', '));
});
