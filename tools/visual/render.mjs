// Renders an HTML or SVG file to a PNG at an exact size (used for app icons and favicons).
// Usage: node render.mjs <in.html|in.svg> <out.png> <width> [height]
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';

const [input, out, w, h = w] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--force-color-profile=srgb'],
});
const page = await browser.newPage();
await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: 1 });
const src = readFileSync(input, 'utf8');
const body = input.endsWith('.svg') ? src.replace('<svg', '<svg style="display:block;width:100vw;height:100vh"') : src;
await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${body}</body></html>`);
await page.screenshot({ path: out, omitBackground: true });
await browser.close();
