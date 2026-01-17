import { HermesClient } from '@pythnetwork/hermes-client';

const PRICE_FEED_IDS = {
  'btc-usd': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'eth-usd': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'sol-usd': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
} as const;

export type SupportedSymbol = keyof typeof PRICE_FEED_IDS;

export interface PriceData {
  symbol: string;
  price: string;
  conf: string;
  expo: number;
  publishTime: number;
  timestamp: string;
}

export class PythPriceService {
  private connection: HermesClient;

  constructor(hermesUrl: string = 'https://hermes.pyth.network') {
    this.connection = new HermesClient(hermesUrl);
  }

  async getPrice(symbol: SupportedSymbol): Promise<PriceData> {
    const feedId = PRICE_FEED_IDS[symbol];

    if (!feedId) {
      throw new Error('Unsupported symbol: ' + symbol + '. Supported: btc-usd, eth-usd, sol-usd');
    }

    try {
      const priceFeeds = await this.connection.getLatestPriceUpdates([feedId]);

      if (!priceFeeds || !priceFeeds.parsed || priceFeeds.parsed.length === 0) {
        throw new Error('No price data available for ' + symbol);
      }

      const priceFeed = priceFeeds.parsed[0];
      const price = priceFeed.price;

      if (!price) {
        throw new Error('No recent price data for ' + symbol);
      }

      return {
        symbol: symbol.toUpperCase(),
        price: price.price,
        conf: price.conf,
        expo: price.expo,
        publishTime: Number(price.publishTime),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error('Failed to fetch price for ' + symbol + ': ' + error.message);
      }
      throw error;
    }
  }

  async getPrices(symbols: SupportedSymbol[]): Promise<PriceData[]> {
    const feedIds = symbols.map(s => PRICE_FEED_IDS[s]).filter(Boolean);
    if (feedIds.length === 0) return [];

    const priceFeeds = await this.connection.getLatestPriceUpdates(feedIds);
    if (!priceFeeds?.parsed) return [];

    return priceFeeds.parsed.map((feed, i) => ({
      symbol: symbols[i].toUpperCase(),
      price: feed.price.price,
      conf: feed.price.conf,
      expo: feed.price.expo,
      publishTime: Number(feed.price.publishTime),
      timestamp: new Date().toISOString(),
    }));
  }

  isSupported(symbol: string): symbol is SupportedSymbol {
    return symbol in PRICE_FEED_IDS;
  }

  getSupportedSymbols(): SupportedSymbol[] {
    return Object.keys(PRICE_FEED_IDS) as SupportedSymbol[];
  }
}

export const pythService = new PythPriceService(process.env.PYTH_HERMES_URL);
