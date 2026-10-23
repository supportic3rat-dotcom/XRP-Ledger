/** Funds a testnet hot wallet for local development and prints the env and SQL to use it. */
import { Client } from 'xrpl';

const client = new Client('wss://s.altnet.rippletest.net:51233');
await client.connect();
const { wallet, balance } = await client.fundWallet();
console.log(`Funded ${wallet.address} with ${balance} XRP (testnet)\n`);
console.log(`TESTNET_HOT_WALLET_SEED=${wallet.seed}`);
console.log(`\nupdate public.custody_wallets set address = '${wallet.address}' where id = 'hot';`);
await client.disconnect();
