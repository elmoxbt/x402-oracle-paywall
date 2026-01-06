import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

/**
 * Load keypair from file
 */
function loadKeypair(keypairPath: string): Keypair {
  const fullPath = path.resolve(keypairPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error('Keypair file not found at: ' + fullPath);
  }

  const secretKey = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

/**
 * Create and send USDC payment transaction
 */
async function sendPayment(
  connection: Connection,
  payer: Keypair,
  recipient: PublicKey,
  amount: number
): Promise<string> {
  console.log('\nPreparing payment transaction...');
  console.log('Payer:', payer.publicKey.toBase58());
  console.log('Recipient:', recipient.toBase58());
  console.log('Amount:', amount, 'micro-USDC');

  // Get token accounts
  const payerTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT,
    payer.publicKey
  );

  const recipientTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT,
    recipient
  );

  console.log('Payer token account:', payerTokenAccount.toBase58());
  console.log('Recipient token account:', recipientTokenAccount.toBase58());

  // Check SOL balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log('Current SOL balance:', (balance / 1e9).toFixed(6), 'SOL');

  if (balance < 0.01 * 1e9) {
    throw new Error('Insufficient SOL balance. Need at least 0.01 SOL. Run: solana airdrop 1 --url devnet');
  }

  // Check if recipient token account exists, create if not
  const transaction = new Transaction();
  let needsAccountCreation = false;

  try {
    await getAccount(connection, recipientTokenAccount);
    console.log('Recipient token account exists');
  } catch (error) {
    console.log('Recipient token account does not exist, creating...');
    console.log('Note: This will cost ~0.002 SOL for rent');
    needsAccountCreation = true;
    const createAccountInstruction = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      recipientTokenAccount,
      recipient,
      USDC_MINT
    );
    transaction.add(createAccountInstruction);
  }

  // Create transfer instruction
  const transferInstruction = createTransferInstruction(
    payerTokenAccount,
    recipientTokenAccount,
    payer.publicKey,
    amount
  );

  // Add transfer instruction to transaction
  transaction.add(transferInstruction);
  transaction.feePayer = payer.publicKey;

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  console.log('\nSigning and sending transaction...');
  if (needsAccountCreation) {
    console.log('Transaction includes: Create token account + Transfer USDC');
  } else {
    console.log('Transaction includes: Transfer USDC');
  }

  const signature = await connection.sendTransaction(transaction, [payer]);

  console.log('Transaction sent:', signature);
  console.log('Confirming...');

  await connection.confirmTransaction(signature, 'confirmed');
  console.log('Transaction confirmed!');

  return signature;
}

/**
 * Fetch price with x402 payment
 */
async function fetchPriceWithPayment(
  connection: Connection,
  payer: Keypair,
  symbol: string
): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('x402 Client Demo - Fetching Price for', symbol.toUpperCase());
  console.log('='.repeat(60));

  try {
    // Step 1: Initial request without payment
    console.log('\n[Step 1] Making initial request without payment...');

    let response;
    try {
      response = await axios.get(SERVER_URL + '/api/price/' + symbol);
      console.log('Unexpected success without payment:', response.data);
      return;
    } catch (error: any) {
      if (error.response && error.response.status === 402) {
        console.log('Received 402 Payment Required (as expected)');
        console.log('Payment details:', JSON.stringify(error.response.data.payment, null, 2));

        const paymentInfo = error.response.data.payment;

        // Step 2: Send payment
        console.log('\n[Step 2] Sending payment...');
        const signature = await sendPayment(
          connection,
          payer,
          new PublicKey(paymentInfo.recipient),
          paymentInfo.amount
        );

        // Step 3: Retry request with payment proof
        console.log('\n[Step 3] Retrying request with payment proof...');

        const paymentHeader = [
          'signature=' + signature,
          'amount=' + paymentInfo.amount,
          'mint=' + paymentInfo.mint,
          'recipient=' + paymentInfo.recipient,
          'timestamp=' + Date.now()
        ].join(',');

        console.log('Payment header:', paymentHeader);

        response = await axios.get(SERVER_URL + '/api/price/' + symbol, {
          headers: {
            'X-Solana-Payment': paymentHeader,
          },
        });

        console.log('\n[Step 4] Success! Received price data:');
        console.log('='.repeat(60));
        console.log(JSON.stringify(response.data, null, 2));
        console.log('='.repeat(60));

        const priceData = response.data.data;
        const humanPrice = parseFloat(priceData.price) * Math.pow(10, priceData.expo);
        console.log('\nFormatted Price:', humanPrice.toFixed(2), 'USD');
        console.log('Payment Signature:', response.data.payment.signature);
        console.log('\n x402 payment flow completed successfully!');

      } else {
        console.error('Unexpected error:', error.message);
      }
    }

  } catch (error: any) {
    console.error('\n Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

/**
 * Main function
 */
async function main() {
  console.log('x402 Paywalled Oracle - Client Demo');

  // Get keypair path from command line or env
  const keypairPath = process.argv[2] || process.env.KEYPAIR_PATH;

  if (!keypairPath) {
    console.error('\n Error: Keypair path not provided');
    console.error('\nUsage:');
    console.error('  npm run demo <path-to-keypair.json>');
    console.error('\nOr set KEYPAIR_PATH in .env file');
    console.error('\nExample:');
    console.error('  npm run demo ~/.config/solana/id.json');
    process.exit(1);
  }

  try {
    // Load keypair
    console.log('\nLoading keypair from:', keypairPath);
    const payer = loadKeypair(keypairPath);
    console.log('Wallet loaded:', payer.publicKey.toBase58());

    // Connect to Solana
    console.log('\nConnecting to Solana devnet...');
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    // Check balance
    const balance = await connection.getBalance(payer.publicKey);
    console.log('SOL balance:', (balance / 1e9).toFixed(4), 'SOL');

    // Check USDC balance
    const tokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      payer.publicKey
    );

    try {
      const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
      console.log('USDC balance:', tokenBalance.value.uiAmountString, 'USDC');
    } catch (error) {
      console.log('  USDC token account not found - you may need devnet USDC');
    }

    // Fetch BTC price
    await fetchPriceWithPayment(connection, payer, 'btc-usd');

    // Optional: Fetch ETH price
    console.log('\n\nWould you like to fetch BTC/USD as well? (costs another payment)');
    console.log('Uncomment the line below to enable:');
    console.log('// await fetchPriceWithPayment(connection, payer, "btc-usd");');

    // await fetchPriceWithPayment(connection, payer, 'btc-usd');

  } catch (error: any) {
    console.error('\n Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the demo
main();
