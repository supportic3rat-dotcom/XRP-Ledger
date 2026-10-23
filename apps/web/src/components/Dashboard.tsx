'use client';

import { useMemo } from 'react';
import { createSource } from '@/lib/data';
import { useDashboard } from '@/lib/useDashboard';
import { ActivityView } from './views/ActivityView';
import { AssetView } from './views/AssetView';
import { EarnView } from './views/EarnView';
import { Header } from './views/Header';
import { HelpView } from './views/HelpView';
import { MarketsView } from './views/MarketsView';
import { Modals } from './views/Modals';
import { OverviewView } from './views/OverviewView';
import { SettingsView } from './views/SettingsView';
import { Sidebar } from './views/Sidebar';
import { ToastRegion } from './views/ToastRegion';

/** The customer dashboard (Main.dc.html): sidebar, header, the current view, dialogs and toast. */
export const Dashboard = () => {
  const source = useMemo(createSource, []);
  const v = useDashboard(source);
  return (
    <div
      className="app"
      style={{
        ['--accent' as string]: v.accent,
        display: 'flex',
        flexWrap: 'wrap',
        minHeight: '100vh',
        background: '#F7F8F6',
        color: '#17211D',
        fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: '14px',
        lineHeight: '1.4',
      }}
    >
      <Sidebar v={v} />
      <main className="main" style={{ flex: '999 1 560px', minWidth: '0', padding: '24px 40px 48px' }}>
        <div style={{ maxWidth: '1160px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Header v={v} />
          {v.isOverview ? <OverviewView v={v} /> : null}
          {v.isAsset ? <AssetView v={v} /> : null}
          {v.isActivity ? <ActivityView v={v} /> : null}
          {v.isMarkets ? <MarketsView v={v} /> : null}
          {v.isEarn ? <EarnView v={v} /> : null}
          {v.isSettings ? <SettingsView v={v} /> : null}
          {v.isHelp ? <HelpView v={v} /> : null}
          {v.demo ? (
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#5F6D66', textAlign: 'center' }}>
              Demo mode. Balances, prices, addresses and transactions are sample data. No wallet is connected and no funds can move.
            </p>
          ) : null}
        </div>
      </main>
      {v.modalOpen ? <Modals v={v} /> : null}
      <ToastRegion v={v} />
    </div>
  );
};
