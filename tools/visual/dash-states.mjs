// Screenshots dashboard states in the app and in the rendered Main.dc.html reference, side by side for compare.py.
// Usage: node dash-states.mjs <outDir> [stateName…]   (needs the web app on :3300 and dc-serve on :3200)
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const [outDir, ...only] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const REF = 'http://localhost:3200/tools/visual/dc/view.html?src=/reference/design-source/project/Main.dc.html';
const APP = 'http://localhost:3300';
const click = (text) => async (page) => {
  await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s+/g, ' ').trim() === t || b.getAttribute('aria-label') === t);
    if (!el) throw new Error(`No button "${t}"`);
    el.click();
  }, text);
  await new Promise((r) => setTimeout(r, 400));
};
const type = (selector, value) => async (page) => {
  await page.focus(selector);
  await page.keyboard.type(value);
  await new Promise((r) => setTimeout(r, 200));
};
const STATES = {
  activity: { ref: { view: 'activity' }, app: '/activity' },
  markets: { ref: { view: 'markets' }, app: '/markets' },
  earn: { ref: { view: 'earn' }, app: '/earn' },
  settings: { ref: { view: 'settings' }, app: '/settings' },
  help: { ref: { view: 'help', guide: 'tag' }, app: '/help', appSteps: [click('Sending XRP with a destination tag')] },
  asset: { ref: { view: 'asset', assetId: 'XRP' }, app: '/asset/XRP' },
  notif: { ref: { menu: 'notif' }, app: '/', appSteps: [click('Notifications, 2 unread')] },
  profile: { ref: { menu: 'profile' }, app: '/', appSteps: [click('Account menu')] },
  receive: { ref: { modal: 'receive' }, app: '/', appSteps: [click('Receive')] },
  send1: { ref: { modal: 'send' }, app: '/', appSteps: [click('Send')] },
  send1err: { ref: { modal: 'send', send: { step: 1, asset: 'XRP', amount: '', address: '', tag: '', confirm: false, tried1: true, tried2: false, tried3: false, ref: '' } }, app: '/', appSteps: [click('Send'), click('Continue')] },
  send3: {
    ref: { modal: 'send', send: { step: 3, asset: 'XRP', amount: '100', address: 'rRecipXk3PaKcV9tYwZ2hNproto7Hd', tag: '10293847', confirm: false, tried1: false, tried2: false, tried3: false, ref: '' } },
    app: '/',
    appSteps: [click('Send'), type('#send-amount', '100'), click('Continue'), type('#send-addr', 'rRecipXk3PaKcV9tYwZ2hNproto7Hd'), type('#send-tag', '10293847'), click('Continue')],
  },
  tx: { ref: { modal: 'tx', txId: 't2' }, app: '/', appSteps: [click('Sent XRP, −300.00 XRP, Oct 17, 16:08, Completed')] },
  buy: { ref: { modal: 'buy' }, app: '/', appSteps: [click('Buy crypto')] },
};

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb'] });
for (const [name, s] of Object.entries(STATES)) {
  if (only.length && !only.includes(name)) continue;
  for (const side of ['ref', 'app']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1040, deviceScaleFactor: 1 });
    const url = side === 'ref' ? `${REF}&state=${encodeURIComponent(JSON.stringify(s.ref))}` : `${APP}${s.app}`;
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 600));
    if (side === 'app') for (const step of s.appSteps ?? []) await step(page);
    await page.evaluate(() => document.activeElement?.blur?.());
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: `${outDir}/${side}-${name}.png` });
    await page.close();
  }
  console.log(name);
}
await browser.close();
