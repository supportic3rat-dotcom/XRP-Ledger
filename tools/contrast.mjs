// WCAG 2.1 contrast check of text tokens against the surfaces they sit on (AA: 4.5:1 body text, 3:1 large text/UI).
// Usage: node tools/contrast.mjs   (reads packages/tokens through tsx)
import { adminColors, mobileDark, mobileLight, webColors } from '../packages/tokens/src/index.ts';

const parse = (c) => {
  const h = c.replace('#', '');
  if (h.length !== 6) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const lum = (rgb) => rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const check = (name, colors, texts, surfaces, min = 4.5) => {
  const fails = [];
  let n = 0;
  for (const t of texts) for (const s of surfaces) {
    const a = parse(colors[t] ?? ''), b = parse(colors[s] ?? '');
    if (!a || !b) continue;
    n++;
    const r = ratio(a, b);
    if (r < min) fails.push(`${t} on ${s}: ${r.toFixed(2)}:1`);
  }
  console.log(`${name}: ${n} pairs checked, ${fails.length ? fails.length + ' below ' + min + ':1' : 'all pass'}`);
  for (const f of fails) console.log(`  ✗ ${f}`);
  return fails.length;
};
let bad = 0;
for (const [label, c] of [['mobile dark', mobileDark], ['mobile light', mobileLight]]) {
  bad += check(label, c, ['text', 'text2', 'text3', 'pos', 'neg', 'warnText', 'accentText'].filter((k) => k in c), ['bg', 'surface', 'sunken'].filter((k) => k in c));
}
bad += check('admin', adminColors, ['text', 'text2', 'text3', 'pos', 'neg', 'warn'], ['bg', 'surface', 'sunken']);
bad += check('admin banners', adminColors, ['warnText'], ['warnSoft']) + check('admin banners', adminColors, ['badText'], ['negSoft']);
bad += check('web', webColors, Object.keys(webColors).filter((k) => /^text|^pos$|^neg$|^warn$/.test(k)), Object.keys(webColors).filter((k) => /canvas|surface/.test(k)));
process.exit(bad ? 1 : 0);
