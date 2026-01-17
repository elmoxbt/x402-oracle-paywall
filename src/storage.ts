import Database from 'better-sqlite3';
import path from 'path';
import { Session } from './session';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'sessions.db');

export class StorageManager {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        chain TEXT NOT NULL DEFAULT 'solana-devnet',
        deposit_tx_signature TEXT NOT NULL,
        deposit_token TEXT NOT NULL,
        total_credits INTEGER NOT NULL,
        remaining_credits INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        last_used_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_wallet_chain ON sessions(wallet_address, chain);
      CREATE INDEX IF NOT EXISTS idx_expires ON sessions(expires_at);

      CREATE TABLE IF NOT EXISTS used_signatures (
        signature TEXT PRIMARY KEY,
        chain TEXT NOT NULL DEFAULT 'solana-devnet',
        used_at INTEGER NOT NULL
      );
    `);
  }

  saveSession(session: Session): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions
      (id, wallet_address, chain, deposit_tx_signature, deposit_token, total_credits, remaining_credits, created_at, expires_at, last_used_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      session.id,
      session.walletAddress,
      session.chain,
      session.depositTxSignature,
      session.depositToken,
      session.totalCredits,
      session.remainingCredits,
      session.createdAt,
      session.expiresAt,
      session.lastUsedAt
    );
  }

  getSession(sessionId: string): Session | null {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(sessionId) as any;
    return row ? this.rowToSession(row) : null;
  }

  getSessionByWallet(walletAddress: string, chain: string): Session | null {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE wallet_address = ? AND chain = ? ORDER BY expires_at DESC LIMIT 1');
    const row = stmt.get(walletAddress, chain) as any;
    return row ? this.rowToSession(row) : null;
  }

  deleteSession(sessionId: string): void {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    stmt.run(sessionId);
  }

  cleanupExpiredSessions(): number {
    const now = Date.now();
    const stmt = this.db.prepare('DELETE FROM sessions WHERE expires_at < ?');
    const result = stmt.run(now);
    return result.changes;
  }

  private rowToSession(row: any): Session {
    return {
      id: row.id,
      walletAddress: row.wallet_address,
      chain: row.chain,
      depositTxSignature: row.deposit_tx_signature,
      depositToken: row.deposit_token,
      totalCredits: row.total_credits,
      remainingCredits: row.remaining_credits,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
    };
  }

  isSignatureUsed(signature: string, chain: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM used_signatures WHERE signature = ? AND chain = ?');
    return stmt.get(signature, chain) !== undefined;
  }

  markSignatureUsed(signature: string, chain: string): void {
    const stmt = this.db.prepare('INSERT OR IGNORE INTO used_signatures (signature, chain, used_at) VALUES (?, ?, ?)');
    stmt.run(signature, chain, Date.now());
  }

  close(): void {
    this.db.close();
  }
}
