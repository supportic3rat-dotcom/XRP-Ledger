import { describe, expect, it } from 'vitest';
import { fnSchemas, otpSchema, withdrawDestinationSchema } from '../src/index.ts';

describe('Edge Function request schemas', () => {
  const wd = { amountDrops: '300000000', destination: 'rRecipXk3PaKcV9tYwZ2hNproto7Hd', destinationTag: '10293847', totpCode: '123456' };
  it('accept integer drops and refuse decimals, negatives and floats', () => {
    expect(fnSchemas['withdraw-request'].safeParse(wd).success).toBe(true);
    for (const amountDrops of ['300.5', '-1', '1e8', '']) expect(fnSchemas['withdraw-request'].safeParse({ ...wd, amountDrops }).success).toBe(false);
  });
  it('limit destination tags to 32 bits', () => {
    expect(fnSchemas['withdraw-request'].safeParse({ ...wd, destinationTag: '4294967295' }).success).toBe(true);
    expect(fnSchemas['withdraw-request'].safeParse({ ...wd, destinationTag: '4294967296' }).success).toBe(false);
  });
  it('require a well-formed XRP Ledger address', () => {
    expect(fnSchemas['allowlist-add'].safeParse({ label: 'x', address: '0xabc', tag: null }).success).toBe(false);
  });
  it('validate security actions by kind', () => {
    expect(fnSchemas['security-update'].safeParse({ action: 'password-change', current: 'a', next: 'weak' }).success).toBe(false);
    expect(fnSchemas['security-update'].safeParse({ action: 'allowlist-toggle', enabled: true }).success).toBe(true);
    expect(fnSchemas['security-update'].safeParse({ action: 'delete-everything' }).success).toBe(false);
  });
});

describe('form schemas', () => {
  it('backup codes are 8 letters/digits as XXXX-XXXX, case-insensitive', () => {
    expect(otpSchema(true).safeParse({ code: 'ab12-cd34' }).success).toBe(true);
    expect(otpSchema(true).safeParse({ code: '12345678' }).success).toBe(false);
  });
  it('authenticator codes are 6 digits', () => {
    expect(otpSchema(false).safeParse({ code: '123456' }).success).toBe(true);
    expect(otpSchema(false).safeParse({ code: '12345' }).success).toBe(false);
  });
  it('withdraw destination needs a valid address', () => {
    expect(withdrawDestinationSchema.safeParse({ address: 'not-an-address', tag: '' }).success).toBe(false);
  });
});
