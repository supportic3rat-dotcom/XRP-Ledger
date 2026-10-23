// Numeric layout check: extracts every text run (position, size, font, weight, colour, line-height, letter-spacing)
// from the reference screens-html and from the app's web render, matches them by text in reading order, and
// reports any difference larger than the tolerance. Also compares input placeholders and values.
// Usage: node textdiff.mjs <appUrl> <refUrl> [--theme=dark|light] [--tol=0.6] [--width=390] [--height=844] [--json]
import puppeteer from 'puppeteer-core';

const [appUrl, refUrl, ...flags] = process.argv.slice(2);
const opt = Object.fromEntries(flags.map((f) => f.replace(/^--/, '').split('=')));
const tol = Number(opt.tol ?? 0.6);
const width = Number(opt.width ?? 390);
const height = Number(opt.height ?? 844);

const collect = () => {
  const out = [];
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = norm(node.textContent ?? '');
    if (!text) continue;
    const el = node.parentElement;
    if (!el || seen.has(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) continue;
    const r = rects[0];
    if (r.bottom < 0 || r.top > window.innerHeight * 4) continue;
    seen.add(el);
    out.push({
      text,
      x: Math.round(r.left * 10) / 10,
      y: Math.round(r.top * 10) / 10,
      w: Math.round(r.width * 10) / 10,
      lines: new Set(rects.map((q) => Math.round(q.top))).size,
      size: parseFloat(cs.fontSize),
      weight: /SemiBold/.test(cs.fontFamily) ? 600 : /Medium/.test(cs.fontFamily) ? 500 : /Regular/.test(cs.fontFamily) ? 400 : Number(cs.fontWeight),
      color: cs.color,
      lh: cs.lineHeight,
      ls: cs.letterSpacing,
      family: cs.fontFamily
        .split(',')[0]
        .replace(/["']/g, '')
        .replace(/_\d+\w+$/, '')
        .replace('GeistMono', 'Geist Mono'),
      underline: cs.textDecorationLine.includes('underline'),
    });
  }
  for (const input of document.querySelectorAll('input, textarea')) {
    const r = input.getBoundingClientRect();
    if (!r.width) continue;
    const cs = getComputedStyle(input);
    out.push({
      text: `[input:${input.placeholder || input.value || input.type}]`,
      x: Math.round(r.left),
      y: Math.round(r.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
      size: parseFloat(cs.fontSize),
      weight: /SemiBold/.test(cs.fontFamily) ? 600 : /Medium/.test(cs.fontFamily) ? 500 : /Regular/.test(cs.fontFamily) ? 400 : Number(cs.fontWeight),
      color: cs.color,
      lh: '',
      ls: cs.letterSpacing,
      family: cs.fontFamily
        .split(',')[0]
        .replace(/["']/g, '')
        .replace(/_\d+\w+$/, '')
        .replace('GeistMono', 'Geist Mono'),
      lines: 1,
      underline: false,
    });
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
};

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const grab = async (url) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  if (opt.theme)
    await page.evaluateOnNewDocument((t) => localStorage.setItem('xrp-preferences', JSON.stringify({ state: { theme: t }, version: 0 })), opt.theme);
  await page.goto(url, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => document.body.innerText.trim().length > 0, { timeout: 120000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 1500));
  const runs = await page.evaluate(collect);
  await page.close();
  return runs;
};

const [app, ref] = [await grab(appUrl), await grab(refUrl)];
await browser.close();

const issues = [];
const used = new Set();
for (const r of ref) {
  const i = app.findIndex((a, idx) => !used.has(idx) && a.text === r.text);
  if (i < 0) {
    issues.push(`MISSING  "${r.text.slice(0, 60)}" (ref at ${r.x},${r.y})`);
    continue;
  }
  used.add(i);
  const a = app[i];
  const d = [];
  if (Math.abs(a.x - r.x) > tol || Math.abs(a.y - r.y) > tol)
    d.push(`pos ${a.x},${a.y} vs ${r.x},${r.y} (Δ${(a.x - r.x).toFixed(1)},${(a.y - r.y).toFixed(1)})`);
  if (Math.abs(a.w - r.w) > Math.max(1.5, r.w * 0.02)) d.push(`width ${a.w} vs ${r.w}`);
  if (r.h !== undefined && Math.abs((a.h ?? 0) - r.h) > tol) d.push(`height ${a.h} vs ${r.h}`);
  if (a.size !== r.size) d.push(`size ${a.size} vs ${r.size}`);
  if (a.weight !== r.weight) d.push(`weight ${a.weight} vs ${r.weight}`);
  if (a.color !== r.color) d.push(`color ${a.color} vs ${r.color}`);
  if (a.lines !== r.lines) d.push(`lines ${a.lines} vs ${r.lines}`);
  if (a.family !== r.family) d.push(`family ${a.family} vs ${r.family}`);
  if (a.underline !== r.underline) d.push(`underline ${a.underline} vs ${r.underline}`);
  if (a.ls !== r.ls && !(a.ls === 'normal' && r.ls === '0px') && !(a.ls === '0px' && r.ls === 'normal')) d.push(`ls ${a.ls} vs ${r.ls}`);
  if (d.length) issues.push(`DIFF     "${r.text.slice(0, 50)}": ${d.join('; ')}`);
}
app.forEach((a, idx) => {
  if (!used.has(idx) && a.y < height) issues.push(`EXTRA    "${a.text.slice(0, 60)}" (app at ${a.x},${a.y})`);
});
if (opt.json) console.log(JSON.stringify({ issues, app, ref }, null, 2));
else {
  console.log(issues.length ? issues.join('\n') : 'All text runs match.');
  console.log(`\n${ref.length} reference runs, ${issues.length} issues`);
}
