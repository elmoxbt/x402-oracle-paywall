import { SessionManager } from './session';
import { StorageManager } from './storage';
import fs from 'fs';

const TEST_DB = './test-sessions.db';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
    process.env.DB_PATH = TEST_DB;
    sessionManager = new SessionManager(
      { 'solana-devnet': 'test-wallet' },
      'solana-devnet',
      false
    );
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
  });

  test('session creation with valid credits', async () => {
    const storage = new StorageManager();
    const session = {
      id: 'test-session-123',
      walletAddress: 'wallet123',
      chain: 'solana-devnet',
      depositTxSignature: 'tx123',
      depositToken: 'USDC',
      totalCredits: 1000,
      remainingCredits: 1000,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      lastUsedAt: Date.now(),
    };

    storage.saveSession(session);
    const retrieved = await sessionManager.getSession('test-session-123');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.totalCredits).toBe(1000);
    expect(retrieved?.remainingCredits).toBe(1000);
  });

  test('query deduction decrements credits', async () => {
    const storage = new StorageManager();
    const session = {
      id: 'test-session-456',
      walletAddress: 'wallet456',
      chain: 'solana-devnet',
      depositTxSignature: 'tx456',
      depositToken: 'USDC',
      totalCredits: 10,
      remainingCredits: 10,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      lastUsedAt: Date.now(),
    };

    storage.saveSession(session);

    const used = await sessionManager.useCredit('test-session-456');
    expect(used).toBe(true);

    const status = await sessionManager.getSessionStatus('test-session-456');
    expect(status?.remainingCredits).toBe(9);
  });

  test('low credit fails when credits exhausted', async () => {
    const storage = new StorageManager();
    const session = {
      id: 'test-session-789',
      walletAddress: 'wallet789',
      chain: 'solana-devnet',
      depositTxSignature: 'tx789',
      depositToken: 'USDC',
      totalCredits: 1,
      remainingCredits: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      lastUsedAt: Date.now(),
    };

    storage.saveSession(session);

    const used = await sessionManager.useCredit('test-session-789');
    expect(used).toBe(false);
  });

  test('expired session returns null', async () => {
    const storage = new StorageManager();
    const session = {
      id: 'test-session-expired',
      walletAddress: 'walletExpired',
      chain: 'solana-devnet',
      depositTxSignature: 'txExpired',
      depositToken: 'USDC',
      totalCredits: 100,
      remainingCredits: 100,
      createdAt: Date.now() - 48 * 60 * 60 * 1000,
      expiresAt: Date.now() - 1000,
      lastUsedAt: Date.now() - 48 * 60 * 60 * 1000,
    };

    storage.saveSession(session);

    const retrieved = await sessionManager.getSession('test-session-expired');
    expect(retrieved).toBeNull();
  });

  test('session status shows correct queries used', async () => {
    const storage = new StorageManager();
    const session = {
      id: 'test-session-status',
      walletAddress: 'walletStatus',
      chain: 'solana-devnet',
      depositTxSignature: 'txStatus',
      depositToken: 'USDC',
      totalCredits: 100,
      remainingCredits: 95,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      lastUsedAt: Date.now(),
    };

    storage.saveSession(session);

    const status = await sessionManager.getSessionStatus('test-session-status');
    expect(status?.queriesUsed).toBe(5);
    expect(status?.remainingCredits).toBe(95);
    expect(status?.valid).toBe(true);
  });
});
