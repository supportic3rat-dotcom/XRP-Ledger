/**
 * Date formatting in the customer's own time zone (the phone's), US style: "Oct 12", "2:42 PM", "EDT".
 * Formatting is done by hand so Hermes and the web render identically.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');

/** The phone's short time-zone name ("EDT"), or '' where the platform doesn't provide one. */
const zone = (d: Date): string => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
};

/** Shifts by the phone's UTC offset at that moment (daylight saving included), so the UTC getters read local time. */
const shift = (iso: string | Date): Date => {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
};
const dayKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
const withZone = (iso: string, text: string): string => {
  const z = zone(new Date(iso));
  return z ? `${text} ${z}` : text;
};

/** "2:42 PM" */
export const hm = (iso: string): string => {
  const d = shift(iso);
  const h = d.getUTCHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(d.getUTCMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
};
/** "Oct 12" */
export const md = (iso: string): string => {
  const d = shift(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
/** "Oct 3, 8:12 AM" */
export const mdhm = (iso: string): string => `${md(iso)}, ${hm(iso)}`;
/** "Sep 2, 2026 · 10:14 AM EDT" */
export const mdyhm = (iso: string): string => withZone(iso, `${md(iso)}, ${shift(iso).getUTCFullYear()} · ${hm(iso)}`);
/** "Mon, Oct 19 · 11:42 AM EDT" */
export const longWhen = (iso: string): string => withZone(iso, `${DAYS[shift(iso).getUTCDay()]}, ${md(iso)} · ${hm(iso)}`);
/** "11:42 AM EDT" — a time with the phone's zone, for "updated at" lines. */
export const hmz = (iso: string): string => withZone(iso, hm(iso));
export const isSameDay = (a: string, now: Date): boolean => dayKey(shift(a)) === dayKey(shift(now));
/** "Today, 11:42 AM" when today, else "Oct 12". */
export const listDate = (iso: string, now: Date): string => (isSameDay(iso, now) ? `Today, ${hm(iso)}` : md(iso));
/** Step timestamps: "11:42 AM" today or same day as the transaction, else "Oct 3, 8:12 AM" / "Sep 18". */
export const stepTime = (iso: string, txIso: string, withTime = true): string =>
  dayKey(shift(iso)) === dayKey(shift(txIso)) ? hm(iso) : withTime ? mdhm(iso) : md(iso);
/** "Sep 2, 2026" */
export const mdy = (iso: string): string => `${md(iso)}, ${shift(iso).getUTCFullYear()}`;
