import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const DEFAULT_CHAIN = process.env.DEFAULT_CHAIN || 'solana-devnet';

function loadKeypair(keypairPath: string): Keypair {
  const fullPath = path.resolve(keypairPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error('Keypair file not found at: ' + fullPath);
  }
  const secretKey = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

async function checkExistingSession(chain: string, walletAddress: string): Promise<{ sessionId: string; remainingCredits: number } | null> {
  const response = await axios.get(`${SERVER_URL}/api/wallet/${chain}/${walletAddress}`);
  if (response.data.hasSession && response.data.remainingCredits > 0) {
    return {
      sessionId: response.data.sessionId,
      remainingCredits: response.data.remainingCredits,
    };
  }
  return null;
}

async function sendDeposit(
  connection: Connection,
  payer: Keypair,
  recipient: PublicKey,
  mint: PublicKey,
  amount: number
): Promise<string> {
  console.log('\nDepositing', amount, 'tokens...');

  const payerTokenAccount = await getAssociatedTokenAddress(mint, payer.publicKey);
  const recipientTokenAccount = await getAssociatedTokenAddress(mint, recipient);

  const transaction = new Transaction();

  try {
    await getAccount(connection, recipientTokenAccount);
  } catch {
    console.log('Creating recipient token account...');
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        recipientTokenAccount,
        recipient,
        mint
      )
    );
  }

  transaction.add(
    createTransferInstruction(
      payerTokenAccount,
      recipientTokenAccount,
      payer.publicKey,
      amount
    )
  );

  transaction.feePayer = payer.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  const signature = await connection.sendTransaction(transaction, [payer]);
  await connection.confirmTransaction(signature, 'confirmed');
  console.log('Deposit confirmed:', signature);

  return signature;
}

async function createSession(
  walletAddress: string,
  chain: string,
  depositTxSignature: string,
  depositAmount: number,
  token: string
): Promise<string> {
  const response = await axios.post(SERVER_URL + '/api/session', {
    walletAddress,
    chain,
    depositTxSignature,
    depositAmount,
    token,
  });

  console.log('Session created:', response.data.session.sessionId);
  console.log('Credits:', response.data.session.totalCredits, '(' + token + ')');
  return response.data.session.sessionId;
}

async function fetchPrice(sessionId: string, symbol: string): Promise<void> {
  const response = await axios.get(SERVER_URL + '/api/price/' + symbol, {
    headers: { 'X-Session-Id': sessionId },
  });

  const priceData = response.data.data;
  const humanPrice = parseFloat(priceData.price) * Math.pow(10, priceData.expo);
  console.log(symbol.toUpperCase() + ':', humanPrice.toFixed(2), 'USD | Credits:', response.data.session.remainingCredits);
}

async function main() {
  console.log('x402 Multi-Chain Oracle Demo');

  const keypairPath = process.argv[2] || process.env.KEYPAIR_PATH;
  const selectedToken = (process.argv[3] || 'USDC').toUpperCase();
  const selectedChain = process.argv[4] || DEFAULT_CHAIN;

  if (!keypairPath) {
    console.error('Usage: npm run demo <keypair.json> [TOKEN] [CHAIN]');
    console.error('Tokens: USDC, USDT, SOL');
    console.error('Chains: solana-devnet, solana-mainnet, base, ethereum, etc.');
    process.exit(1);
  }

  const payer = loadKeypair(keypairPath);
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

  console.log('Chain:', selectedChain);
  console.log('Wallet:', payer.publicKey.toBase58());
  console.log('Token:', selectedToken);

  const balance = await connection.getBalance(payer.publicKey);
  console.log('SOL:', (balance / 1e9).toFixed(4));

  console.log('\n[Step 1] Check for existing session...');
  const existingSession = await checkExistingSession(selectedChain, payer.publicKey.toBase58());

  let sessionId: string;

  if (existingSession) {
    console.log('Found existing session!');
    console.log('Session ID:', existingSession.sessionId);
    console.log('Remaining credits:', existingSession.remainingCredits);
    sessionId = existingSession.sessionId;
  } else {
    console.log('No active session found.');

    console.log('\n[Step 2] Get pricing info...');
    const pricingResponse = await axios.get(`${SERVER_URL}/api/pricing/${selectedChain}`);
    const pricing = pricingResponse.data;

    const tokenConfig = pricing.supportedTokens.find((t: any) => t.symbol === selectedToken);
    if (!tokenConfig) {
      console.error('Token not supported on', selectedChain + ':', selectedToken);
      console.log('Available:', pricing.supportedTokens.map((t: any) => t.symbol).join(', '));
      process.exit(1);
    }

    console.log('Price per query:', tokenConfig.pricePerQueryHuman, tokenConfig.symbol);
    console.log('Recipient:', pricing.recipientWallet);

    const numQueries = 10000;
    const depositAmount = tokenConfig.pricePerQuery * numQueries;
    console.log('\n[Step 3] Depositing for', numQueries, 'queries...');

    const signature = await sendDeposit(
      connection,
      payer,
      new PublicKey(pricing.recipientWallet),
      new PublicKey(tokenConfig.mint),
      depositAmount
    );

    console.log('\n[Step 4] Creating session...');
    sessionId = await createSession(
      payer.publicKey.toBase58(),
      selectedChain,
      signature,
      depositAmount,
      selectedToken
    );
  }

  console.log('\n[Fetching prices] No additional signatures needed...');
  console.log('-'.repeat(40));

  await fetchPrice(sessionId, 'btc-usd');
  await fetchPrice(sessionId, 'eth-usd');
  await fetchPrice(sessionId, 'sol-usd');

  console.log('-'.repeat(40));
  console.log('\nSession ready for HFT - no more signatures needed!');
}

main().catch(console.error);
