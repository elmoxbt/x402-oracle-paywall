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

      const inputDecimals = this.getDecimals(inputMint);
      const outputDecimals = this.getDecimals(outputMint);
      const price = (Number(quote.outAmount) / Math.pow(10, outputDecimals)) / (Number(quote.inAmount) / Math.pow(10, inputDecimals));
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
      'BTC': '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',  
      'WBTC': '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
      'ETH': '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
      'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    };

    const inputMint = tokenMap[inputSymbol.toUpperCase()];
    const outputMint = tokenMap[outputSymbol.toUpperCase()];

    if (!inputMint || !outputMint) {
      throw new Error('Unsupported token symbol');
    }

    // Use 1 unit of input token (adjusted for decimals)
    const inputDecimals = this.getDecimals(inputMint);
    const amount = Math.pow(10, inputDecimals);

    return this.getPrice(inputMint, outputMint, amount);
  }

  private getDecimals(mint: string): number {
    const decimals: Record<string, number> = {
      'So11111111111111111111111111111111111111112': 9,
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6,
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6,
      '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': 8,
      '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 8,
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 5,
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 6,
    };
    return decimals[mint] || 6;
  }
}

export const jupiterService = new JupiterService('https://api.mainnet-beta.solana.com');
