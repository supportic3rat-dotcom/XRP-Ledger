import { formatXrp } from '@xrp/ledger';

/** "1,250.00" */
export const xrp2 = (drops: bigint): string => formatXrp(drops);
/** "84,210.250036": six decimals (hot wallet rows, where fees land). */
export const xrp6 = (drops: bigint): string => formatXrp(drops, { minDecimals: 6, maxDecimals: 6 });
/** Two decimals when whole cents, otherwise six ("1,284,610.25" / "1,284,610.250036"). */
export const xrpAuto = (drops: bigint): string => (drops % 10_000n === 0n ? xrp2(drops) : xrp6(drops));
/** Whole XRP with separators ("41,280"). */
export const xrp0 = (drops: bigint): string => formatXrp(drops, { minDecimals: 0, maxDecimals: 0 });
/** Signed difference: "0", or "−0.000036" with the typographic minus. */
export const xrpDiff = (drops: bigint): string => (drops === 0n ? '0' : `${drops < 0n ? '−' : '+'}${xrpAuto(drops < 0n ? -drops : drops)}`);

const WAT = 'Africa/Lagos';
/** "12:52" in West Africa Time. */
export const hm = (d: Date): string => new Intl.DateTimeFormat('en-GB', { timeZone: WAT, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
/** "Oct 12" */
export const md = (d: Date): string => new Intl.DateTimeFormat('en-US', { timeZone: WAT, month: 'short', day: 'numeric' }).format(d);
const sameDay = (a: Date, b: Date) => md(a) === md(b);
/** "Today 12:30" / "Oct 12 16:20" */
export const when = (d: Date, now: Date): string => `${sameDay(d, now) ? 'Today' : md(d)} ${hm(d)}`;
/** "22m", "1h 05m", "3h", "2d" */
export const age = (from: Date, now: Date): string => {
  const mins = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h >= 48) return `${Math.floor(h / 24)}d`;
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`;
};

/** Short address like the design: "rHotProto…9xQb". */
export const shortAddr = (a: string, head = 9, tail = 4): string => (a.length <= head + tail + 1 ? a : `${a.slice(0, head)}…${a.slice(-tail)}`);
