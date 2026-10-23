import type { CheckTone } from '@/lib/data/types';
import { Icon } from './Icon';

const ICON = { ok: 'check', warn: 'alertPath', wait: 'clockPath', bad: 'xCircle' } as const;
const COLOR = { ok: 'var(--pos)', warn: 'var(--warn)', wait: 'var(--text-3)', bad: 'var(--neg)' } as const;

/** One row of the Checks list: icon by outcome, label, note. */
export const Check = ({ label, note, tone }: { label: string; note: string; tone: CheckTone }) => (
  <div className="chk">
    <Icon name={ICON[tone]} small style={{ color: COLOR[tone], marginTop: 1 }} />
    <span style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{note}</span>
    </span>
  </div>
);
