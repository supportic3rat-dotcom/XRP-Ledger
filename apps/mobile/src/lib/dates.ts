/**
 * Date formatting in the customer's display timezone. The design shows West Africa Time (UTC+1);
 * formatting is done with a fixed offset so Hermes and the web render identically.
 */
export const DISPLAY_TZ = { label: 'WAT', offsetMinutes: 60 } as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');

const shift = (iso: string | Date): Date => {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Date(d.getTime() + DISPLAY_TZ.offsetMinutes * 60_000);
};
const dayKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;

/** "11:42" */
export const hm = (iso: string): string => {
  const d = shift(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
/** "Oct 12" */
export const md = (iso: string): string => {
  const d = shift(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
/** "Oct 3, 08:12" */
export const mdhm = (iso: string): string => `${md(iso)}, ${hm(iso)}`;
/** "Sep 2, 2026 · 10:14 WAT" */
export const mdyhm = (iso: string): string => {
  const d = shift(iso);
  return `${md(iso)}, ${d.getUTCFullYear()} · ${hm(iso)} ${DISPLAY_TZ.label}`;
};
/** "Mon, Oct 19 · 11:42 WAT" */
export const longWhen = (iso: string): string => {
  const d = shift(iso);
  return `${DAYS[d.getUTCDay()]}, ${md(iso)} · ${hm(iso)} ${DISPLAY_TZ.label}`;
};
export const isSameDay = (a: string, now: Date): boolean => dayKey(shift(a)) === dayKey(shift(now));
/** "Today, 11:42" when today, else "Oct 12". */
export const listDate = (iso: string, now: Date): string => (isSameDay(iso, now) ? `Today, ${hm(iso)}` : md(iso));
/** Step timestamps: "11:42" today or same day as the transaction, else "Oct 3, 08:12" / "Sep 18". */
export const stepTime = (iso: string, txIso: string, withTime = true): string =>
  dayKey(shift(iso)) === dayKey(shift(txIso)) ? hm(iso) : withTime ? mdhm(iso) : md(iso);
/** "Sep 2, 2026" */
export const mdy = (iso: string): string => `${md(iso)}, ${shift(iso).getUTCFullYear()}`;
