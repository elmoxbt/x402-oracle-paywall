import { createJupiterApiClient } from '@jup-ag/api';
import { Connection, PublicKey } from '@solana/web3.js';

const jupiterQuoteApi = createJupiterApiClient();

export interface JupiterPriceData {
  inputMint: string;
  outputMint: string;
  price: number;
  priceImpact: number;
  timestamp: number;
}

export class JupiterService {
  private connection: Connection;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  async getPrice(inputMint: string, outputMint: string, amount = 1000000): Promise<JupiterPriceData> {
    try {
      const quote = await jupiterQuoteApi.quoteGet({
        inputMint,
        outputMint,
        amount,
        slippageBps: 50,
      });

      if (!quote) {
        throw new Error('No quote available');
      }

      const price = Number(quote.outAmount) / Number(quote.inAmount);
      const priceImpact = quote.priceImpactPct ? Number(quote.priceImpactPct) : 0;

      return {
        inputMint,
        outputMint,
        price,
        priceImpact,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error(`Jupiter price fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPriceBySymbol(inputSymbol: string, outputSymbol: string): Promise<JupiterPriceData> {
    const tokenMap: Record<string, string> = {
      'SOL': 'So11111111111111111111111111111111111111112',
      'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    };

    const inputMint = tokenMap[inputSymbol.toUpperCase()];
    const outputMint = tokenMap[outputSymbol.toUpperCase()];

    if (!inputMint || !outputMint) {
      throw new Error('Unsupported token symbol');
    }

    return this.getPrice(inputMint, outputMint);
  }
}

export const jupiterService = new JupiterService('https://api.mainnet-beta.solana.com');
