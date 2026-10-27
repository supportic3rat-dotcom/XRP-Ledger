/**
 * Icon geometry copied from the inline SVGs in the design (24×24 grid, 1.6 stroke, round caps/joins).
 * Rendered by react-native-svg on mobile and inline <svg> on the web apps.
 */
export type IconShape =
  | { t: 'path'; d: string }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number };

const p = (d: string): IconShape => ({ t: 'path', d });
const circle = (cx: number, cy: number, r: number): IconShape => ({ t: 'circle', cx, cy, r });
const rect = (x: number, y: number, w: number, h: number, rx?: number): IconShape => ({ t: 'rect', x, y, w, h, ...(rx === undefined ? {} : { rx }) });

export const icons = {
  back: [p('M19 12H5M11 6l-6 6 6 6')],
  close: [p('M6 6l12 12M18 6L6 18')],
  chevronRight: [p('M9 6l6 6-6 6')],
  chevronDown: [p('M6 9l6 6 6-6')],
  check: [p('M5 12.5l4.5 4.5L19 7.5')],
  dot: [p('M12 12h.01')],
  plus: [p('M12 5v14M5 12h14')],
  shield: [p('M12 3.5l7 2.6v5.4c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6.1z')],
  shieldCheck: [p('M12 3.5l7 2.6v5.4c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6.1zM8.8 12.2l2.2 2.2 4.2-4.4')],
  info: [circle(12, 12, 8.5), p('M12 11v5M12 8h.01')],
  alert: [circle(12, 12, 8.5), p('M12 7.8v5M12 16.2h.01')],
  alertPath: [p('M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.8v5M12 16.2h.01')],
  clock: [circle(12, 12, 8.5), p('M12 7.5V12l3 2')],
  clockPath: [p('M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2')],
  xCircle: [p('M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM9 9l6 6M15 9l-6 6')],
  lock: [rect(5, 10.5, 14, 10, 2), p('M8 10.5V8a4 4 0 0 1 8 0v2.5')],
  lockSquare: [p('M5 10.5h14v10H5zM8 10.5V8a4 4 0 0 1 8 0v2.5')],
  lockHero: [rect(5, 10.5, 14, 10, 2), p('M8 10.5V8a4 4 0 0 1 8 0v2.5')],
  idCard: [p('M4 6.5h16v11H4zM8 10.5h3M8 13.5h5M15.5 10.5h1.5')],
  bell: [p('M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15z'), p('M10 20.5a2 2 0 0 0 4 0')],
  home: [p('M4 10.5L12 4l8 6.5V20h-5.5v-6h-5v6H4z')],
  markets: [p('M3.5 20h17'), p('M5 15.5l4-4.5 3.5 2.5L19 6')],
  earn: [
    { t: 'ellipse', cx: 12, cy: 6.5, rx: 7, ry: 2.5 },
    p('M5 6.5v5.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6.5'),
    p('M5 12v5.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V12'),
  ],
  borrow: [p('M4 17.5h16M6 13.5h12M8 9.5h8M10 5.5h4')],
  profile: [circle(12, 8.5, 3.5), p('M5 20c1.2-3.4 3.9-5 7-5s5.8 1.6 7 5')],
  deposit: [p('M12 4v11M7 10l5 5 5-5M5 19.5h14')],
  withdraw: [p('M12 20V9M7 14l5-5 5 5M5 4.5h14')],
  exchange: [p('M4 8.5h14l-3.5-3.5M20 15.5H6l3.5 3.5')],
  sprout: [p('M12 20V10M12 10c0-3 2-5 6-5 0 3.5-2 5-6 5zM12 13c0-2.5-1.7-4-5-4 0 3 1.7 4 5 4z')],
  history: [p('M4 12a8 8 0 1 0 2.3-5.7M4 5v4h4M12 8v4l3 2')],
  recv: [p('M17 7L7 17M15 17H7V9')],
  send: [p('M7 17L17 7M9 7h8v8')],
  arrowDown: [p('M12 5v14M6 13l6 6 6-6')],
  phone: [rect(7, 3.5, 10, 17, 2), p('M11 17.5h2')],
  phoneSquare: [p('M7 3.5h10v17H7zM11 17.5h2')],
  laptop: [p('M5 6h14v9H5zM3 18h18')],
  qr: [rect(4, 4, 6, 6, 1), rect(14, 4, 6, 6, 1), rect(4, 14, 6, 6, 1), p('M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2')],
  hardware: [rect(6, 3.5, 12, 17, 3), p('M10 8h4M12 13.5v3')],
  copy: [rect(8.5, 8.5, 11, 11, 2), p('M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2')],
  share: [p('M12 3.5v11M8 7.5l4-4 4 4'), p('M8.5 10.5H7a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1.5')],
  eye: [p('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z'), circle(12, 12, 2.8)],
  camera: [rect(3.5, 6, 17, 12, 2), circle(9, 12, 2.2), p('M13.5 10.5h4M13.5 13.5h3')],
  face: [circle(12, 9, 3.5), p('M5.5 19.5c1.2-3.2 3.7-4.8 6.5-4.8s5.3 1.6 6.5 4.8')],
  file: [p('M7 3.5h7l4 4V20.5H7z'), p('M14 3.5v4h4')],
  doc: [p('M7 3.5h7l4 4V20.5H7zM14 3.5v4h4')],
  upload: [p('M12 16V4M7 9l5-5 5 5M5 20h14')],
  mail: [rect(3.5, 5.5, 17, 13, 2), p('M4 7l8 6 8-6')],
  link: [p('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1')],
  search: [circle(11, 11, 6.5), p('M20 20l-4.2-4.2')],
  // Desktop dashboard
  grid: [rect(3.5, 3.5, 7, 7, 1.5), rect(13.5, 3.5, 7, 7, 1.5), rect(3.5, 13.5, 7, 7, 1.5), rect(13.5, 13.5, 7, 7, 1.5)],
  activity: [p('M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3')],
  help: [circle(12, 12, 8.5), p('M9.6 9.6a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2-2.4 3.6'), p('M12 17h.01')],
  settings: [p('M4 7h9M18 7h2M4 17h3M11 17h9'), circle(15.5, 7, 2.2), circle(8.5, 17, 2.2)],
  signOut: [p('M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10')],
  arrowUp: [p('M12 18V6M7 11l5-5 5 5')],
  arrowDownSmall: [p('M12 6v12M7 13l5 5 5-5')],
  receive: [p('M12 4v11M7 10l5 5 5-5'), p('M5 19.5h14')],
  card: [rect(3, 5.5, 18, 13, 2), p('M3 10h18M7 14.5h3')],
  checkCircle: [circle(12, 12, 8.5), p('M8.5 12.2l2.3 2.3 4.7-4.8')],
  book: [p('M5 4.5h9.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z'), p('M5 17a3 3 0 0 1 3-3h9.5')],
  retry: [p('M20 11a8 8 0 1 0-2.3 5.7'), p('M20 5v6h-6')],
  // Admin console
  adminOverview: [p('M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z')],
  adminQueue: [p('M9 11.5l2.2 2.2 4.3-4.4M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z')],
  adminRecon: [p('M4 12h4l2-5 4 10 2-5h4')],
  adminUsers: [
    p('M9 5.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zM3.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5M16 6.5a3 3 0 0 1 0 5.6M18.5 19c-.4-1.6-1.2-2.8-2.3-3.6'),
  ],
  adminAudit: [p('M7 4h10v16H7zM10 8h4M10 12h4M10 16h2')],
} satisfies Record<string, IconShape[]>;

export type IconName = keyof typeof icons;
