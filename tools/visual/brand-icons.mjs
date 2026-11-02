// Generates every app icon and favicon from the logo geometry in packages/tokens/src/brand.ts.
// Usage (from tools/visual): node brand-icons.mjs
import puppeteer from 'puppeteer-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { logoSvg } from '../../packages/tokens/src/brand.ts';

const root = resolve(import.meta.dirname, '../..');
const ink = '#0A0A0A';

/** Small sizes: bold weight on a rounded tile. Large sizes: regular weight, full bleed (the OS applies its own mask). */
const favicon = logoSvg({ fg: '#FFFFFF', bg: ink, weight: 'bold', fill: 0.8, radius: 0.25 });
const appIcon = logoSvg({ fg: '#FFFFFF', bg: ink, fill: 0.6, radius: 0 });
const touchIcon = logoSvg({ fg: '#FFFFFF', bg: ink, weight: 'bold', fill: 0.66, radius: 0 });
const glyphOnly = (fill) => logoSvg({ fg: '#FFFFFF', fill });
const geist = readFileSync(resolve(root, 'apps/mobile/node_modules/@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf')).toString('base64');
/** Logo over the name, kept inside the centre circle Android 12+ crops splash icons to. The -31px trims the square viewBox to the glyph. */
const splashLockup =
  `<style>@font-face{font-family:Geist;font-weight:600;src:url(data:font/ttf;base64,${geist})}</style>` +
  `<div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center">` +
  `<div style="width:340px;height:340px;margin:-31px 0">${logoSvg({ fg: '#FFFFFF', fill: 1 })}</div>` +
  `<div style="margin-top:44px;font:600 92px/1 Geist;letter-spacing:-0.02em;color:#FFFFFF">XRP Ledger</div></div>`;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--force-color-profile=srgb'],
});
const shot = async (html, size) => {
  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><body style="margin:0">${html}</body>`);
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ omitBackground: true, type: 'png' });
  await page.close();
  return Buffer.from(buf);
};
const png = (svg, size) => shot(svg.replace('<svg', '<svg width="100%" height="100%" style="display:block;width:100vw;height:100vh"'), size);
/** A single-image .ico that wraps a PNG (supported by every current browser). */
const ico = (pngBuf, size) => {
  // ICONDIR (6 bytes) then one ICONDIRENTRY (16 bytes), then the PNG at offset 22.
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); // reserved
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(1, 4); // image count
  head.writeUInt8(size, 6); // width
  head.writeUInt8(size, 7); // height
  head.writeUInt16LE(1, 10); // colour planes
  head.writeUInt16LE(32, 12); // bits per pixel
  head.writeUInt32LE(pngBuf.length, 14);
  head.writeUInt32LE(22, 18);
  return Buffer.concat([head, pngBuf]);
};
const write = (rel, data) => {
  const file = resolve(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log('wrote', rel);
};

write('apps/mobile/assets/icon.png', await png(appIcon, 1024));
// Android adaptive icon: the foreground must sit inside the 66% safe zone of a 108dp canvas.
write('apps/mobile/assets/adaptive-icon.png', await png(glyphOnly(0.5), 1024));
write('apps/mobile/assets/splash-icon.png', await shot(splashLockup, 1024));
write('apps/mobile/assets/favicon.png', await png(favicon, 48));
write('logo.svg', logoSvg({ fg: '#FFFFFF', bg: ink, fill: 0.72, radius: 0.22 }));
await browser.close();
