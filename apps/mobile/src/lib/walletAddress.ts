import { WALLET_NETWORKS, isNetworkAddress } from '@xrp/ledger';
import { parseAddressInput } from './xrpl';

/**
 * Reads an address from a scanned QR code or pasted text: a bare address, or a wallet link such as
 * `bitcoin:bc1…?amount=1`, `ethereum:0x…@1`, `solana:…`, `xrpl:r…?dt=42`. Returns the networks the address could be
 * on (several for `0x…` addresses, which are the same on every EVM chain).
 */
export const readWalletAddress = (text: string): { address: string; tag: number | null; networks: string[] } | null => {
  const raw = text.trim();
  if (!raw) return null;
  const xrp = parseAddressInput(raw);
  if (xrp && isNetworkAddress('xrp', xrp.address)) return { address: xrp.address, tag: xrp.tag, networks: ['xrp'] };
  const candidate = raw
    .replace(/^[a-z][a-z0-9+.-]*:(\/\/)?/i, '') // scheme
    .split(/[?#]/)[0]!
    .replace(/@\d+$/, '') // EIP-681 chain id
    .replace(/\/.*$/, '')
    .trim();
  const matches = WALLET_NETWORKS.filter((n) => n.address.test(candidate)).map((n) => n.id);
  // Solana's format (any 32–44 base58 characters) also fits Bitcoin, Tron, Litecoin and Dogecoin addresses; a more
  // specific match wins.
  const networks = matches.length > 1 ? matches.filter((id) => id !== 'solana') : matches;
  return networks.length ? { address: candidate, tag: null, networks } : null;
};
