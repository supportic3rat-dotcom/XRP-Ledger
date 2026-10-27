import { expect, type Page, test } from '@playwright/test';

const asRole = async (page: Page, role: 'Operations Administrator' | 'Compliance Officer' | 'Read-Only Auditor') => {
  await page.request.post('/demo-reset');
  await page.goto('/sign-in');
  await page.getByRole('button', { name: role }).click();
  await page.waitForURL('/');
};

test('operations approves a small withdrawal; it shows the next step and leaves the waiting count', async ({ page }) => {
  await asRole(page, 'Operations Administrator');
  await page.goto('/queue?sel=wd2043');
  await expect(page.locator('.nav-item', { hasText: 'Approval queue' }).locator('.count')).toHaveText('6');
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Queued for custody submission' })).toBeVisible();
  await expect(page.locator('.nav-item', { hasText: 'Approval queue' }).locator('.count')).toHaveText('5');
  await page.goto('/audit');
  await expect(page.getByText('Approved withdrawal').first()).toBeVisible();
});

test('separation of duties: Compliance cannot add the second approval after a Compliance approval', async ({ page }) => {
  await asRole(page, 'Compliance Officer');
  await page.goto('/queue?sel=wd2042');
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
  await expect(page.getByText('Separation of duties: the first approval came from your role.')).toBeVisible();
});

test('a rejection needs a reason and a note, then posts the compensating entry', async ({ page }) => {
  await asRole(page, 'Operations Administrator');
  await page.goto('/queue?sel=wd2043');
  await page.getByRole('button', { name: 'Reject…' }).click();
  await page.getByRole('button', { name: 'Confirm rejection' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Choose a reason and write at least a short note' })).toBeVisible();
  await page.getByLabel('Rejection reason').selectOption('evidence');
  await page.getByLabel('Note for the audit log').fill('Destination owner could not be confirmed.');
  await page.getByRole('button', { name: 'Confirm rejection' }).click();
  await expect(page.getByText('Rejected. Customer notified with your reason; reserved funds released via compensating entry.')).toBeVisible();
  await expect(page.getByText('Customer reserved · XRP (reversal)')).toBeVisible();
});

test('auditors are read-only everywhere', async ({ page }) => {
  await asRole(page, 'Read-Only Auditor');
  await page.goto('/queue?sel=wd2043');
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reject…' })).toBeDisabled();
  await page.goto('/users');
  await expect(page.getByRole('button', { name: 'Freeze account' })).toBeDisabled();
  await expect(page.getByText('T•••• A••••').first()).toBeVisible();
  await page.goto('/reconciliation');
  await expect(page.getByText('Read-only role: you can view exceptions but not resolve them.')).toBeVisible();
});

test('only Compliance freezes accounts and sees full personal data', async ({ page }) => {
  await asRole(page, 'Compliance Officer');
  await page.goto('/users?sel=CUS-0042');
  await expect(page.getByText('tobi.adeyemi@example.com')).toBeVisible();
  await page.getByRole('button', { name: 'Freeze account' }).click();
  await expect(page.getByText('CUS-0042 frozen. Withdrawals and new requests are blocked.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unfreeze account' })).toBeVisible();
});

test('operations books the fee adjustment and the hot wallet balances', async ({ page }) => {
  await asRole(page, 'Operations Administrator');
  await page.goto('/reconciliation');
  await page.getByRole('button', { name: 'Book fee adjustment' }).click();
  await expect(page.getByText('Resolved · adjustment posted')).toBeVisible();
  await expect(page.getByText('−0.000036')).toHaveCount(0);
});

test('below 760 px the sidebar collapses into a strip and columns hide', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 1000 });
  await asRole(page, 'Operations Administrator');
  await page.goto('/transactions');
  const nav = page.locator('.navlist');
  await expect(nav).toHaveCSS('flex-direction', 'row');
  await expect(page.locator('.q-head .hide-sm').first()).toBeHidden();
});
