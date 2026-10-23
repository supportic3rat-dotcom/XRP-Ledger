import { expect, test } from '@playwright/test';

test('send: validates each step, submits, and the request appears in activity', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Enter an amount to send.' })).toBeVisible();
  await page.locator('#send-amount').fill('100000');
  await expect(page.getByText('Amount plus the 0.25 XRP network fee is more than your available balance.')).toBeVisible();
  await page.locator('#send-amount').fill('100');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Enter the XRP Ledger address you’re sending to.')).toBeVisible();
  await page.locator('#send-addr').fill('rRecipXk3PaKcV9tYwZ2hNproto7Hd');
  await page.locator('#send-tag').fill('10293847');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Submit withdrawal request' }).click();
  await expect(page.getByText('Confirm you’ve checked the details to continue.')).toBeVisible();
  await page.getByLabel('I’ve checked the address, destination tag and network.').check();
  await page.getByRole('button', { name: 'Submit withdrawal request' }).click();
  await expect(page.getByRole('heading', { name: 'Withdrawal requested' })).toBeVisible();
  await expect(page.getByText('WD-PROTO-2042')).toBeVisible();
  await page.getByRole('button', { name: 'View in activity' }).click();
  await expect(page).toHaveURL(/\/activity$/);
  await expect(page.getByText('Withdrawal request · XRP')).toBeVisible();
});

test('receive shows the address and destination tag with the tag warning', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Receive', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('48201937').first()).toBeVisible();
  await expect(dialog.getByText('with every XRP deposit, or it can’t be credited')).toBeVisible();
  await dialog.getByRole('button', { name: 'Copy address' }).click();
  await expect(dialog.getByRole('button', { name: 'Copied' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('views are real URLs and the asset page opens from holdings', async ({ page }) => {
  await page.goto('/markets');
  await expect(page.getByRole('heading', { name: 'Markets' })).toBeVisible();
  await page.getByRole('listitem', { name: /^Bitcoin,/ }).click();
  await expect(page).toHaveURL(/\/asset\/BTC$/);
  await expect(page.getByText('Bitcoin indicative price')).toBeVisible();
  await page.getByRole('button', { name: 'Overview' }).first().click();
  await expect(page).toHaveURL(/\/$/);
});

test('period switch updates the change line', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '3M' }).click();
  await expect(page.getByText('−$640.20 (2.53%)')).toBeVisible();
  await expect(page.getByText('past 3 months')).toBeVisible();
});

test('below 760 px the sidebar becomes a strip', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.sidebar .nav')).toHaveCSS('flex-direction', 'row');
  await expect(page.locator('.side-foot')).toBeHidden();
});
