import { z } from 'zod';
import {
  assetLimits,
  formatAmount,
  formatUsd,
  formatXrp,
  isDestinationTag,
  isXrplAddress,
  MIN_COLLATERAL_TOPUP_DROPS,
  MIN_EXCHANGE_DROPS,
  MIN_LOAN_CENTS,
  MIN_LOAN_COLLATERAL_DROPS,
  MIN_WITHDRAWAL_DROPS,
  MIN_YIELD_DROPS,
  parseUsd,
  parseXrp,
} from '@xrp/ledger';
import { msg } from './messages.ts';

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const BACKUP_CODE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export const passwordRules = (value: string) => [
  { label: '12+ characters', met: value.length >= 12 },
  { label: 'A number', met: /\d/.test(value) },
  { label: 'Upper and lower case', met: /[a-z]/.test(value) && /[A-Z]/.test(value) },
];
export const isStrongPassword = (value: string): boolean => passwordRules(value).every((r) => r.met);

export const signInSchema = z.object({
  email: z.string().trim().regex(EMAIL, msg.signInEmail),
  password: z.string().min(8, msg.signInPassword),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const otpSchema = (backup: boolean) =>
  z.object({ code: backup ? z.string().toUpperCase().regex(BACKUP_CODE, msg.otpBackup) : z.string().regex(/^\d{6}$/, msg.otpAuthenticator) });

export const resetSchema = z.object({ email: z.string().trim().regex(EMAIL, msg.signInEmail) });

export const createAccountSchema = z.object({
  name: z.string().refine((v) => v.trim().split(/\s+/).filter(Boolean).length >= 2, msg.name),
  email: z.string().trim().regex(EMAIL, msg.email),
  password: z.string().refine(isStrongPassword),
  country: z.string().min(1, msg.country),
  currency: z.string().regex(/^[A-Z]{3}$/),
  terms: z.literal(true, { error: msg.terms }),
  updates: z.boolean(),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const emailCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/) });

export const watchAddressSchema = z.object({
  address: z.string().trim().min(1, msg.publicAddressEmpty).refine(isXrplAddress, msg.publicAddressInvalid),
});

export const withdrawDestinationSchema = z
  .object({
    address: z.string().trim().min(1, msg.addrEmptyWithdraw).refine(isXrplAddress, msg.addrInvalidLong),
    tag: z.string(),
    noTag: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.noTag) return;
    if (!v.tag) ctx.addIssue({ code: 'custom', path: ['tag'], message: msg.tagMissing });
    else if (!isDestinationTag(v.tag)) ctx.addIssue({ code: 'custom', path: ['tag'], message: msg.tagInvalid });
  });

const amountIn = (
  parse: (s: string) => bigint | null,
  { empty, min, minMessage, max, maxMessage }: { empty: string; min: bigint; minMessage: string; max: bigint; maxMessage: string },
) =>
  z.string().superRefine((value, ctx) => {
    const parsed = parse(value);
    if (parsed === null || parsed <= 0n) ctx.addIssue({ code: 'custom', message: empty });
    else if (parsed < min) ctx.addIssue({ code: 'custom', message: minMessage });
    else if (parsed > max) ctx.addIssue({ code: 'custom', message: maxMessage });
  });

export const withdrawAmountSchema = (available: bigint) =>
  z.object({
    amount: amountIn(parseXrp, {
      empty: msg.enterAmount,
      min: MIN_WITHDRAWAL_DROPS,
      minMessage: msg.minWithdrawal,
      max: available,
      maxMessage: msg.overAvailable,
    }),
  });

export const withdrawOtpSchema = z.object({ code: z.string().regex(/^\d{6}$/, msg.otpWithdraw) });

export const exchangeRequestSchema = (available: bigint) =>
  z.object({
    amount: amountIn(parseXrp, {
      empty: msg.enterSellAmount,
      min: MIN_EXCHANGE_DROPS,
      minMessage: msg.minExchange,
      max: available,
      maxMessage: msg.overAvailable,
    }),
  });

export const yieldAllocateSchema = (available: bigint) =>
  z
    .object({
      amount: amountIn(parseXrp, {
        empty: msg.enterAmount,
        min: MIN_YIELD_DROPS,
        minMessage: msg.minAllocation,
        max: available,
        maxMessage: msg.overAvailable,
      }),
      terms: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (!v.terms) ctx.addIssue({ code: 'custom', path: ['amount'], message: msg.acceptProductTerms });
    });

export const yieldRedeemSchema = (allocated: bigint) =>
  z.object({
    amount: amountIn(parseXrp, {
      empty: msg.enterAmount,
      min: 1n,
      minMessage: msg.enterAmount,
      max: allocated,
      maxMessage: `You have ${formatXrp(allocated)} XRP allocated.`,
    }),
  });

export const repaySchema = (owed: bigint) =>
  z.object({
    amount: amountIn(parseUsd, {
      empty: msg.enterRepay,
      min: 1n,
      minMessage: msg.enterRepay,
      max: owed,
      maxMessage: `That’s more than you owe (${formatUsd(owed)}).`,
    }),
    via: z.enum(['bank', 'sell']),
  });

export const collateralTopUpSchema = (available: bigint) =>
  z.object({
    amount: amountIn(parseXrp, {
      empty: msg.minTopUp,
      min: MIN_COLLATERAL_TOPUP_DROPS,
      minMessage: msg.minTopUp,
      max: available,
      maxMessage: `You only have ${formatXrp(available)} XRP available.`,
    }),
  });

export const loanEstimateError = (collateral: bigint, borrowCents: bigint, available: bigint, startLtvBps: number, asset = 'XRP'): string => {
  if (collateral > available) return `You only have ${formatAmount(available, asset)} available.`;
  if (asset === 'XRP' ? collateral < MIN_LOAN_COLLATERAL_DROPS : collateral < assetLimits(asset).minCollateral) {
    return asset === 'XRP' ? msg.minCollateral : `The minimum collateral is ${formatAmount(assetLimits(asset).minCollateral, asset, { minDecimals: 0, maxDecimals: 8 })}.`;
  }
  if (borrowCents < MIN_LOAN_CENTS) return msg.minLoan;
  if (startLtvBps > 5000) return msg.aboveStartLtv;
  return '';
};

export const changePasswordSchema = z
  .object({ current: z.string().min(8, msg.currentPassword), next: z.string(), confirm: z.string() })
  .superRefine((v, ctx) => {
    if (!isStrongPassword(v.next)) ctx.addIssue({ code: 'custom', path: ['next'], message: msg.newPasswordRules });
    if (v.confirm !== v.next) ctx.addIssue({ code: 'custom', path: ['confirm'], message: msg.passwordsMismatch });
  });

export const allowlistSchema = z.object({
  label: z.string().trim().min(1, msg.allowlistName),
  address: z.string().trim().refine(isXrplAddress, msg.validAddress),
  tag: z.string().refine((v) => v === '' || isDestinationTag(v)),
});

export const supportRequestSchema = z.object({
  topic: z.string().min(1, msg.chooseTopic),
  transactionRef: z.string(),
  message: z.string().refine((v) => v.trim().length >= 20, msg.tellMore),
});

export const rejectSchema = z.object({
  reason: z.enum(['screening', 'evidence', 'limits', 'customer']),
  note: z.string().refine((v) => v.trim().length >= 10, msg.rejectReason),
});
