import { deriveAddress, deriveKeypair, generateSeed } from 'ripple-keypairs';

/**
 * Xaman (formerly Xumm) "Secret Numbers": 8 rows of 6 digits instead of a word phrase. Each row is a 5-digit value
 * (two bytes of the 16-byte seed entropy) and a check digit. Same derivation as the XRPL Foundation's
 * `xrpl-secret-numbers` (family seed from the entropy, secp256k1).
 */
export const ROWS = 8;

/** The row's check digit is right: (value × (2 × position + 1)) mod 9. */
export const isValidRow = (position: number, row: string): boolean => {
  if (!/^\d{6}$/.test(row)) return false;
  const value = Number(row.slice(0, 5));
  return value <= 0xffff && (value * (position * 2 + 1)) % 9 === Number(row[5]);
};

export const areValidSecretNumbers = (rows: string[]): boolean => rows.length === ROWS && rows.every((r, i) => isValidRow(i, r));

export const secretNumbersToSeed = (rows: string[]): string => {
  if (!areValidSecretNumbers(rows)) throw new Error('Those numbers aren’t right. Check each row of 6 digits.');
  const entropy = new Uint8Array(16);
  rows.forEach((r, i) => {
    const value = Number(r.slice(0, 5));
    entropy[i * 2] = value >> 8;
    entropy[i * 2 + 1] = value & 0xff;
  });
  return generateSeed({ entropy, algorithm: 'ecdsa-secp256k1' });
};

/** The wallet behind a set of Secret Numbers. */
export const secretNumbersToWallet = (rows: string[]): { classicAddress: string; publicKey: string; privateKey: string } => {
  const keys = deriveKeypair(secretNumbersToSeed(rows));
  return { classicAddress: deriveAddress(keys.publicKey), publicKey: keys.publicKey, privateKey: keys.privateKey };
};

/** An XRP Ledger secret key ("family seed", starting with s…), as Crossmark, GemWallet and XRP Toolkit show it. */
export const isValidSecretKey = (seed: string): boolean => {
  try {
    return /^s[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(seed.trim()) && !!deriveKeypair(seed.trim()).publicKey;
  } catch {
    return false;
  }
};
