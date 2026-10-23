/** Dates in West Africa Time, independent of the viewer's timezone. */
const WAT = 'Africa/Lagos';
const parts = (d: Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: WAT,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return { year: p.year ?? '', month: p.month ?? '', day: p.day ?? '', weekday: p.weekday ?? '', hm: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
};
export const hm = (d: Date) => parts(d).hm;
export const md = (d: Date) => `${parts(d).month} ${parts(d).day}`;
export const weekday = (d: Date) => parts(d).weekday;
export const year = (d: Date) => parts(d).year;
export const monthYear = (d: Date) => `${parts(d).month} ${parts(d).year}`;
export const sameDay = (a: Date, b: Date) => md(a) === md(b) && year(a) === year(b);
/** "Today, 11:42" / "Oct 17, 16:08" */
export const listDate = (d: Date, now: Date) => `${sameDay(d, now) ? 'Today' : md(d)}, ${hm(d)}`;
