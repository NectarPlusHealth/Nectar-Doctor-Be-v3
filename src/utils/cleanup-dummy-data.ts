/**
 * cleanup-dummy-data.ts
 *
 * One-time script to delete ALL seeded dummy data from the database:
 *   - wallets (Wallet collection)
 *   - earning_payments (EarningPayment collection)
 *   - payouts (Payout collection)
 *
 * This removes the hardcoded fake values that appeared for every user.
 * Real data will be computed on-the-fly from ChatPayment records.
 *
 * HOW TO RUN (from the Nectar-Doctor-Be-v3 directory):
 *   npx ts-node src/utils/cleanup-dummy-data.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env — mirrors src/config/environment.ts logic
const env = process.env.NODE_ENV || 'development';
const candidate = path.resolve(process.cwd(), `.env.${env}`);
const fallback  = path.resolve(process.cwd(), '.env');
const envPath   = fs.existsSync(candidate) ? candidate : fallback;
dotenv.config({ path: envPath });

const MONGO_URI = process.env.MONGO_URI || '';
if (!MONGO_URI) {
  console.error(`❌  MONGO_URI not found. Looked in: ${envPath}`);
  process.exit(1);
}

async function cleanup() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  console.log('Connected ✓');

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection failed - db is undefined');
  }

  // Delete ALL wallet records (they were seeded with fake balances)
  const walletResult = await db.collection('wallets').deleteMany({});
  console.log(`Deleted ${walletResult.deletedCount} wallet record(s)`);

  // Delete ALL earning payment records (fake Jane Doe / John Smith rows)
  const epResult = await db.collection('earningpayments').deleteMany({});
  console.log(`Deleted ${epResult.deletedCount} earning payment record(s)`);

  // Delete ALL payout records (fake UTR entries)
  const payoutResult = await db.collection('payouts').deleteMany({});
  console.log(`Deleted ${payoutResult.deletedCount} payout record(s)`);

  // Also delete any seeded KYC records that have status = 'not_submitted'
  // AND no real bank/pan data (i.e., auto-created stubs)
  const kycResult = await db.collection('kycs').deleteMany({
    status: 'not_submitted',
    'bank.ifsc': null,
    'pan.panNumber': null,
  });
  console.log(`Deleted ${kycResult.deletedCount} empty KYC stub record(s)`);

  console.log('\n✅  Cleanup complete. Restart your backend server.');
  await mongoose.disconnect();
  process.exit(0);
}

cleanup().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
