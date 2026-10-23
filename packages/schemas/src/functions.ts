import { ASSET_IDS, isAssetAddress, type AssetId } from '@xrp/ledger';
import { z } from 'zod';
import { BACKUP_CODE, EMAIL, isStrongPassword } from './forms.ts';

/** Edge Function request bodies. Amounts travel as decimal strings of drops/cents, never floats. */
const drops = z.string().regex(/^\d+$/, 'Amount must be an integer number of drops');
const cents = z.string().regex(/^\d+$/, 'Amount must be an integer number of cents');
const address = z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/);
const uuid = z.string().uuid();
/** Asset of a money request. Omitted means XRP, so older clients keep working. */
const asset = z.enum(ASSET_IDS as [AssetId, ...AssetId[]]).default('XRP');
const anyAddress = z.string().trim().min(10).max(120);
const txHash = z.string().trim().min(8).max(130).regex(/^[A-Za-z0-9:_-]+$/, 'That doesn’t look like a transaction hash');
const tag = z
  .string()
  .regex(/^\d{1,10}$/)
  .refine((t) => BigInt(t) <= 4294967295n, 'Destination tag is too large');
/** Checks an address against the request's asset network. */
const addressFor = <T extends { asset: string; destination?: string; address?: string }>(v: T, ctx: z.RefinementCtx) => {
  const a = v.destination ?? v.address ?? '';
  if (!isAssetAddress(v.asset, a)) ctx.addIssue({ code: 'custom', path: [v.destination !== undefined ? 'destination' : 'address'], message: `Not a valid ${v.asset} address` });
};
const legalDocument = z.enum(['tos', 'privacy', 'risk', 'custody', 'deposits', 'fees', 'yield', 'lending', 'complaints']);

export const fnSchemas = {
  'withdraw-request': z
    .object({
      asset,
      amountDrops: drops,
      destination: anyAddress,
      destinationTag: tag.nullable(),
      memo: z.string().trim().max(64).nullable().optional(),
      totpCode: z.string().regex(/^\d{6}$/),
    })
    .superRefine(addressFor),
  'withdraw-cancel': z.object({ transactionId: z.string().uuid() }),
  /** `requote` asks for a fresh firm quote on an existing request (amount ignored). */
  'exchange-request': z.object({ asset, amountDrops: drops, toAsset: z.enum(ASSET_IDS as [AssetId, ...AssetId[]]).nullable().optional(), requote: uuid.optional() }),
  'quote-current': z.object({ transactionId: uuid }),
  'deposit-address': z.object({ asset }),
  /** Customer reports a deposit of a non-XRP asset sent to the platform address; staff confirm it on the network. */
  'deposit-report': z.object({ asset, amountUnits: drops, txHash, from: z.string().trim().max(120).nullable().optional() }),
  'price-history': z.object({ asset: z.string().regex(/^[A-Z]{2,6}$/), period: z.enum(['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL']) }),
  'mfa-backup-verify': z.object({ code: z.string().toUpperCase().regex(BACKUP_CODE) }),
  'security-update': z.discriminatedUnion('action', [
    z.object({ action: z.literal('backup-codes') }),
    z.object({ action: z.literal('backup-codes-regenerate') }),
    z.object({ action: z.literal('custody-status') }),
    z.object({ action: z.literal('mfa-enable') }),
    z.object({ action: z.literal('mfa-disable') }),
    z.object({ action: z.literal('allowlist-toggle'), enabled: z.boolean() }),
    z.object({ action: z.literal('password-change'), current: z.string().min(1), next: z.string().refine(isStrongPassword, 'Password is too weak') }),
  ]),
  'external-wallet': z.discriminatedUnion('action', [
    z.object({ action: z.literal('add'), address, access: z.enum(['watch', 'self_custody']) }),
    z.object({ action: z.literal('remove'), address }),
  ]),
  'ticket-create-public': z.object({ topic: z.string().min(1), message: z.string().trim().min(20).max(4000), email: z.string().trim().regex(EMAIL) }),
  'exchange-accept': z.object({ transactionId: z.string().uuid(), quoteId: z.string().uuid() }),
  'exchange-cancel': z.object({ transactionId: z.string().uuid() }),
  'yield-allocate': z.object({ asset, amountDrops: drops, termsVersion: z.string() }),
  'yield-redeem': z.object({ asset, amountDrops: drops }),
  'loan-apply': z.object({ asset, collateralDrops: drops, principalCents: cents, agreementVersion: z.string() }),
  'loan-repay': z.object({ loanId: z.string().uuid(), amountCents: cents, via: z.enum(['bank', 'sell']) }),
  'loan-add-collateral': z.object({ loanId: z.string().uuid(), amountDrops: drops, acknowledged: z.literal(true) }),
  'kyc-session': z.object({ documentType: z.enum(['passport', 'national', 'licence']), country: z.string(), addressDocument: z.enum(['bank', 'utility']) }),
  'ticket-create': z.object({ topic: z.string().min(1), transactionRef: z.string().nullable(), message: z.string().min(20) }),
  'ticket-reply': z.object({ ticketRef: z.string(), message: z.string().min(1) }),
  'consent-accept': z.object({ document: legalDocument, version: z.string().min(1) }),
  'allowlist-add': z
    .object({ asset, label: z.string().min(1), address: anyAddress, tag: z.string().nullable(), memo: z.string().trim().max(64).nullable().optional() })
    .superRefine(addressFor),
  'allowlist-remove': z.object({ id: z.string().uuid() }),
  'device-revoke': z.object({ deviceId: z.string().uuid() }),
  'approval-decide': z.object({
    approvalId: z.string().uuid(),
    decision: z.enum(['approve', 'reject']),
    reason: z.enum(['screening', 'evidence', 'limits', 'customer']).optional(),
    note: z.string().optional(),
  }),
  'recon-run': z.object({}),
  'recon-adjust': z.object({ exceptionId: z.string().uuid(), reason: z.string().min(10) }),
  'recon-contact': z.object({ exceptionId: z.string().uuid() }),
  'customer-freeze': z.object({ customerId: z.string().uuid(), frozen: z.boolean() }),
  'customer-flag': z.object({ customerId: z.string().uuid(), note: z.string() }),
  'policy-decide': z.object({ policyChangeId: z.string().uuid(), decision: z.enum(['approve', 'decline']) }),
  'audit-export': z.object({ filter: z.enum(['all', 'staff', 'customer', 'system']) }),
  'deposit-attribute': z.object({ transactionId: uuid, customerId: uuid }),
  'customer-open': z.object({ customerId: uuid }),
  /** Staff record a deposit they've seen arrive; another staff member approves the credit. */
  'deposit-record': z.object({ customerId: uuid, asset, amountUnits: drops, txHash, note: z.string().trim().max(500).default('') }),
  /** Staff mark an approved non-XRP withdrawal as sent (with the network hash) or failed (funds returned). */
  'withdrawal-complete': z.discriminatedUnion('action', [
    z.object({ action: z.literal('sent'), transactionId: uuid, txHash }),
    z.object({ action: z.literal('failed'), transactionId: uuid, reason: z.string().trim().min(10) }),
  ]),
  /** Compliance sets where customers send each asset, or closes deposits for it. */
  'asset-update': z.object({ asset, depositAddress: z.string().trim().max(120).nullable(), memo: z.string().trim().max(64).nullable(), enabled: z.boolean() }),
} as const;

export type FnName = keyof typeof fnSchemas;
export type FnInput<N extends FnName> = z.infer<(typeof fnSchemas)[N]>;
