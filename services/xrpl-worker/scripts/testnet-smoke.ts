/**
 * End-to-end check against the XRPL testnet, without a database: a tagged payment into a fresh "hot wallet"
 * is detected by the worker's chain adapter and deposit rules, and a withdrawal signed by the testnet signer
 * validates. Run: pnpm --filter @xrp/xrpl-worker smoke
 */
import { Client } from 'xrpl';
import { xrplChain } from '../src/chain.ts';
import { classifyDeposit } from '../src/deposits.ts';
import { testnetCustody } from '../src/testnetCustody.ts';

const ENDPOINTS: [string, string] = ['wss://s.altnet.rippletest.net:51233', 'wss://testnet.xrpl-labs.com'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  const faucet = new Client(ENDPOINTS[0]);
  await faucet.connect();
  const { wallet: hot } = await faucet.fundWallet();
  const { wallet: customer } = await faucet.fundWallet();
  console.log('funded', { hot: hot.address, customer: customer.address });

  const chain = await xrplChain(ENDPOINTS, (m) => console.log(m));
  const start = await chain.validatedLedger();

  const sent = await faucet.submitAndWait(
    { TransactionType: 'Payment', Account: customer.address, Destination: hot.address, Amount: '25000000', DestinationTag: 48201937 },
    { wallet: customer },
  );
  const end = await chain.validatedLedger();
  const found = [];
  for await (const t of chain.accountTx(hot.address, start, end)) found.push(classifyDeposit(t, new Set([hot.address]), new Set([hot.address])));
  const deposit = found.find((d) => d.kind === 'deposit');
  console.log('deposit', deposit && { ...deposit, amountDrops: deposit.kind === 'deposit' ? deposit.amountDrops.toString() : '' });
  if (!deposit || deposit.kind !== 'deposit' || deposit.amountDrops !== 25_000_000n || deposit.tag !== 48201937 || deposit.hash !== sent.result.hash)
    throw new Error('deposit not detected');

  const custody = await testnetCustody(ENDPOINTS[0], hot.seed!);
  const last = (await chain.validatedLedger()) + 20;
  const key = `smoke-${Date.now()}`;
  const transfer = await custody.requestWithdrawal({
    idempotencyKey: key,
    destination: customer.address,
    destinationTag: null,
    amountDrops: 10_000_000n,
    lastLedgerSequence: last,
  });
  const again = await sleep(6000).then(() =>
    custody.requestWithdrawal({ idempotencyKey: key, destination: customer.address, destinationTag: null, amountDrops: 10_000_000n, lastLedgerSequence: last }),
  );
  console.log('withdrawal submitted', transfer.id, 'retry returned', again.id);
  if (again.id !== transfer.id) throw new Error('idempotency failed: a retry submitted a second payment');

  for (let i = 0; i < 20; i++) {
    const t = await chain.tx(transfer.id);
    if (t?.validated && typeof t.meta === 'object') {
      console.log('withdrawal', t.meta.TransactionResult, 'ledger', t.ledgerIndex, 'fee', t.tx.Fee, 'delivered', t.meta.delivered_amount);
      if (t.meta.TransactionResult !== 'tesSUCCESS') throw new Error('withdrawal failed');
      console.log('SMOKE OK');
      process.exit(0);
    }
    await sleep(2000);
  }
  throw new Error('withdrawal not validated in time');
};

main().catch((e) => {
  console.error('SMOKE FAILED', e);
  process.exit(1);
});
