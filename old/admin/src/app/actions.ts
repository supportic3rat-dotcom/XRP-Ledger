'use server';

import { ASSET_IDS, parseUnits, type AssetId } from '@xrp/ledger';
import { z } from 'zod';
import type { ActionResult } from '@/lib/data/types';
import { session } from '@/lib/session';

/**
 * Server Actions for the console. Each re-reads the session, validates its input, and calls the data source,
 * which in Supabase mode goes through an Edge Function with the staff member's JWT (never a direct table write).
 */
const id = z.string().min(1).max(64);
const bad = (): ActionResult => ({ ok: false, error: 'Invalid request.' });

export const decideAction = async (queueId: string, decision: 'approve' | 'reject', reason?: string, note?: string): Promise<ActionResult> => {
  const parsed = z
    .object({
      queueId: id,
      decision: z.enum(['approve', 'reject']),
      reason: z.enum(['screening', 'evidence', 'limits', 'customer']).optional(),
      note: z.string().max(2000).optional(),
    })
    .safeParse({ queueId, decision, reason: reason || undefined, note: note || undefined });
  if (!parsed.success)
    return decision === 'reject' ? { ok: false, error: 'Choose a reason and write at least a short note — it goes into the audit log.' } : bad();
  const { data } = await session();
  return data.decide(parsed.data.queueId, parsed.data.decision, parsed.data.reason, parsed.data.note);
};

export const runReconAction = async (): Promise<ActionResult> => (await session()).data.runRecon();

export const bookFeeAction = async (exceptionId: string): Promise<ActionResult> =>
  id.safeParse(exceptionId).success ? (await session()).data.bookFee(exceptionId) : bad();

export const contactProviderAction = async (exceptionId: string): Promise<ActionResult> =>
  id.safeParse(exceptionId).success ? (await session()).data.contactProvider(exceptionId) : bad();

export const flagCustomerAction = async (customerId: string): Promise<ActionResult> =>
  id.safeParse(customerId).success ? (await session()).data.flagCustomer(customerId) : bad();

export const freezeAction = async (customerId: string, frozen: boolean): Promise<ActionResult> =>
  id.safeParse(customerId).success ? (await session()).data.setFrozen(customerId, frozen) : bad();

export const policyAction = async (changeId: string, decision: 'approve' | 'decline'): Promise<ActionResult> =>
  id.safeParse(changeId).success && ['approve', 'decline'].includes(decision) ? (await session()).data.decidePolicy(changeId, decision) : bad();

export const exportAuditAction = async (filter: 'all' | 'staff' | 'customer' | 'system'): Promise<ActionResult & { csv?: string; filename?: string }> => {
  if (!['all', 'staff', 'customer', 'system'].includes(filter)) return bad();
  return (await session()).data.exportAudit(filter);
};

const assetId = z.enum(ASSET_IDS as [AssetId, ...AssetId[]]);

export const updateAssetAction = async (asset: string, depositAddress: string, memo: string, enabled: boolean): Promise<ActionResult> => {
  const parsed = z
    .object({ asset: assetId, depositAddress: z.string().trim().max(120), memo: z.string().trim().max(64), enabled: z.boolean() })
    .safeParse({ asset, depositAddress, memo, enabled });
  if (!parsed.success) return bad();
  const v = parsed.data;
  return (await session()).data.updateAsset(v.asset, v.depositAddress || null, v.memo || null, v.enabled);
};

export const recordDepositAction = async (customerId: string, asset: string, amount: string, txHash: string, note: string): Promise<ActionResult> => {
  const parsed = z
    .object({ customerId: id, asset: assetId, amount: z.string().trim(), txHash: z.string().trim().min(8).max(130), note: z.string().trim().max(500) })
    .safeParse({ customerId, asset, amount, txHash, note });
  if (!parsed.success) return { ok: false, error: 'Enter the amount and the network transaction hash.' };
  const units = parseUnits(parsed.data.amount, parsed.data.asset);
  if (units === null || units <= 0n) return { ok: false, error: `Enter a valid ${parsed.data.asset} amount.` };
  return (await session()).data.recordDeposit(parsed.data.customerId, parsed.data.asset, units, parsed.data.txHash, parsed.data.note);
};

export const completeWithdrawalAction = async (txId: string, action: 'sent' | 'failed', value: string): Promise<ActionResult> => {
  if (!id.safeParse(txId).success || !['sent', 'failed'].includes(action)) return bad();
  const v = value.trim();
  if (action === 'sent' && v.length < 8) return { ok: false, error: 'Enter the transaction hash from the network.' };
  if (action === 'failed' && v.length < 10) return { ok: false, error: 'Write a short reason — it goes into the audit log.' };
  return (await session()).data.completeWithdrawal(txId, action === 'sent' ? { action: 'sent', txHash: v } : { action: 'failed', reason: v });
};
