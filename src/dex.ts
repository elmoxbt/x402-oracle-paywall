import axios from 'axios';

export interface DEXPriceData {
  inputToken: string;
  outputToken: string;
  price: number;
  source: string;
  timestamp: number;
}

const COMMON_TOKENS: Record<string, Record<string, string>> = {
  'ethereum': {
    'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  },
  'base': {
    'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  },
  'arbitrum': {
    'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  },
  'polygon': {
    'USDC': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    'MATIC': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  },
  'bsc': {
    'USDC': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    'USDT': '0x55d398326f99059fF775485246999027B3197955',
    'BNB': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  },
};

export class DEXService {
  async getPrice(chain: string, inputToken: string, outputToken: string): Promise<DEXPriceData> {
    try {
      const response = await axios.get('https://api.1inch.dev/swap/v6.0/' + this.getChainId(chain) + '/quote', {
        params: {
          src: inputToken,
          dst: outputToken,
          amount: '1000000',
        },
        headers: {
          'Authorization': 'Bearer ' + (process.env.ONEINCH_API_KEY || ''),
        },
      });

      const price = Number(response.data.dstAmount) / Number(response.data.srcAmount);

      return {
        inputToken,
        outputToken,
        price,
        source: '1inch',
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error(`DEX price fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPriceBySymbol(chain: string, inputSymbol: string, outputSymbol: string): Promise<DEXPriceData> {
    const tokens = COMMON_TOKENS[chain.toLowerCase()];
    if (!tokens) {
      throw new Error(`Chain ${chain} not supported`);
    }

    const inputToken = tokens[inputSymbol.toUpperCase()];
    const outputToken = tokens[outputSymbol.toUpperCase()];

    if (!inputToken || !outputToken) {
      throw new Error('Unsupported token symbol');
    }

    return this.getPrice(chain, inputToken, outputToken);
  }

  private getChainId(chain: string): number {
    const chainIds: Record<string, number> = {
      'ethereum': 1,
      'base': 8453,
      'arbitrum': 42161,
      'polygon': 137,
      'bsc': 56,
    };
    return chainIds[chain.toLowerCase()] || 1;
  }
}

export const dexService = new DEXService();
