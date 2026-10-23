'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { decideAction } from '@/app/actions';
import { useToast } from './Toast';

/** Approve / Reject… with the reason form. Shown only while the item is undecided. */
export const DecisionPanel = ({
  queueId,
  approveLabel,
  approveBlock,
  rejectDisabled,
}: {
  queueId: string;
  approveLabel: string;
  approveBlock: string;
  rejectDisabled: boolean;
}) => {
  const router = useRouter();
  const say = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [pending, start] = useTransition();
  const err = tried && (!code || note.trim().length < 10) ? 'Choose a reason and write at least a short note — it goes into the audit log.' : '';

  const run = (decision: 'approve' | 'reject') =>
    start(async () => {
      const r = await decideAction(queueId, decision, decision === 'reject' ? code : undefined, decision === 'reject' ? note.trim() : undefined);
      if (!r.ok) say(r.error);
      else {
        setRejecting(false);
        setCode('');
        setNote('');
        setTried(false);
      }
      router.refresh();
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4, borderTop: '1px solid var(--row-divider)' }}>
      {rejecting ? (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 500 }}>
            Rejection reason
            <select className="in" value={code} onChange={(e) => setCode(e.target.value)}>
              <option value="">Select a reason</option>
              <option value="screening">Destination failed screening</option>
              <option value="evidence">Insufficient supporting evidence</option>
              <option value="limits">Exceeds customer limits</option>
              <option value="customer">Customer asked to cancel</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 500 }}>
            Note for the audit log
            <textarea className="in" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you check, and why reject?" />
          </label>
          {err ? (
            <span role="alert" style={{ fontSize: 12.5, color: 'var(--neg)' }}>
              {err}
            </span>
          ) : null}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setRejecting(false);
                setTried(false);
              }}
            >
              Back
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={pending}
              onClick={() => {
                if (!code || note.trim().length < 10) {
                  setTried(true);
                  return;
                }
                run('reject');
              }}
            >
              Confirm rejection
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-danger" disabled={rejectDisabled || pending} onClick={() => setRejecting(true)}>
              Reject…
            </button>
            <button type="button" className="btn btn-primary" disabled={!!approveBlock || pending} onClick={() => run('approve')}>
              {approveLabel}
            </button>
          </div>
          {approveBlock ? <span style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>{approveBlock}</span> : null}
        </>
      )}
    </div>
  );
};
