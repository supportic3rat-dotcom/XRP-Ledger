import { screen } from '@testing-library/react-native';
import type { AppNotification } from '@xrp/types';
import { HomeScreen } from '@/features/wallet/HomeScreen';
import { renderScreen } from './render';

const mockState: { status: string; notes: Partial<AppNotification>[] } = { status: 'verified', notes: [] };

jest.mock('@/data', () => {
  const { demoApi } = jest.requireActual('@/data/demo/demoApi');
  return {
    ...jest.requireActual('@/data'),
    api: new Proxy(demoApi, {
      get: (t, k) => (k === 'profile' ? async () => ({ ...(await t.profile()), kycStatus: mockState.status }) : k === 'notifications' ? async () => mockState.notes : t[k]),
    }),
  };
});

const decision = (body: string, readAt: string | null = null) => [{ id: 'n1', link: '/verify', title: 'Decision', body, readAt, tone: 'ok', icon: 'idCard', type: 'account', createdAt: '2026-11-01T00:00:00Z' }] as AppNotification[];

describe('Home identity status', () => {
  it('shows under review', async () => {
    mockState.status = 'in_progress';
    mockState.notes = [];
    await renderScreen(<HomeScreen />);
    expect(await screen.findByText(/under review/)).toBeTruthy();
  });

  it('shows a rejection with Compliance’s reason', async () => {
    mockState.status = 'rejected';
    mockState.notes = decision('Your document had expired.');
    await renderScreen(<HomeScreen />);
    expect(await screen.findByText(/We couldn’t verify your identity\. Your document had expired\./)).toBeTruthy();
  });

  it('tells the customer once they are verified, until they have read it', async () => {
    mockState.status = 'verified';
    mockState.notes = decision('You can now deposit.');
    await renderScreen(<HomeScreen />);
    expect(await screen.findByText(/Your identity is verified\. You can now deposit\./)).toBeTruthy();
  });

  it('stays quiet after a verified customer has read it', async () => {
    mockState.status = 'verified';
    mockState.notes = decision('You can now deposit.', '2026-11-01T00:00:00Z');
    await renderScreen(<HomeScreen />);
    await screen.findByText('Quick actions');
    expect(screen.queryByText(/Your identity is verified/)).toBeNull();
  });
});
