import { kv } from '@vercel/kv';
import { Session } from './session';

export class KVStorage {
  private readonly SESSION_PREFIX = 'session:';
  private readonly WALLET_PREFIX = 'wallet:';
  private readonly TX_PREFIX = 'tx:';
  private readonly SESSION_EXPIRY = 24 * 60 * 60;

  async saveSession(session: Session): Promise<void> {
    const sessionKey = `${this.SESSION_PREFIX}${session.id}`;
    const walletKey = `${this.WALLET_PREFIX}${session.chain}:${session.walletAddress}`;

    await kv.set(sessionKey, JSON.stringify(session), { ex: this.SESSION_EXPIRY });
    await kv.set(walletKey, session.id, { ex: this.SESSION_EXPIRY });
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    const data = await kv.get<string>(sessionKey);

    if (!data) return null;

    return JSON.parse(data);
  }

  async getSessionByWallet(walletAddress: string, chain: string): Promise<Session | null> {
    const walletKey = `${this.WALLET_PREFIX}${chain}:${walletAddress}`;
    const sessionId = await kv.get<string>(walletKey);

    if (!sessionId) return null;

    return this.getSession(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    await kv.del(sessionKey);
  }

  async hasTransaction(chain: string, txSignature: string): Promise<boolean> {
    const txKey = `${this.TX_PREFIX}${chain}:${txSignature}`;
    const exists = await kv.exists(txKey);
    return exists === 1;
  }

  async markSignatureUsed(signature: string, chain: string): Promise<void> {
    const txKey = `${this.TX_PREFIX}${chain}:${signature}`;
    await kv.set(txKey, '1', { ex: this.SESSION_EXPIRY });
  }

  async cleanupExpiredSessions(): Promise<number> {
    return 0;
  }

  async close(): Promise<void> {
    // No connection to close for KV
  }
}
