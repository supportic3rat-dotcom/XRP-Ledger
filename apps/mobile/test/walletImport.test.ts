import { readWalletAddress } from '@/lib/walletAddress';
import { areValidSecretNumbers, isValidRow, secretNumbersProblem, secretNumbersToSeed, secretNumbersToWallet } from '@/lib/secretNumbers';
import { phraseProblem } from '@/lib/selfCustody';
import { parseAddressInput } from '@/lib/xrpl';

jest.mock('expo-local-authentication', () => ({ SecurityLevel: { NONE: 0, BIOMETRIC_WEAK: 2 } }));
jest.mock('expo-secure-store', () => ({}));

describe('reading a wallet address from a QR code or paste', () => {
  it.each([
    ['bitcoin:bc1qp5t249wzm3jzdtgadrzed6j2vqsxcuayv67ycc?amount=0.1', ['bitcoin'], 'bc1qp5t249wzm3jzdtgadrzed6j2vqsxcuayv67ycc'],
    ['TLriwtKfzQkth9uLtmWXcghCSvNqj28Kns', ['tron'], 'TLriwtKfzQkth9uLtmWXcghCSvNqj28Kns'],
    ['solana:6rLbe3VkK29hhtC4yQErCZabheksU3ojg7D1KXa4wQbt', ['solana'], '6rLbe3VkK29hhtC4yQErCZabheksU3ojg7D1KXa4wQbt'],
    ['cosmos1pfn5u03z34h6u5wh90fvwa9dxvjktj4x0u9zq9', ['cosmos'], 'cosmos1pfn5u03z34h6u5wh90fvwa9dxvjktj4x0u9zq9'],
    ['0.0.10930863', ['hedera'], '0.0.10930863'],
    ['litecoin:Ldkstpj7R35k7WAKYBZ7sjX5vaV4hU5Sre', ['litecoin'], 'Ldkstpj7R35k7WAKYBZ7sjX5vaV4hU5Sre'],
    ['DD8nWNGBk2RiShRpGESPrKk46YdghnkBTx', ['dogecoin'], 'DD8nWNGBk2RiShRpGESPrKk46YdghnkBTx'],
  ])('%s', (text, networks, address) => {
    const r = readWalletAddress(text);
    expect(r?.address).toBe(address);
    expect(r?.networks).toEqual(networks);
  });
  it('treats 0x addresses as any EVM network and keeps XRP tags', () => {
    expect(readWalletAddress('ethereum:0xc33B5D681Fdf4986921123f34156D6957Ab60656@1')?.networks.sort()).toEqual(['bnb', 'cronos', 'ethereum', 'flare', 'polygon']);
    expect(readWalletAddress('xrpl:rp489nfz7Q6KoHYkB6Uj3Ks4RtSoX4CfCV?dt=7')).toEqual({ address: 'rp489nfz7Q6KoHYkB6Uj3Ks4RtSoX4CfCV', tag: 7, networks: ['xrp'] });
    expect(readWalletAddress('hello world')).toBeNull();
    expect(parseAddressInput('ripple:rp489nfz7Q6KoHYkB6Uj3Ks4RtSoX4CfCV')?.address).toBe('rp489nfz7Q6KoHYkB6Uj3Ks4RtSoX4CfCV');
  });
});

describe('Xaman Secret Numbers', () => {
  const rows = '399150 474506 009147 088773 432160 282843 253738 605430'.split(' ');
  it('checks every row’s check digit, so a typo is caught as you type', () => {
    expect(areValidSecretNumbers(rows)).toBe(true);
    expect(isValidRow(0, '399151')).toBe(false);
    expect(isValidRow(0, '99999')).toBe(false);
    expect(isValidRow(0, '700002')).toBe(false); // value above two bytes
  });
  it('derives the family seed and address the XRPL Foundation library would', () => {
    // Same steps as xrpl-secret-numbers: rows → 16-byte entropy → secp256k1 family seed → keypair → address.
    expect(secretNumbersToSeed(rows)).toMatch(/^s[1-9A-HJ-NP-Za-km-z]{28}$/);
    const w = secretNumbersToWallet(rows);
    expect(w.publicKey.startsWith('03BFC2F7AE24')).toBe(true);
    expect(w.classicAddress).toBe('rQKQsPeE3iTRyfUypLhuq74gZdcRdwWqDp');
  });
  it('refuses a wrong set', () => {
    expect(() => secretNumbersToWallet([...rows.slice(0, 7), '605431'])).toThrow(/aren’t right/);
  });
});

describe('XRP secret key (family seed) import', () => {
  it('accepts a real secret key and rejects a typo', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { generateSeed } = require('ripple-keypairs') as typeof import('ripple-keypairs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isValidSecretKey } = require('@/lib/secretNumbers') as typeof import('@/lib/secretNumbers');
    const seed = generateSeed({ entropy: new Uint8Array(16).fill(7) });
    expect(isValidSecretKey(seed)).toBe(true);
    expect(isValidSecretKey(`${seed.slice(0, -1)}${seed.endsWith('a') ? 'b' : 'a'}`)).toBe(false);
    expect(isValidSecretKey('not-a-seed')).toBe(false);
  });
});

describe('alerting on a wrong phrase', () => {
  const good = [...Array<string>(11).fill('abandon'), 'about'];
  it('accepts a valid phrase', () => expect(phraseProblem(good)).toBeNull());
  it('names missing words', () => {
    const w = [...good];
    w[2] = '';
    w[6] = '';
    expect(phraseProblem(w)).toBe('Wrong phrase: words 3 and 7 are missing.');
  });
  it('names words that aren’t recovery words', () => {
    const w = [...good];
    w[4] = 'abandonn';
    expect(phraseProblem(w)).toBe('Wrong phrase: word 5 isn’t a recovery word. Check the spelling.');
  });
  it('catches real words in the wrong order', () => {
    expect(phraseProblem(['about', ...good.slice(0, 11)])).toContain('don’t make a valid recovery phrase');
  });
  it('names wrong Secret Numbers rows', () => {
    expect(secretNumbersProblem(Array<string>(8).fill('000000'))).toBeNull();
    expect(secretNumbersProblem(['000001', ...Array<string>(7).fill('000000')])).toBe('Wrong Secret Numbers: check row A.');
  });
});
