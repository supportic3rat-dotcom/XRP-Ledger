// Screenshots app routes and screens-html references at an exact 390×844 viewport, 3× scale.
// Usage: node shots.mjs <outDir> <name=url> [name=url …]   (env: WIDTH, HEIGHT, SCALE, WAIT_MS, THEME=dark|light)
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const [outDir, ...pairs] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--hide-scrollbars', '--force-color-profile=srgb'],
});
const width = Number(process.env.WIDTH ?? 390);
const height = Number(process.env.HEIGHT ?? 844);
const scale = Number(process.env.SCALE ?? 3);
for (const pair of pairs) {
  const [name, url] = pair.split(/=(.*)/s);
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  if (process.env.THEME) {
    await page.evaluateOnNewDocument((t) => {
      localStorage.setItem('xrp-preferences', JSON.stringify({ state: { theme: t }, version: 0 }));
    }, process.env.THEME);
  }
  await page.goto(url, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => document.body.innerText.trim().length > 0, { timeout: 120000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, Number(process.env.WAIT_MS ?? 1500)));
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`${name}: ${errors.length ? 'ERRORS ' + errors.slice(0, 2).join(' | ').slice(0, 300) : 'ok'}`);
  await page.close();
}
await browser.close();
