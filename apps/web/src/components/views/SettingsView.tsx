import type { Vals } from '@/lib/useDashboard';

/** Ported from Main.dc.html by tools/dc2jsx.py, then edited by hand. */
export const SettingsView = ({ v }: { v: Vals }) => (
  <>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(440px, 100%), 1fr))', gap: '20px', alignItems: 'start' }}>
      <section className="card" aria-labelledby="set-profile" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 id="set-profile" className="card-title">
          Profile
        </h2>
        <dl className="kv" style={{ margin: '0' }}>
          <div className="kv-row">
            <dt>Name</dt>
            <dd>{v.profile.name}</dd>
          </div>
          <div className="kv-row">
            <dt>Identity verification</dt>
            <dd>
              <span className={`status ${v.profile.verified ? 'completed' : 'pending'}`}>{v.profile.verified ? 'Verified' : 'Not verified'}</span>
            </dd>
          </div>
          <div className="kv-row">
            <dt>Email</dt>
            <dd>{v.profile.email}</dd>
          </div>
          <div className="kv-row">
            <dt>Display currency</dt>
            <dd>{v.profile.currency}</dd>
          </div>
        </dl>
      </section>
      <section className="card" aria-labelledby="set-security" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h2 id="set-security" className="card-title" style={{ marginBottom: '8px' }}>
          Security
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 0', borderTop: '1px solid #EEF1ED' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span id="lbl-2fa" style={{ fontWeight: '500' }}>
              Two-factor authentication
            </span>
            <span className="help">Required to sign in and to approve withdrawals.</span>
          </span>
          <button type="button" role="switch" className={`toggle ${v.st.twofaCls}`} aria-checked={v.st.twofa} aria-labelledby="lbl-2fa" onClick={v.toggleTwofa}>
            <span className="knob"></span>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 0', borderTop: '1px solid #EEF1ED' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span id="lbl-allow" style={{ fontWeight: '500' }}>
              Withdrawal address allowlist
            </span>
            <span className="help">Only allow withdrawals to addresses you’ve saved.</span>
          </span>
          <button
            type="button"
            role="switch"
            className={`toggle ${v.st.allowCls}`}
            aria-checked={v.st.allowlist}
            aria-labelledby="lbl-allow"
            onClick={v.toggleAllow}
          >
            <span className="knob"></span>
          </button>
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 0 0', borderTop: '1px solid #EEF1ED' }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontWeight: '500' }}>Password</span>
            <span className="help">{v.st.passwordChanged}</span>
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={v.changePassword}>
            Change
          </button>
        </div>
      </section>
      <section className="card" aria-labelledby="set-notif" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h2 id="set-notif" className="card-title" style={{ marginBottom: '8px' }}>
          Notifications
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 0', borderTop: '1px solid #EEF1ED' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span id="lbl-receipts" style={{ fontWeight: '500' }}>
              Transaction emails
            </span>
            <span className="help">A receipt for every deposit and withdrawal.</span>
          </span>
          <button
            type="button"
            role="switch"
            className={`toggle ${v.st.receiptsCls}`}
            aria-checked={v.st.receipts}
            aria-labelledby="lbl-receipts"
            onClick={v.toggleReceipts}
          >
            <span className="knob"></span>
          </button>
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 0 0', borderTop: '1px solid #EEF1ED' }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span id="lbl-alerts" style={{ fontWeight: '500' }}>
              Price alerts
            </span>
            <span className="help">Notify me when an asset I hold moves more than 5% in a day.</span>
          </span>
          <button
            type="button"
            role="switch"
            className={`toggle ${v.st.alertsCls}`}
            aria-checked={v.st.alerts}
            aria-labelledby="lbl-alerts"
            onClick={v.toggleAlerts}
          >
            <span className="knob"></span>
          </button>
        </div>
      </section>
    </div>
  </>
);
