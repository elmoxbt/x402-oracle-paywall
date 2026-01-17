export interface ChainConfig {
  name: string;
  rpcUrl: string;
  tokens: Record<string, TokenConfig>;
}

export interface TokenConfig {
  mint: string;
  symbol: string;
  decimals: number;
  pricePerQuery: number;
}

export const CHAINS: Record<string, ChainConfig> = {
  'solana-devnet': {
    name: 'Solana Devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    tokens: {
      'USDC': {
        mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        symbol: 'USDC',
        decimals: 6,
        pricePerQuery: 100,
      },
      'USDT': {
        mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        symbol: 'USDT',
        decimals: 6,
        pricePerQuery: 100,
      },
      'SOL': {
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        decimals: 9,
        pricePerQuery: 500,
      },
    },
  },
  'solana-mainnet': {
    name: 'Solana Mainnet',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    tokens: {
      'USDC': {
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        decimals: 6,
        pricePerQuery: 100,
      },
      'USDT': {
        mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        symbol: 'USDT',
        decimals: 6,
        pricePerQuery: 100,
      },
      'SOL': {
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        decimals: 9,
        pricePerQuery: 500,
      },
    },
  },
  'base': {
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    tokens: {
      'USDC': {
        mint: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        symbol: 'USDC',
        decimals: 6,
        pricePerQuery: 100,
      },
      'ETH': {
        mint: '0x0000000000000000000000000000000000000000',
        symbol: 'ETH',
        decimals: 18,
        pricePerQuery: 50000000000000,
      },
    },
  },
  'base-sepolia': {
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    tokens: {
      'USDC': {
        mint: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        symbol: 'USDC',
        decimals: 6,
        pricePerQuery: 100,
      },
      'ETH': {
        mint: '0x0000000000000000000000000000000000000000',
        symbol: 'ETH',
        decimals: 18,
        pricePerQuery: 50000000000000,
      },
    },
  },
  'ethereum': {
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    tokens: {
      'USDC': {
        mint: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        symbol: 'USDC',
        decimals: 6,
        pricePerQuery: 100,
      },
      'USDT': {
        mint: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        symbol: 'USDT',
        decimals: 6,
        pricePerQuery: 100,
      },
      'ETH': {
        mint: '0x0000000000000000000000000000000000000000',
        symbol: 'ETH',
        decimals: 18,
        pricePerQuery: 50000000000000,
      },
    },
  },
  'arbitrum': {
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    tokens: {
      'USDC': {
        mint: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        symbol: 'USDC',
        decimals: 6,
        pricePerQuery: 100,
      },
      'ETH': {
        mint: '0x0000000000000000000000000000000000000000',
        symbol: 'ETH',
        decimals: 18,
        pricePerQuery: 50000000000000,
      },
    },
  },
  'polygon': {
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    tokens: {
      'USDC': {
        mint: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        symbol: 'USDC',
        decimals: 6,
        pricePerQuery: 100,
      },
      'MATIC': {
        mint: '0x0000000000000000000000000000000000000000',
        symbol: 'MATIC',
        decimals: 18,
        pricePerQuery: 100000000000000000,
      },
    },
  },
  'bsc': {
    name: 'BNB Chain',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    tokens: {
      'USDC': {
        mint: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        symbol: 'USDC',
        decimals: 18,
        pricePerQuery: 100000000000000,
      },
      'USDT': {
        mint: '0x55d398326f99059fF775485246999027B3197955',
        symbol: 'USDT',
        decimals: 18,
        pricePerQuery: 100000000000000,
      },
      'BNB': {
        mint: '0x0000000000000000000000000000000000000000',
        symbol: 'BNB',
        decimals: 18,
        pricePerQuery: 200000000000000,
      },
    },
  },
};

export function getChain(chainId: string): ChainConfig | null {
  return CHAINS[chainId.toLowerCase()] || null;
}

export function getSupportedChains(): string[] {
  return Object.keys(CHAINS);
}

export function isSolanaChain(chainId: string): boolean {
  return chainId.startsWith('solana');
}

export function isEVMChain(chainId: string): boolean {
  return !chainId.startsWith('solana');
}
