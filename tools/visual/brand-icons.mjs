// Generates every app icon and favicon from the logo geometry in packages/tokens/src/brand.ts.
// Usage (from tools/visual): node brand-icons.mjs
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { logoSvg } from '../../packages/tokens/src/brand.ts';

const root = resolve(import.meta.dirname, '../..');
const ink = '#0A0A0A';

/** Small sizes: bold weight on a rounded tile. Large sizes: regular weight, full bleed (the OS applies its own mask). */
const favicon = logoSvg({ fg: '#FFFFFF', bg: ink, weight: 'bold', fill: 0.8, radius: 0.25 });
const appIcon = logoSvg({ fg: '#FFFFFF', bg: ink, fill: 0.6, radius: 0 });
const touchIcon = logoSvg({ fg: '#FFFFFF', bg: ink, weight: 'bold', fill: 0.66, radius: 0 });
const glyphOnly = (fill) => logoSvg({ fg: '#FFFFFF', fill });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--force-color-profile=srgb'],
});
const png = async (svg, size) => {
  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><body style="margin:0">${svg.replace('<svg', '<svg width="100%" height="100%" style="display:block;width:100vw;height:100vh"')}</body>`);
  const buf = await page.screenshot({ omitBackground: true, type: 'png' });
  await page.close();
  return Buffer.from(buf);
};
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

const fav32 = await png(favicon, 32);
for (const app of ['apps/web/src/app', 'apps/admin/src/app']) {
  write(`${app}/icon.svg`, favicon);
  write(`${app}/favicon.ico`, ico(fav32, 32));
  write(`${app}/apple-icon.png`, await png(touchIcon, 180));
}
write('apps/mobile/assets/icon.png', await png(appIcon, 1024));
// Android adaptive icon: the foreground must sit inside the 66% safe zone of a 108dp canvas.
write('apps/mobile/assets/adaptive-icon.png', await png(glyphOnly(0.5), 1024));
write('apps/mobile/assets/splash-icon.png', await png(glyphOnly(0.9), 512));
write('apps/mobile/assets/favicon.png', await png(favicon, 48));
write('logo.svg', logoSvg({ fg: '#FFFFFF', bg: ink, fill: 0.72, radius: 0.22 }));
await browser.close();
