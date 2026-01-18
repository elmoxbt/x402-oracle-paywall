import { Connection } from '@solana/web3.js';
import crypto from 'crypto';
import { createPublicClient, http, type PublicClient, type Hex, type Chain } from 'viem';
import { base, baseSepolia, mainnet, arbitrum, polygon, bsc } from 'viem/chains';
import { StorageManager } from './storage';
import { KVStorage } from './storage-kv';
import { AsyncStorageAdapter, IStorage } from './storage-async';
import { CHAINS, getChain, getSupportedChains, isSolanaChain, isEVMChain, TokenConfig } from './chains';

export { TokenConfig } from './chains';

export interface Session {
  id: string;
  walletAddress: string;
  chain: string;
  depositTxSignature: string;
  depositToken: string;
  totalCredits: number;
  remainingCredits: number;
  createdAt: number;
  expiresAt: number;
  lastUsedAt: number;
}

export interface SessionCreateResult {
  sessionId: string;
  totalCredits: number;
  expiresAt: number;
  token: string;
}

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

const EVM_CHAINS: Record<string, Chain> = {
  'base': base,
  'base-sepolia': baseSepolia,
  'ethereum': mainnet,
  'arbitrum': arbitrum,
  'polygon': polygon,
  'bsc': bsc,
};

export class SessionManager {
  private storage: IStorage;
  private connections: Map<string, Connection> = new Map();
  private evmClients: Map<string, PublicClient> = new Map();
  private recipientWallets: Record<string, string>;
  private defaultChain: string;

  constructor(recipientWallets: Record<string, string>, defaultChain = 'solana-devnet', useKV = false) {
    this.recipientWallets = recipientWallets;
    this.defaultChain = defaultChain;
    const baseStorage = useKV ? new KVStorage() : new StorageManager();
    this.storage = new AsyncStorageAdapter(baseStorage);

    for (const chainId of Object.keys(CHAINS)) {
      if (isSolanaChain(chainId)) {
        const chain = getChain(chainId)!;
        this.connections.set(chainId, new Connection(chain.rpcUrl, 'confirmed'));
      } else if (EVM_CHAINS[chainId]) {
        const client = createPublicClient({
          chain: EVM_CHAINS[chainId],
          transport: http(getChain(chainId)!.rpcUrl),
        });
        this.evmClients.set(chainId, client as PublicClient);
      }
    }
  }

  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  getTokenConfig(chainId: string, tokenSymbol: string): TokenConfig | null {
    const chain = getChain(chainId);
    if (!chain) return null;
    return chain.tokens[tokenSymbol.toUpperCase()] || null;
  }

  getSupportedTokens(chainId: string): TokenConfig[] {
    const chain = getChain(chainId);
    if (!chain) return [];
    return Object.values(chain.tokens);
  }

  getSupportedChains(): string[] {
    return getSupportedChains();
  }

  async verifyDeposit(
    chainId: string,
    signature: string,
    expectedRecipient: string,
    tokenMint: string,
    expectedAmount: number
  ): Promise<boolean> {
    if (isSolanaChain(chainId)) {
      return this.verifySolanaDeposit(chainId, signature);
    }

    if (isEVMChain(chainId)) {
      return this.verifyEVMDeposit(chainId, signature as Hex, expectedRecipient, tokenMint, expectedAmount);
    }

    return false;
  }

  private async verifySolanaDeposit(chainId: string, signature: string): Promise<boolean> {
    try {
      const connection = this.connections.get(chainId);
      if (!connection) return false;

      const tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      return tx !== null && !tx.meta?.err;
    } catch (error) {
      console.error('Solana deposit verification error:', error);
      return false;
    }
  }

  private async verifyEVMDeposit(
    chainId: string,
    txHash: Hex,
    expectedRecipient: string,
    tokenMint: string,
    expectedAmount: number
  ): Promise<boolean> {
    try {
      const client = this.evmClients.get(chainId);
      if (!client) return false;

      const receipt = await client.getTransactionReceipt({ hash: txHash });
      if (!receipt || receipt.status !== 'success') return false;

      const recipientLower = expectedRecipient.toLowerCase();
      const isNativeToken = tokenMint === '0x0000000000000000000000000000000000000000';

      if (isNativeToken) {
        const tx = await client.getTransaction({ hash: txHash });
        return tx.to?.toLowerCase() === recipientLower && tx.value >= BigInt(expectedAmount);
      }

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== tokenMint.toLowerCase()) continue;

        try {
          const topics = log.topics;
          if (topics.length < 3) continue;

          const to = '0x' + topics[2]!.slice(26);
          if (to.toLowerCase() !== recipientLower) continue;

          const value = BigInt(log.data);
          if (value >= BigInt(expectedAmount)) return true;
        } catch {
          continue;
        }
      }

      return false;
    } catch (error) {
      console.error('EVM deposit verification error:', error);
      return false;
    }
  }

  async createSession(
    walletAddress: string,
    chainId: string,
    depositTxSignature: string,
    depositAmount: number,
    tokenSymbol: string
  ): Promise<SessionCreateResult | { error: string } | null> {
    const chain = getChain(chainId);
    if (!chain) {
      return { error: 'Unsupported chain' };
    }

    const isUsed = await this.storage.hasTransaction(chainId, depositTxSignature);
    if (isUsed) {
      return { error: 'Transaction already used' };
    }

    const token = this.getTokenConfig(chainId, tokenSymbol);
    if (!token) {
      return null;
    }

    const recipient = this.recipientWallets[chainId];
    if (!recipient) {
      return { error: 'No recipient configured for chain' };
    }

    const isValid = await this.verifyDeposit(
      chainId,
      depositTxSignature,
      recipient,
      token.mint,
      depositAmount
    );
    if (!isValid) {
      return null;
    }

    await this.storage.markSignatureUsed(depositTxSignature, chainId);

    const totalCredits = Math.floor(depositAmount / token.pricePerQuery);
    if (totalCredits < 1) {
      return null;
    }

    const existingSession = await this.storage.getSessionByWallet(walletAddress, chainId);
    if (existingSession && existingSession.expiresAt > Date.now()) {
      existingSession.totalCredits += totalCredits;
      existingSession.remainingCredits += totalCredits;
      existingSession.expiresAt = Date.now() + SESSION_DURATION_MS;
      await this.storage.saveSession(existingSession);

      return {
        sessionId: existingSession.id,
        totalCredits: existingSession.remainingCredits,
        expiresAt: existingSession.expiresAt,
        token: token.symbol,
      };
    }

    const sessionId = this.generateSessionId();
    const now = Date.now();

    const session: Session = {
      id: sessionId,
      walletAddress,
      chain: chainId,
      depositTxSignature,
      depositToken: token.symbol,
      totalCredits,
      remainingCredits: totalCredits,
      createdAt: now,
      expiresAt: now + SESSION_DURATION_MS,
      lastUsedAt: now,
    };

    await this.storage.saveSession(session);

    return {
      sessionId,
      totalCredits,
      expiresAt: session.expiresAt,
      token: token.symbol,
    };
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const session = await this.storage.getSession(sessionId);
    if (!session) return null;

    if (session.expiresAt < Date.now()) {
      await this.storage.deleteSession(sessionId);
      return null;
    }

    return session;
  }

  async getSessionByWallet(walletAddress: string, chainId: string): Promise<Session | null> {
    const session = await this.storage.getSessionByWallet(walletAddress, chainId);
    if (!session) return null;

    if (session.expiresAt < Date.now()) {
      await this.storage.deleteSession(session.id);
      return null;
    }

    return session;
  }

  async useCredit(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session || session.remainingCredits <= 0) return false;

    session.remainingCredits--;
    session.lastUsedAt = Date.now();
    await this.storage.saveSession(session);
    return true;
  }

  async getSessionStatus(sessionId: string): Promise<{
    valid: boolean;
    remainingCredits: number;
    totalCredits: number;
    expiresAt: number;
    queriesUsed: number;
  } | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    return {
      valid: session.remainingCredits > 0,
      remainingCredits: session.remainingCredits,
      totalCredits: session.totalCredits,
      expiresAt: session.expiresAt,
      queriesUsed: session.totalCredits - session.remainingCredits,
    };
  }

  async cleanupExpiredSessions(): Promise<number> {
    return this.storage.cleanupExpiredSessions();
  }

  getPricingInfo(chainId?: string) {
    const targetChain = chainId || this.defaultChain;
    const chain = getChain(targetChain);

    return {
      chain: targetChain,
      recipientWallet: this.recipientWallets[targetChain],
      sessionDurationMs: SESSION_DURATION_MS,
      supportedChains: getSupportedChains(),
      supportedTokens: chain ? Object.values(chain.tokens).map(t => ({
        symbol: t.symbol,
        mint: t.mint,
        decimals: t.decimals,
        pricePerQuery: t.pricePerQuery.toString(),
        pricePerQueryUSD: 0.0001,
      })) : [],
    };
  }
}
