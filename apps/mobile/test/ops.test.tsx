import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { createDemoData, resetDemo } from '@/features/admin/data/demo';
import type { Role } from '@/features/admin/data/types';
import { opsRoute } from '@/features/admin/routes';
import { ApprovalScreen } from '@/features/admin/screens/ApprovalScreen';
import { CustodyScreen } from '@/features/admin/screens/CustodyScreen';
import { OverviewScreen } from '@/features/admin/screens/OverviewScreen';
import { IdentityAlerts } from '@/features/admin/IdentityAlerts';
import { useToast } from '@/components/Toast';
import { PasswordScreen } from '@/features/admin/screens/PasswordScreen';
import { QueueScreen } from '@/features/admin/screens/QueueScreen';
import { useStaff } from '@/features/admin/session';
import { renderScreen, routerCalls } from './render';

const setRouteParams = (p: Record<string, string>) => (globalThis as unknown as { setRouteParams: (p: Record<string, string>) => void }).setRouteParams(p);

const signInAs = async (role: Role) => {
  const data = createDemoData(role);
  const me = await data.me();
  if (!me) throw new Error('no demo staff');
  useStaff.getState().setSession({ me, data });
};

describe('Operations console', () => {
  beforeEach(() => {
    resetDemo();
    routerCalls().length = 0;
  });

  it('maps console links to app routes', () => {
    expect(opsRoute('/queue?sel=wd2042')).toBe('/ops/approval/wd2042');
    expect(opsRoute('/users?sel=CUS-0233')).toBe('/ops/customer/CUS-0233');
    expect(opsRoute('/reconciliation')).toBe('/ops/reconciliation');
    expect(opsRoute('/somewhere-else')).toBe('/ops');
  });

  it('lists the approval queue and opens a request', async () => {
    await signInAs('operations');
    await renderScreen(<QueueScreen />);
    const row = await screen.findByLabelText(/WD-PROTO-2042/);
    await fireEvent.press(row);
    expect(routerCalls()).toContainEqual({ method: 'push', to: '/ops/approval/wd2042' });
  });

  it('lets Operations give the second approval after Compliance', async () => {
    await signInAs('operations');
    setRouteParams({ id: 'wd2042' });
    await renderScreen(<ApprovalScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByText(/Queued for custody submission/)).toBeTruthy();
  });

  it('blocks a second approval from the same role (separation of duties)', async () => {
    await signInAs('compliance');
    setRouteParams({ id: 'wd2042' });
    await renderScreen(<ApprovalScreen />);
    expect(await screen.findByText(/The second must come from a different role/)).toBeTruthy();
  });

  it('checks the new staff password before calling the server', async () => {
    await signInAs('operations');
    await renderScreen(<PasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText('Current password'), 'Old-Password-2026');
    await fireEvent.changeText(screen.getByLabelText('New password'), 'weak');
    await fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'weak');
    await fireEvent.press(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText(/12\+ characters/, { exact: false })).toBeTruthy();
    expect(routerCalls().some((c) => c.method === 'back')).toBe(false);
  });

  it('changes the staff password and goes back', async () => {
    await signInAs('operations');
    await renderScreen(<PasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText('Current password'), 'Old-Password-2026');
    await fireEvent.changeText(screen.getByLabelText('New password'), 'New-Password-2026');
    await fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'New-Password-2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() => expect(routerCalls().some((c) => c.method === 'back')).toBe(true));
  });

  it('lets Compliance add a wallet and checks its address', async () => {
    await signInAs('compliance');
    await renderScreen(<CustodyScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Wallet name'), 'Treasury');
    await fireEvent.press(screen.getByRole('button', { name: 'Add wallet' }));
    expect(await screen.findByText(/isn’t a valid XRP Ledger address/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('XRP Ledger address'), 'rp489nfz7Q6KoHYkB6Uj3Ks4RtSoX4CfCV');
    await fireEvent.press(screen.getByRole('button', { name: 'Add wallet' }));
    expect(await screen.findByText('Treasury')).toBeTruthy();
  });

  it('alerts Compliance and lists waiting identity checks', async () => {
    await signInAs('compliance');
    await renderScreen(<IdentityAlerts />);
    await waitFor(() => expect(useToast.getState().message).toMatch(/identity check/));
    useToast.getState().hide();
    await renderScreen(<OverviewScreen />);
    expect(await screen.findByText(/identity checks? waiting/i)).toBeTruthy();
  });

  it('does not alert Operations about identity checks', async () => {
    useToast.getState().hide();
    await signInAs('operations');
    await renderScreen(<IdentityAlerts />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(useToast.getState().message).toBeNull();
  });

  it('shows the Earn reserve shortfall and marks a reserve wallet', async () => {
    await signInAs('compliance');
    await renderScreen(<CustodyScreen />);
    expect(await screen.findByText(/Short 13\.5/)).toBeTruthy();
    await fireEvent.changeText(await screen.findByLabelText('Wallet name'), 'Reserve');
    await fireEvent.changeText(screen.getByLabelText('XRP Ledger address'), 'rrrrrrrrrrrrrrrrrrrrrhoLvTp');
    await fireEvent.press(screen.getByRole('button', { name: 'Add wallet' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Use as Earn reserve' }));
    expect(await screen.findByRole('button', { name: 'Stop using as reserve' })).toBeTruthy();
  });

  it('shows Operations the wallets but not the form', async () => {
    await signInAs('operations');
    await renderScreen(<CustodyScreen />);
    expect(await screen.findByText('No wallets added yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add wallet' })).toBeNull();
  });
});
