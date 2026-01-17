import { Session } from './session';
import { StorageManager } from './storage';
import { KVStorage } from './storage-kv';

export interface IStorage {
  saveSession(session: Session): Promise<void>;
  getSession(sessionId: string): Promise<Session | null>;
  getSessionByWallet(walletAddress: string, chain: string): Promise<Session | null>;
  deleteSession(sessionId: string): Promise<void>;
  hasTransaction(chain: string, txSignature: string): Promise<boolean>;
  markSignatureUsed(signature: string, chain: string): Promise<void>;
  cleanupExpiredSessions(): Promise<number>;
  close(): Promise<void>;
}

export class AsyncStorageAdapter implements IStorage {
  constructor(private storage: StorageManager | KVStorage) {}

  async saveSession(session: Session): Promise<void> {
    if (this.storage instanceof KVStorage) {
      return this.storage.saveSession(session);
    }
    return Promise.resolve(this.storage.saveSession(session));
  }

  async getSession(sessionId: string): Promise<Session | null> {
    if (this.storage instanceof KVStorage) {
      return this.storage.getSession(sessionId);
    }
    return Promise.resolve(this.storage.getSession(sessionId));
  }

  async getSessionByWallet(walletAddress: string, chain: string): Promise<Session | null> {
    if (this.storage instanceof KVStorage) {
      return this.storage.getSessionByWallet(walletAddress, chain);
    }
    return Promise.resolve(this.storage.getSessionByWallet(walletAddress, chain));
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (this.storage instanceof KVStorage) {
      return this.storage.deleteSession(sessionId);
    }
    return Promise.resolve(this.storage.deleteSession(sessionId));
  }

  async hasTransaction(chain: string, txSignature: string): Promise<boolean> {
    if (this.storage instanceof KVStorage) {
      return this.storage.hasTransaction(chain, txSignature);
    }
    return Promise.resolve(this.storage.isSignatureUsed(txSignature, chain));
  }

  async markSignatureUsed(signature: string, chain: string): Promise<void> {
    if (this.storage instanceof KVStorage) {
      return this.storage.markSignatureUsed(signature, chain);
    }
    return Promise.resolve(this.storage.markSignatureUsed(signature, chain));
  }

  async cleanupExpiredSessions(): Promise<number> {
    if (this.storage instanceof KVStorage) {
      return this.storage.cleanupExpiredSessions();
    }
    return Promise.resolve(this.storage.cleanupExpiredSessions());
  }

  async close(): Promise<void> {
    if (this.storage instanceof KVStorage) {
      return this.storage.close();
    }
    return Promise.resolve(this.storage.close());
  }
}
