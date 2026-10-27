import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { createDemoData, resetDemo } from '@/features/admin/data/demo';
import type { Role } from '@/features/admin/data/types';
import { opsRoute } from '@/features/admin/routes';
import { ApprovalScreen } from '@/features/admin/screens/ApprovalScreen';
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
});
