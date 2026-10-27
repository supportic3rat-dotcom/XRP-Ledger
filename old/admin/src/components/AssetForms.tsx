'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { completeWithdrawalAction, recordDepositAction, updateAssetAction } from '@/app/actions';
import type { ActionResult } from '@/lib/data/types';
import { useToast } from './Toast';

const label = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 500 } as const;

const useRun = () => {
  const router = useRouter();
  const say = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (r.message) say(r.message);
        onOk?.();
      } else say(r.error);
      router.refresh();
    });
  return { pending, run };
};

/** Record a deposit seen arriving on the network for this customer. Another staff member approves the credit. */
export const RecordDepositForm = ({ customerId, assets, disabled }: { customerId: string; assets: { id: string; name: string }[]; disabled: boolean }) => {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [asset, setAsset] = useState(assets[0]?.id ?? 'BTC');
  const [amount, setAmount] = useState('');
  const [hash, setHash] = useState('');
  const [note, setNote] = useState('');
  if (!open) {
    return (
      <button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => setOpen(true)}>
        Record a deposit
      </button>
    );
  }
  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--sunken)' }}>
      <h3 className="sec-t" style={{ margin: 0 }}>
        Record a deposit
      </h3>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-3)' }}>
        For coins that arrived at a platform address. It goes to the approval queue; a different staff member confirms it on the network and approves the
        credit.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ ...label, flex: '1 1 120px' }}>
          Asset
          <select className="in" value={asset} onChange={(e) => setAsset(e.target.value)}>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ ...label, flex: '1 1 140px' }}>
          Amount received
          <input className="in num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" />
        </label>
      </div>
      <label style={label}>
        Network transaction hash
        <input className="in mono" value={hash} onChange={(e) => setHash(e.target.value.trim())} placeholder="Paste from the block explorer" />
      </label>
      <label style={label}>
        Note (optional)
        <input className="in" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. matched by memo, customer ticket SUP-…" />
      </label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          aria-busy={pending || undefined}
          onClick={() =>
            run(
              () => recordDepositAction(customerId, asset, amount, hash, note),
              () => {
                setOpen(false);
                setAmount('');
                setHash('');
                setNote('');
              },
            )
          }
        >
          Send for approval
        </button>
      </div>
    </div>
  );
};

/** An approved non-XRP withdrawal: staff send it from the platform wallet, then record the hash (or mark it failed). */
export const ManualSendPanel = ({ txId, asset, network, disabled }: { txId: string; asset: string; network: string; disabled: boolean }) => {
  const { pending, run } = useRun();
  const [mode, setMode] = useState<'sent' | 'failed'>('sent');
  const [value, setValue] = useState('');
  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--sunken)' }}>
      <h3 className="sec-t" style={{ margin: 0 }}>
        Send this withdrawal
      </h3>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-3)' }}>
        {`Send the ${asset} from the platform's ${network} wallet to the address above, then record the transaction hash. The fee is booked and the customer is notified. If it can't be sent, mark it failed to return the funds.`}
      </p>
      <div role="radiogroup" aria-label="Outcome" style={{ display: 'flex', gap: 8 }}>
        {(['sent', 'failed'] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} className={`btn ${mode === m ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode(m)}>
            {m === 'sent' ? 'Sent' : 'Failed'}
          </button>
        ))}
      </div>
      <label style={label}>
        {mode === 'sent' ? 'Network transaction hash' : 'Reason (goes into the audit log)'}
        {mode === 'sent' ? (
          <input className="in mono" value={value} onChange={(e) => setValue(e.target.value.trim())} placeholder="Paste from the block explorer" />
        ) : (
          <textarea className="in" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Why couldn't it be sent?" />
        )}
      </label>
      <button
        type="button"
        className={`btn ${mode === 'sent' ? 'btn-primary' : 'btn-danger'}`}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        onClick={() => run(() => completeWithdrawalAction(txId, mode, value), () => setValue(''))}
      >
        {mode === 'sent' ? 'Mark as sent' : 'Mark as failed · return funds'}
      </button>
      {disabled ? <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Read-only role: you can view but not act.</span> : null}
    </div>
  );
};

/** Compliance sets the address customers send an asset to, or closes deposits for it. */
export const AssetSettings = ({
  asset,
  network,
  address,
  memo,
  memoKind,
  enabled,
  canEdit,
}: {
  asset: string;
  network: string;
  address: string | null;
  memo: string | null;
  memoKind: 'tag' | 'memo' | null;
  enabled: boolean;
  canEdit: boolean;
}) => {
  const { pending, run } = useRun();
  const [a, setA] = useState(address ?? '');
  const [m, setM] = useState(memo ?? '');
  const [on, setOn] = useState(enabled);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={label}>
        {`Platform ${network} deposit address`}
        <input
          className="in mono"
          value={a}
          onChange={(e) => setA(e.target.value.trim())}
          placeholder="Not set — deposits closed"
          disabled={!canEdit}
          aria-describedby={`help-${asset}`}
        />
      </label>
      {memoKind === 'memo' ? (
        <label style={label}>
          Fixed memo (optional)
          <input className="in mono" value={m} onChange={(e) => setM(e.target.value)} placeholder="Blank: each customer's reference is used" disabled={!canEdit} />
        </label>
      ) : null}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} disabled={!canEdit} />
        {`${asset} enabled for customers`}
      </label>
      <span id={`help-${asset}`} style={{ fontSize: 12, color: 'var(--text-3)' }}>
        {canEdit
          ? `Checked against the ${network} address format. Every change is recorded in the audit log.`
          : 'Only Compliance can change deposit addresses.'}
      </span>
      {canEdit ? (
        <button
          type="button"
          className="btn btn-primary"
          style={{ alignSelf: 'flex-start' }}
          disabled={pending}
          aria-busy={pending || undefined}
          onClick={() => run(() => updateAssetAction(asset, a, m, on))}
        >
          Save
        </button>
      ) : null}
    </div>
  );
};
