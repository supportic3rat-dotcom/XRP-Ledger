import { hasBackend } from './env';

export type WalletAppVia = 'mobile' | 'qr' | 'hw';

/**
 * Wallet-app connection (read-only: shares the public address, can't move funds).
 * Placeholder for [Wallet connection provider] (e.g. a deep-link / QR signing-request service). Until one is chosen
 * the mock resolves after a short wait with a sample address, so the flow can be exercised end to end.
 */
export const connectWalletApp = async (via: WalletAppVia): Promise<{ address: string }> => {
  if (hasBackend()) {
    throw new Error('Wallet-app connections need a [Wallet connection provider]. Add the address as watch-only for now.');
  }
  await new Promise((r) => setTimeout(r, via === 'hw' ? 3500 : 2500));
  return { address: 'rExtProtoWa11et9xQb7mKcV9tYwZ2' };
};
