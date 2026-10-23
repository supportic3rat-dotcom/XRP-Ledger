import { QRCodeSVG } from 'qrcode.react';
import { Fragment } from 'react';
import type { Vals } from '@/lib/useDashboard';

/** Ported from Main.dc.html by tools/dc2jsx.py, then edited by hand. */
export const Modals = ({ v }: { v: Vals }) => (
  <>
    <div className="overlay" onKeyDown={v.onModalKey}>
      <button type="button" className="backdrop" tabIndex={-1} aria-label="Close dialog" onClick={v.closeModal}></button>
      <div className={`dialog ${v.dialogCls}`} role="dialog" aria-modal="true" aria-labelledby="dlg-title" tabIndex={-1} ref={v.setDialog}>
        {' '}
        {/* Receive */}{' '}
        {v.m.receive ? (
          <>
            {' '}
            <div className="dlg-head">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <h2 id="dlg-title" style={{ margin: '0', fontSize: '17px', fontWeight: '600' }}>
                  Receive {v.recv.name}
                </h2>
                <span style={{ fontSize: '13px', color: '#5F6D66' }}>Deposit to your XRP Ledger account</span>
              </div>
              <button type="button" className="icon-btn plain" aria-label="Close" onClick={v.closeModal}>
                <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18"></path>
                </svg>
              </button>
            </div>{' '}
            <div className="dlg-body">
              <div className="seg full" role="group" aria-label="Asset">
                {v.recvAssets.map((o, index) => (
                  <Fragment key={index}>
                    <button type="button" className={`seg-btn ${o.cls}`} aria-pressed={o.on} onClick={o.pick}>
                      {o.ticker}
                    </button>
                  </Fragment>
                ))}
              </div>
              <div className="field">
                <span className="label">Network</span>
                <div className="readonly">
                  <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true" style={{ color: '#5F6D66' }}>
                    <rect x="5" y="10.5" width="14" height="10" rx="2"></rect>
                    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"></path>
                  </svg>
                  <span style={{ fontWeight: '500' }}>{v.recv.network}</span>
                </div>
                <span className="help">
                  Only send {v.recv.ticker} on the {v.recv.network} network. Other networks can’t be recovered.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
                {v.recv.real ? (
                  <div className="qr" role="img" aria-label={`QR code for the ${v.recv.name} deposit address`}>
                    <QRCodeSVG value={v.recv.qrValue} size={100} marginSize={0} fgColor="#17211D" />
                  </div>
                ) : (
                  <div
                    aria-hidden="true"
                    style={{
                      width: '112px',
                      height: '112px',
                      flex: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      border: '1px dashed #D2D9D4',
                      borderRadius: '10px',
                      color: '#5F6D66',
                      fontSize: '11px',
                      textAlign: 'center',
                    }}
                  >
                    <svg className="ic" viewBox="0 0 24 24">
                      <rect x="4" y="4" width="6" height="6" rx="1"></rect>
                      <rect x="14" y="4" width="6" height="6" rx="1"></rect>
                      <rect x="4" y="14" width="6" height="6" rx="1"></rect>
                      <path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2"></path>
                    </svg>
                    QR code
                  </div>
                )}
                <div className="field" style={{ flex: '1', minWidth: '0' }}>
                  <span className="label">Deposit address</span>
                  <div className="readonly" style={{ alignItems: 'flex-start' }}>
                    <span className="mono" style={{ flex: '1', fontSize: '13px', lineHeight: '1.5', overflowWrap: 'anywhere' }}>
                      {v.recv.addr}
                    </span>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={v.copyAddr} style={{ alignSelf: 'flex-start' }}>
                    <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="8.5" y="8.5" width="11" height="11" rx="2"></rect>
                      <path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"></path>
                    </svg>
                    {v.recv.copyAddrLabel}
                  </button>
                </div>
              </div>
              {v.recv.usesTag ? (
                <>
                  <div className="field">
                    <span className="label">{v.recv.tagLabel}</span>
                    <div className="readonly" style={{ justifyContent: 'space-between' }}>
                      <span className="mono" style={{ fontSize: '15px', fontWeight: '500' }}>
                        {v.recv.tag}
                      </span>
                      <button type="button" className="link-btn" onClick={v.copyTag}>
                        {v.recv.copyTagLabel}
                      </button>
                    </div>
                  </div>
                  <div className="banner warn" role="note">
                    <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true" style={{ marginTop: '1px' }}>
                      <circle cx="12" cy="12" r="8.5"></circle>
                      <path d="M12 7.8v5M12 16.2h.01"></path>
                    </svg>
                    <span>
                      Include {v.recv.tagLabel.toLowerCase()} <b className="mono">{v.recv.tag}</b> with every {v.recv.ticker} deposit, or it can’t be matched
                      to your account.
                    </span>
                  </div>
                </>
              ) : null}
              {v.recv.reported ? (
                <div className="banner info" role="note">
                  <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true" style={{ marginTop: '1px' }}>
                    <circle cx="12" cy="12" r="8.5"></circle>
                    <path d="M12 11v5M12 8h.01"></path>
                  </svg>
                  <span>
                    {v.recv.open
                      ? `After you send, report the transaction in the app (Deposit → Already sent it?) with its hash. Our team confirms it on ${v.recv.network} and credits your balance, usually within a few hours.`
                      : `${v.recv.name} deposits aren’t open yet. Choose another asset.`}
                  </span>
                </div>
              ) : null}
              {v.recv.real ? null : (
                <div className="banner info">
                  <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true" style={{ marginTop: '1px' }}>
                    <circle cx="12" cy="12" r="8.5"></circle>
                    <path d="M12 11v5M12 8h.01"></path>
                  </svg>
                  <span>Demo address. It isn’t valid on any network — don’t send funds to it.</span>
                </div>
              )}
            </div>{' '}
            <div className="dlg-foot">
              <button type="button" className="btn btn-secondary" onClick={v.closeModal}>
                Done
              </button>
            </div>{' '}
          </>
        ) : null}{' '}
        {/* Send */}{' '}
        {v.m.send ? (
          <>
            {' '}
            <div className="dlg-head">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <h2 id="dlg-title" style={{ margin: '0', fontSize: '17px', fontWeight: '600' }}>
                  {v.send.title}
                </h2>
                <span style={{ fontSize: '13px', color: '#5F6D66' }}>{v.send.subtitle}</span>
              </div>
              <button type="button" className="icon-btn plain" aria-label="Close" onClick={v.closeModal}>
                <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18"></path>
                </svg>
              </button>
            </div>{' '}
            <div className="dlg-body">
              {v.send.showSteps ? (
                <>
                  <ol className="steps" aria-label="Withdrawal steps" style={{ listStyle: 'none', margin: '0', padding: '0' }}>
                    {v.send.steps.map((s, index) => (
                      <Fragment key={index}>
                        <li className={`step ${s.cls}`} aria-current={s.cur}>
                          {s.label}
                        </li>
                      </Fragment>
                    ))}
                  </ol>
                </>
              ) : null}
              {/* Step 1: amount */}
              {v.send.s1 ? (
                <>
                  <div className="field">
                    <span className="label">Asset</span>
                    <div className="seg full" role="group" aria-label="Asset to send">
                      {v.sendAssets.map((o, index) => (
                        <Fragment key={index}>
                          <button type="button" className={`seg-btn ${o.cls}`} aria-pressed={o.on} onClick={o.pick}>
                            {o.ticker}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="send-amount">
                      Amount
                    </label>
                    <div className={`input-wrap lg ${v.send.amountCls}`}>
                      <input
                        id="send-amount"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0.00"
                        value={v.send.amount}
                        onChange={v.onAmount}
                        aria-describedby="send-amount-help"
                      />
                      <span style={{ fontSize: '15px', fontWeight: '500', color: '#4C5A54' }}>{v.send.ticker}</span>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={v.setMax} style={{ height: '30px', padding: '0 10px' }}>
                        Max
                      </button>
                    </div>
                    <div id="send-amount-help" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                      <span className="help num">{v.send.fiatText}</span>
                      <span className="help num">Available {v.send.availText}</span>
                    </div>
                    {v.send.amountErr ? (
                      <>
                        <span className="err" role="alert">
                          {v.send.amountErr}
                        </span>
                      </>
                    ) : null}
                  </div>
                </>
              ) : null}
              {/* Step 2: destination */}
              {v.send.s2 ? (
                <>
                  <div className="field">
                    <label className="label" htmlFor="send-addr">
                      Destination address
                    </label>
                    <div className={`input-wrap ${v.send.addrCls}`}>
                      <input
                        id="send-addr"
                        className="mono"
                        autoComplete="off"
                        spellCheck="false"
                        placeholder={v.send.addrPlaceholder}
                        value={v.send.address}
                        onChange={v.onAddress}
                        style={{ fontSize: '13.5px' }}
                      />
                    </div>
                    {v.send.addrErr ? (
                      <>
                        <span className="err" role="alert">
                          {v.send.addrErr}
                        </span>
                      </>
                    ) : null}
                  </div>
                  {v.send.usesTag ? (
                    <>
                      <div className="field">
                        <label className="label" htmlFor="send-tag">
                          {v.send.tagLabel} <span style={{ fontWeight: '400', color: '#5F6D66' }}>· optional</span>
                        </label>
                        <div className={`input-wrap ${v.send.tagCls}`}>
                          <input
                            id="send-tag"
                            inputMode={v.send.tagLabel === 'Memo' ? 'text' : 'numeric'}
                            autoComplete="off"
                            placeholder={v.send.tagLabel === 'Memo' ? 'e.g. 104839201' : 'e.g. 10293847'}
                            value={v.send.tag}
                            onChange={v.onTag}
                          />
                        </div>
                        <span className="help">Exchanges and custodial wallets usually require one. Check with the recipient.</span>
                        {v.send.tagErr ? (
                          <>
                            <span className="err" role="alert">
                              {v.send.tagErr}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                  <div className="field">
                    <span className="label">Network</span>
                    <div className="readonly">
                      <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true" style={{ color: '#5F6D66' }}>
                        <rect x="5" y="10.5" width="14" height="10" rx="2"></rect>
                        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"></path>
                      </svg>
                      <span style={{ fontWeight: '500' }}>{v.send.network}</span>
                    </div>
                    <span className="help">
                      {v.send.ticker} withdrawals are only supported on {v.send.network}. Make sure the recipient accepts this network.
                    </span>
                  </div>
                </>
              ) : null}
              {/* Step 3: review */}
              {v.send.s3 ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '4px 0 8px' }}>
                    <span style={{ fontSize: '13px', color: '#5F6D66' }}>You’re sending</span>
                    <span className="num" style={{ fontSize: '28px', fontWeight: '500', letterSpacing: '-0.02em' }}>
                      {v.send.amountText}
                    </span>
                    <span className="num" style={{ fontSize: '13px', color: '#5F6D66' }}>
                      {v.send.fiatText}
                    </span>
                  </div>
                  <dl className="kv" style={{ margin: '0', padding: '4px 14px', border: '1px solid #E2E6E2', borderRadius: '10px' }}>
                    <div className="kv-row">
                      <dt>To</dt>
                      <dd className="mono" style={{ fontSize: '12.5px', fontWeight: '400' }}>
                        {v.send.address}
                      </dd>
                    </div>
                    {v.send.usesTag ? (
                      <>
                        <div className="kv-row">
                          <dt>{v.send.tagLabel}</dt>
                          <dd className="mono">{v.send.tagText}</dd>
                        </div>
                      </>
                    ) : null}
                    <div className="kv-row">
                      <dt>Network</dt>
                      <dd>{v.send.network}</dd>
                    </div>
                    <div className="kv-row">
                      <dt>{v.send.feeLabel}</dt>
                      <dd>{v.send.feeText}</dd>
                    </div>
                    <div className="kv-row">
                      <dt>Total from balance</dt>
                      <dd>{v.send.totalText}</dd>
                    </div>
                    <div className="kv-row">
                      <dt>Recipient receives</dt>
                      <dd>{v.send.receivesText}</dd>
                    </div>
                  </dl>
                  <div className="banner info">
                    <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true" style={{ marginTop: '1px' }}>
                      <circle cx="12" cy="12" r="8.5"></circle>
                      <path d="M12 11v5M12 8h.01"></path>
                    </svg>
                    <span>Withdrawals are reviewed before they’re broadcast. Once broadcast, they can’t be reversed.</span>
                  </div>
                  {v.send.needsTotp ? (
                    <div className="field">
                      <label className="label" htmlFor="send-code">
                        Authentication code
                      </label>
                      <div className={`input-wrap ${v.send.codeCls}`}>
                        <input
                          id="send-code"
                          className="code-input"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          placeholder="000000"
                          value={v.send.code}
                          onChange={v.onCode}
                        />
                      </div>
                      <span className="help">From your authenticator app. Required for every withdrawal.</span>
                      {v.send.codeErr ? (
                        <span className="err" role="alert">
                          {v.send.codeErr}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13.5px', lineHeight: '1.45', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={v.send.confirm}
                      onChange={v.toggleConfirm}
                      style={{ width: '18px', height: '18px', margin: '1px 0 0', accentColor: 'var(--accent)', flex: 'none' }}
                    />
                    <span>I’ve checked the address{v.send.tagClause} and network.</span>
                  </label>
                  {v.send.confirmErr ? (
                    <>
                      <span className="err" role="alert">
                        {v.send.confirmErr}
                      </span>
                    </>
                  ) : null}
                </>
              ) : null}
              {/* Step 4: submitted */}
              {v.send.s4 ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '8px 0 4px', textAlign: 'center' }}>
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: '#FBF4E4',
                        color: '#875D00',
                      }}
                    >
                      <svg className="ic" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="8.5"></circle>
                        <path d="M12 7.5V12l3 2"></path>
                      </svg>
                    </span>
                    <span className="num" style={{ fontSize: '22px', fontWeight: '500' }}>
                      {v.send.amountText}
                    </span>
                    <span className="status review">Pending review</span>
                  </div>
                  <dl className="kv" style={{ margin: '0', padding: '4px 14px', border: '1px solid #E2E6E2', borderRadius: '10px' }}>
                    <div className="kv-row">
                      <dt>Request reference</dt>
                      <dd className="mono">{v.send.ref}</dd>
                    </div>
                    <div className="kv-row">
                      <dt>To</dt>
                      <dd className="mono" style={{ fontSize: '12.5px', fontWeight: '400' }}>
                        {v.send.address}
                      </dd>
                    </div>
                    <div className="kv-row">
                      <dt>Network</dt>
                      <dd>{v.send.network}</dd>
                    </div>
                  </dl>
                  <div className="banner info">
                    <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true" style={{ marginTop: '1px' }}>
                      <circle cx="12" cy="12" r="8.5"></circle>
                      <path d="M12 11v5M12 8h.01"></path>
                    </svg>
                    <span>
                      {v.demo
                        ? 'Demo mode: nothing was signed or broadcast, and your balance hasn’t changed.'
                        : 'The amount is on hold in your balance. You’ll be notified when it’s approved, and again when it completes on the ledger.'}
                    </span>
                  </div>
                </>
              ) : null}
            </div>{' '}
            <div className="dlg-foot">
              {v.send.showBack ? (
                <>
                  <button type="button" className="btn btn-secondary" onClick={v.sendBack}>
                    Back
                  </button>
                </>
              ) : null}
              {v.send.s4 ? (
                <>
                  <button type="button" className="btn btn-secondary" onClick={v.viewActivity}>
                    View in activity
                  </button>
                </>
              ) : null}
              <button type="button" className="btn btn-primary" onClick={v.sendNext} disabled={v.send.busy}>
                {v.send.nextLabel}
              </button>
            </div>{' '}
          </>
        ) : null}{' '}
        {/* Buy */}{' '}
        {v.m.buy ? (
          <>
            {' '}
            <div className="dlg-head">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <h2 id="dlg-title" style={{ margin: '0', fontSize: '17px', fontWeight: '600' }}>
                  Buy crypto
                </h2>
                <span style={{ fontSize: '13px', color: '#5F6D66' }}>Card and bank purchases</span>
              </div>
              <button type="button" className="icon-btn plain" aria-label="Close" onClick={v.closeModal}>
                <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18"></path>
                </svg>
              </button>
            </div>{' '}
            <div className="dlg-body">
              <div className="seg full" role="group" aria-label="Asset to buy">
                {v.buyAssets.map((o, index) => (
                  <Fragment key={index}>
                    <button type="button" className={`seg-btn ${o.cls}`} aria-pressed={o.on} onClick={o.pick}>
                      {o.ticker}
                    </button>
                  </Fragment>
                ))}
              </div>
              <div className="field">
                <label className="label" htmlFor="buy-amount">
                  Spend
                </label>
                <div className="input-wrap lg">
                  <span style={{ fontSize: '22px', fontWeight: '500', color: '#4C5A54' }}>$</span>
                  <input id="buy-amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={v.buy.amount} onChange={v.onBuyAmount} />
                  <span style={{ fontSize: '15px', fontWeight: '500', color: '#4C5A54' }}>USD</span>
                </div>
                <span className="help num">{v.buy.estimate}</span>
              </div>
              <div className="field">
                <span className="label">Pay with</span>
                <div className="readonly" style={{ color: '#5F6D66' }}>
                  [Payment method]
                </div>
              </div>
              <div className="banner info">
                <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true" style={{ marginTop: '1px' }}>
                  <circle cx="12" cy="12" r="8.5"></circle>
                  <path d="M12 11v5M12 8h.01"></path>
                </svg>
                <span>Purchases aren’t available yet. The final price and fees will be quoted before you confirm.</span>
              </div>
            </div>{' '}
            <div className="dlg-foot">
              <button type="button" className="btn btn-secondary" onClick={v.closeModal}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={v.reviewBuy}>
                Review purchase
              </button>
            </div>{' '}
          </>
        ) : null}{' '}
        {/* Transaction detail */}{' '}
        {v.m.tx ? (
          <>
            {' '}
            <div className="dlg-head">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <h2 id="dlg-title" style={{ margin: '0', fontSize: '17px', fontWeight: '600' }}>
                  {v.tx.title}
                </h2>
                <span style={{ fontSize: '13px', color: '#5F6D66' }}>{v.tx.date}</span>
              </div>
              <button type="button" className="icon-btn plain" aria-label="Close" onClick={v.closeModal}>
                <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18"></path>
                </svg>
              </button>
            </div>{' '}
            <div className="dlg-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 0' }}>
                <span className="num" style={{ fontSize: '30px', fontWeight: '500', letterSpacing: '-0.02em', color: v.tx.amountColor }}>
                  {v.tx.amount}
                </span>
                <span className="num" style={{ fontSize: '13.5px', color: '#5F6D66' }}>
                  {v.tx.fiat}
                </span>
                <span className={`status ${v.tx.statusCls}`} style={{ marginTop: '6px' }}>
                  {v.tx.statusLabel}
                </span>
              </div>
              <dl className="kv" style={{ margin: '0' }}>
                <div className="kv-row">
                  <dt>Type</dt>
                  <dd>{v.tx.typeLabel}</dd>
                </div>
                {v.tx.secondary ? (
                  <>
                    <div className="kv-row">
                      <dt>Paid</dt>
                      <dd>{v.tx.secondary}</dd>
                    </div>
                  </>
                ) : null}
                <div className="kv-row">
                  <dt>Network</dt>
                  <dd>{v.tx.network}</dd>
                </div>
                <div className="kv-row">
                  <dt>{v.tx.partyLabel}</dt>
                  <dd className="mono" style={{ fontSize: '12.5px', fontWeight: '400' }}>
                    {v.tx.party}
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>Fee</dt>
                  <dd>{v.tx.fee}</dd>
                </div>
                <div className="kv-row">
                  <dt>Reference</dt>
                  <dd className="mono" style={{ fontSize: '12.5px' }}>
                    {v.tx.ref}
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>Ledger record</dt>
                  <dd style={{ fontWeight: '400', color: '#5F6D66' }}>{v.tx.ledgerText}</dd>
                </div>
              </dl>
              <div className={`banner ${v.tx.noteCls}`}>
                <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true" style={{ marginTop: '1px' }}>
                  <circle cx="12" cy="12" r="8.5"></circle>
                  <path d="M12 11v5M12 8h.01"></path>
                </svg>
                <span>{v.tx.note}</span>
              </div>
            </div>{' '}
            <div className="dlg-foot">
              <button type="button" className="btn btn-secondary" onClick={v.closeModal}>
                Close
              </button>
            </div>{' '}
          </>
        ) : null}{' '}
      </div>
    </div>
  </>
);
