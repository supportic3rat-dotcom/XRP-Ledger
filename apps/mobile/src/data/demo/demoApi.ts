import {
  ASSETS,
  asset as assetSpec,
  assetLimits,
  canTransition,
  exchangeEstimateFor,
  formatAmount,
  isAssetAddress,
  journalFor,
  networkFeeEstimate,
  swapEstimate,
  unitsToCents,
} from '@xrp/ledger';
import type { Balances, Consent, KycStatus, LedgerAccountKind, SupportTicket, Transaction, TxEvent, TxKind } from '@xrp/types';
import type { Api, AssetInfo, FirmQuote, Holding } from '../api';
import { latestPrice } from '../market';
import * as seed from './seed';

const ZERO: Balances = { available: 0n, reserved: 0n, pendingYield: 0n, yield: 0n, collateral: 0n };

type Listener = () => void;

/** In-memory backend for local development and tests. Same rules as the database: state machines + balanced journals. */
export const createDemoApi = (): Api => {
  const bootedAt = Date.now();
  const now = () => new Date(seed.DEMO_EPOCH + (Date.now() - bootedAt));
  const iso = () => now().toISOString();
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((l) => l());
  const wait = (ms = 350) => new Promise<void>((r) => setTimeout(r, ms));
  const idempotency = new Map<string, Promise<unknown>>();

  const db = {
    signedIn: false,
    badAttempts: 0,
    kyc: 'verified' as KycStatus,
    profile: { ...seed.seedProfile },
    holdings: Object.fromEntries(seed.seedHoldings.map(({ asset, ...b }) => [asset, b])) as Record<string, Balances>,
    transactions: seed.seedTransactions.map((t) => ({ ...t, events: [...t.events] })),
    notifications: seed.seedNotifications.map((n) => ({ ...n })),
    loan: { ...seed.seedLoan },
    yieldPositions: seed.seedYieldPositions.map((p) => ({ ...p })),
    allowlist: seed.seedAllowlist.map((a) => ({ ...a })),
    devices: seed.seedDevices.map((d) => ({ ...d })),
    securityEvents: seed.seedSecurityEvents.map((e) => ({ ...e })),
    tickets: seed.seedTickets.map((t) => ({ ...t, messages: [...t.messages] })),
    consents: seed.seedConsents.map((c) => ({ ...c })),
    externalWallets: seed.seedExternalWallets.map((x) => ({ ...x })),
    quotes: new Map<string, FirmQuote>(),
    counters: { WD: 2042, EX: 318, YLD: 112, LN: 9, R: 1, C: 1, SUP: 934, CNS: 9, DEP: 2060 },
  };

  const accountKey: Record<LedgerAccountKind, keyof Balances | null> = {
    available: 'available',
    reserved: 'reserved',
    pending_yield: 'pendingYield',
    yield: 'yield',
    collateral: 'collateral',
    omnibus: null,
    suspense: null,
    fee_revenue: null,
    provider_receivable: null,
  };

  /** Applies the customer side of a balanced journal, in the transaction's asset (liability accounts are credit-normal). */
  const post = (kind: TxKind, status: string, amount: bigint, fee = 0n, asset = 'XRP') => {
    const lines = journalFor(kind, status, amount, fee);
    const next = { ...(db.holdings[asset] ?? ZERO) };
    for (const line of lines) {
      const key = line.owner === 'customer' ? accountKey[line.account] : null;
      if (key) next[key] -= line.amount;
    }
    if (Object.values(next).some((v) => v < 0n)) throw new Error('Insufficient balance');
    db.holdings[asset] = next;
  };
  const credit = (asset: string, units: bigint) => {
    const b = db.holdings[asset] ?? ZERO;
    db.holdings[asset] = { ...b, available: b.available + units };
  };
  const available = (asset: string) => db.holdings[asset]?.available ?? 0n;
  const yieldPos = (asset: string) => db.yieldPositions.find((p) => p.asset === asset);

  const notify = (n: Omit<(typeof db.notifications)[number], 'id' | 'createdAt' | 'readAt'>) => {
    db.notifications.unshift({ ...n, id: `n${Date.now()}`, createdAt: iso(), readAt: null });
  };

  const transition = (tx: Transaction, to: string, actor = 'System', note?: string) => {
    if (!canTransition(tx.kind, tx.status as never, to as never)) throw new Error(`Transition ${String(tx.status)} → ${to} is not allowed`);
    post(tx.kind, to, tx.amountDrops ?? 0n, tx.platformFeeDrops ?? 0n, tx.asset);
    // A swap delivers the bought asset when it completes.
    if (tx.kind === 'exchange' && to === 'paid_out' && tx.counterAsset && tx.counterAmount) credit(tx.counterAsset, tx.counterAmount);
    const event: TxEvent = { fromStatus: tx.status, toStatus: to as never, at: iso(), actor, ...(note ? { note } : {}) };
    tx.events.push(event);
    tx.status = to as never;
    emit();
  };

  const create = (kind: TxKind, prefix: keyof typeof db.counters, initial: string, fields: Partial<Transaction>): Transaction => {
    const n = db.counters[prefix]++;
    const tx: Transaction = {
      id: `${prefix.toLowerCase()}${n}`,
      ref: `${prefix}-PROTO-${String(n).padStart(4, '0')}`,
      customerId: db.profile.id,
      kind,
      asset: 'XRP',
      status: initial as never,
      createdAt: iso(),
      meta: {},
      events: [{ fromStatus: null, toStatus: initial as never, at: iso(), actor: 'Customer' }],
      ...fields,
    };
    post(kind, initial, tx.amountDrops ?? 0n, tx.platformFeeDrops ?? 0n, tx.asset);
    db.transactions.unshift(tx);
    emit();
    return tx;
  };

  /** Simulated staff/provider steps (in production these come from approval-decide, the worker and provider webhooks via Realtime). */
  const schedule = (steps: [number, () => void][]) => {
    let total = 0;
    for (const [ms, fn] of steps) {
      total += ms;
      setTimeout(() => {
        try {
          fn();
        } catch {
          /* a cancelled request simply stops advancing */
        }
      }, total);
    }
  };

  /** Same key → same result, including a retry that arrives while the first attempt is still running. A failure frees the key. */
  const once = <T>(key: string, fn: () => T | Promise<T>): Promise<T> => {
    const hit = idempotency.get(key);
    if (hit) return hit as Promise<T>;
    const pending = Promise.resolve().then(fn);
    idempotency.set(key, pending);
    pending.catch(() => idempotency.delete(key));
    return pending;
  };

  const api: Api & { subscribe: (l: Listener) => () => void } = {
    mode: 'demo',
    now,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },

    signIn: async (_email, password) => {
      await wait();
      if (db.badAttempts >= 5) return { status: 'error', attemptsLeft: 0, locked: true };
      // Demo: any password containing "wrong" fails, so the error and lock-out states can be reviewed.
      if (password.toLowerCase().includes('wrong')) {
        db.badAttempts += 1;
        return { status: 'error', attemptsLeft: Math.max(0, 5 - db.badAttempts), locked: db.badAttempts >= 5 };
      }
      db.badAttempts = 0;
      db.signedIn = true;
      emit();
      return { status: 'ok' };
    },
    requestPasswordReset: async () => wait(),
    signUp: async (input) => {
      await wait();
      db.profile = { ...db.profile, fullName: input.name, email: input.email, country: input.country, currency: input.currency as never };
      db.kyc = 'not_started';
      db.signedIn = true;
      emit();
    },
    signOut: async () => {
      db.signedIn = false;
      emit();
    },

    profile: async () => ({ ...db.profile, kycStatus: db.kyc }),
    assets: async () =>
      ASSETS.map(
        (a): AssetInfo => ({
          id: a.id,
          name: a.name,
          network: a.network,
          decimals: a.decimals,
          memo: a.memo,
          depositMode: a.deposit,
          depositOpen: a.deposit === 'automatic' || !!seed.DEMO_DEPOSIT_ADDRESSES[a.id],
          yieldAprBps: a.yieldAprBps,
          collateral: a.collateral,
          limits: assetLimits(a.id),
        }),
      ),
    holdings: async () => Object.entries(db.holdings).map(([asset, b]): Holding => ({ asset, ...b })),
    transactions: async () => db.transactions.map((t) => ({ ...t, events: [...t.events] })),
    notifications: async () => db.notifications.map((n) => ({ ...n })),
    depositInfo: async (asset) => {
      const a = assetSpec(asset);
      if (a.deposit === 'automatic') {
        return { asset, mode: 'automatic', address: seed.DEPOSIT_ADDRESS, tag: '48201937', memo: null, network: a.network, testnet: true, minDrops: assetLimits(asset).minDeposit };
      }
      return {
        asset,
        mode: 'reported',
        address: seed.DEMO_DEPOSIT_ADDRESSES[asset] ?? '',
        tag: null,
        memo: a.memo === 'memo' ? '48201937' : null,
        network: a.network,
        testnet: true,
        minDrops: assetLimits(asset).minDeposit,
      };
    },
    loan: async () => ({ ...db.loan }),
    yieldPositions: async () => db.yieldPositions.map((p) => ({ ...p })),
    allowlist: async () => db.allowlist.map((a) => ({ ...a })),
    devices: async () => db.devices.map((d) => ({ ...d })),
    securityEvents: async () => db.securityEvents.map((e) => ({ ...e })),
    tickets: async () => db.tickets.map((t) => ({ ...t, messages: [...t.messages] })),
    legalDocuments: async () => seed.legalDocs,
    consents: async () => db.consents.map((c) => ({ ...c })),
    externalWallets: async () => db.externalWallets.map((x) => ({ ...x })),
    custodyStatus: async () => ({ provider: 'operational', reconciledAt: '2026-10-19T11:00:00Z', subAccount: 'CUST-PROTO-0042' }),

    markNotificationsRead: async (ids) => {
      for (const n of db.notifications) if (!n.readAt && (!ids || ids.includes(n.id))) n.readAt = iso();
      emit();
    },

    reportDeposit: (input) =>
      once(input.idempotencyKey, async () => {
        await wait(500);
        const lim = assetLimits(input.asset);
        if (input.amountUnits < lim.minDeposit) throw new Error(`The minimum deposit is ${formatAmount(lim.minDeposit, input.asset)}.`);
        if (db.transactions.some((t) => t.kind === 'deposit' && t.meta.tx_hash === input.txHash && t.status !== 'rejected')) {
          throw new Error('That transaction has already been reported.');
        }
        const n = db.counters.DEP++;
        const tx: Transaction = {
          id: `dep${n}`,
          ref: `DEP-PROTO-${n}`,
          customerId: db.profile.id,
          kind: 'deposit',
          asset: input.asset,
          status: 'reported',
          amountDrops: input.amountUnits,
          createdAt: iso(),
          ...(input.from ? { counterparty: input.from } : {}),
          meta: { tx_hash: input.txHash, reported_by: 'customer' },
          events: [{ fromStatus: null, toStatus: 'reported', at: iso(), actor: 'Customer' }],
        };
        db.transactions.unshift(tx);
        notify({ type: 'tx', tone: 'warn', icon: 'recv', title: 'Deposit reported', body: `We’re confirming your ${formatAmount(input.amountUnits, input.asset)} deposit. It’s not in your balance yet.`, link: '/' });
        emit();
        // Simulates Operations confirming it on the network and approving the credit in the console.
        schedule([
          [9000, () => transition(tx, 'validated', 'A. Bello (Operations)', 'Confirmed on the network by staff')],
          [800, () => transition(tx, 'screened', 'A. Bello (Operations)')],
          [
            800,
            () => {
              transition(tx, 'credited', 'A. Bello (Operations)');
              notify({ type: 'tx', tone: 'ok', icon: 'recv', title: 'Deposit credited', body: `${formatAmount(input.amountUnits, input.asset)} is now in your available balance.`, link: '/' });
            },
          ],
        ]);
        return tx;
      }),

    requestWithdrawal: (input) =>
      once(input.idempotencyKey, async () => {
        await wait(500);
        if (db.profile.frozen) throw new Error('Your account is frozen. Contact support.');
        const a = assetSpec(input.asset);
        const lim = assetLimits(input.asset);
        if (!isAssetAddress(input.asset, input.destination)) throw new Error(`That isn’t a valid ${a.network} address.`);
        if (input.amountDrops < lim.minWithdrawal) throw new Error(`The minimum withdrawal is ${formatAmount(lim.minWithdrawal, input.asset)}.`);
        const tx = create('withdrawal', 'WD', 'requested', {
          asset: input.asset,
          amountDrops: input.amountDrops,
          platformFeeDrops: lim.withdrawalFee,
          networkFeeDrops: networkFeeEstimate(input.asset),
          counterparty: input.destination,
          destinationTag: a.memo === 'tag' ? input.destinationTag : null,
          meta: {
            approvals_required: input.amountDrops > lim.approvalThreshold ? '2' : '1',
            ...(a.memo === 'memo' && input.memo ? { memo: input.memo } : {}),
          },
        });
        transition(tx, 'in_review');
        return tx;
      }),
    cancelWithdrawal: async (id) => {
      const tx = db.transactions.find((t) => t.id === id);
      if (tx) transition(tx, 'cancelled', 'Customer');
    },

    requestExchange: (input) =>
      once(input.idempotencyKey, async () => {
        await wait(500);
        const lim = assetLimits(input.asset);
        if (input.amountDrops < lim.minProduct) throw new Error(`The minimum request is ${formatAmount(lim.minProduct, input.asset)}.`);
        if (input.amountDrops > available(input.asset)) throw new Error('That’s more than your available balance.');
        const est = exchangeEstimateFor(input.asset, input.amountDrops, latestPrice(input.asset));
        const tx = create('exchange', 'EX', 'requested', {
          asset: input.asset,
          counterAsset: input.toAsset,
          amountDrops: input.amountDrops,
          meta: { indicative_cents: est.receive.toString(), receive: input.toAsset ?? 'USD' },
        });
        schedule([
          [
            6000,
            () => {
              tx.meta.reviewed_at = iso();
              transition(tx, 'quote_requested', 'A. Bello (Operations)');
            },
          ],
          [
            4000,
            () => {
              const priceMicro = latestPrice(input.asset);
              const expiresAt = new Date(now().getTime() + 60_000).toISOString();
              if (input.toAsset) {
                const toPrice = latestPrice(input.toAsset);
                const sw = swapEstimate(input.amountDrops, { asset: input.asset, price: priceMicro }, { asset: input.toAsset, price: toPrice });
                db.quotes.set(tx.id, {
                  quoteId: `QT-${tx.ref}`,
                  priceMicro,
                  feeCents: unitsToCents(sw.fee, toPrice, input.toAsset),
                  receiveCents: unitsToCents(sw.receive, toPrice, input.toAsset),
                  receiveUnits: sw.receive,
                  expiresAt,
                });
              } else {
                const e = exchangeEstimateFor(input.asset, input.amountDrops, priceMicro);
                db.quotes.set(tx.id, { quoteId: `QT-${tx.ref}`, priceMicro, feeCents: e.fee + e.payout, receiveCents: e.gross - e.fee - e.payout, expiresAt });
              }
              transition(tx, 'quoted', '[Liquidity provider]');
            },
          ],
        ]);
        return tx;
      }),
    currentQuote: async (txId) => db.quotes.get(txId) ?? null,
    acceptQuote: async (txId, quoteId) => {
      const tx = db.transactions.find((t) => t.id === txId);
      const q = db.quotes.get(txId);
      if (!tx || !q || q.quoteId !== quoteId) throw new Error('Quote not found');
      if (Date.parse(q.expiresAt) < now().getTime()) throw new Error('This quote has expired. Request a new one.');
      if (tx.counterAsset) tx.counterAmount = q.receiveUnits ?? null;
      transition(tx, 'accepted', 'Customer');
      schedule([
        [5000, () => transition(tx, 'sold', '[Liquidity provider]')],
        [5000, () => transition(tx, 'paid_out', '[Bank / payout provider]')],
      ]);
    },
    requestNewQuote: async (txId) => {
      const tx = db.transactions.find((t) => t.id === txId);
      if (!tx) return;
      if (tx.status === 'quoted') transition(tx, 'quote_expired');
      transition(tx, 'quote_requested', 'Customer');
      schedule([
        [
          3000,
          () => {
            const q = db.quotes.get(txId);
            if (q) db.quotes.set(txId, { ...q, expiresAt: new Date(now().getTime() + 60_000).toISOString() });
            transition(tx, 'quoted', '[Liquidity provider]');
          },
        ],
      ]);
    },
    cancelExchange: async (txId) => {
      const tx = db.transactions.find((t) => t.id === txId);
      if (tx) transition(tx, 'cancelled', 'Customer');
    },

    allocateYield: (input) =>
      once(input.idempotencyKey, async () => {
        await wait(500);
        const a = assetSpec(input.asset);
        if (a.yieldAprBps === null) throw new Error(`There’s no yield product for ${a.name} yet.`);
        const lim = assetLimits(input.asset);
        if (input.amountDrops < lim.minProduct) throw new Error(`The minimum allocation is ${formatAmount(lim.minProduct, input.asset)}.`);
        const tx = create('yield_allocate', 'YLD', 'requested', { asset: input.asset, amountDrops: input.amountDrops, meta: { product: `${a.id} Flexible` } });
        schedule([
          [2000, () => transition(tx, 'sent')],
          [
            8000,
            () => {
              transition(tx, 'confirmed', '[Yield provider]');
              const pos = yieldPos(input.asset);
              if (pos) pos.allocatedDrops += input.amountDrops;
              else
                db.yieldPositions.push({
                  product: `${a.id.toLowerCase()}_flexible`,
                  asset: a.id,
                  allocatedDrops: input.amountDrops,
                  aprBps: a.yieldAprBps ?? 0,
                  feeBps: 1000,
                  since: iso(),
                  creditedDrops: 0n,
                  confirmedUnpaidDrops: 0n,
                  estimatedAccruedDrops: 0n,
                });
              emit();
            },
          ],
        ]);
        return tx;
      }),
    redeemYield: (input) =>
      once(input.idempotencyKey, async () => {
        await wait(500);
        const pos = yieldPos(input.asset);
        if (!pos || input.amountDrops > pos.allocatedDrops) throw new Error(`You have ${formatAmount(pos?.allocatedDrops ?? 0n, input.asset)} allocated.`);
        const tx = create('yield_redeem', 'YLD', 'requested', { asset: input.asset, amountDrops: input.amountDrops, meta: { product: `${input.asset} Flexible` } });
        schedule([
          [2000, () => transition(tx, 'sent')],
          [
            8000,
            () => {
              transition(tx, 'confirmed', '[Yield provider]');
              pos.allocatedDrops -= input.amountDrops;
              emit();
            },
          ],
        ]);
        return tx;
      }),

    applyLoan: (input) =>
      once(input.idempotencyKey, async () => {
        await wait(500);
        const a = assetSpec(input.asset);
        if (!a.collateral) throw new Error(`${a.name} can’t be used as collateral yet.`);
        if (input.collateralDrops > available(input.asset)) throw new Error(`You only have ${formatAmount(available(input.asset), input.asset)} available.`);
        return create('loan', 'LN', 'applied', { asset: input.asset, amountDrops: input.collateralDrops, amountCents: input.principalCents, meta: {} });
      }),
    repayLoan: (input) =>
      once(input.idempotencyKey, async () => {
        await wait(500);
        const tx = create('loan_repay', 'R', 'recorded', { amountCents: input.amountCents, meta: { loan_ref: db.loan.ref, via: input.via } });
        tx.ref = `${db.loan.ref} · repayment R${db.counters.R - 1}`;
        schedule([
          [3000, () => transition(tx, input.via === 'bank' ? 'awaiting_payment' : 'selling')],
          [6000, () => transition(tx, 'received', '[Lending provider]')],
          [
            3000,
            () => {
              transition(tx, 'applied', '[Lending provider]');
              const owed = db.loan.principalCents + db.loan.interestCents;
              const paid = input.amountCents > owed ? owed : input.amountCents;
              const interestPaid = paid > db.loan.interestCents ? db.loan.interestCents : paid;
              db.loan.interestCents -= interestPaid;
              db.loan.principalCents -= paid - interestPaid;
              if (db.loan.principalCents + db.loan.interestCents === 0n) {
                const b = db.holdings[db.loan.collateralAsset] ?? ZERO;
                db.holdings[db.loan.collateralAsset] = {
                  ...b,
                  collateral: b.collateral - db.loan.collateralDrops,
                  available: b.available + db.loan.collateralDrops,
                };
                db.loan.collateralDrops = 0n;
                db.loan.status = 'repaid';
              }
              emit();
            },
          ],
        ]);
        return tx;
      }),
    addCollateral: (input) =>
      once(input.idempotencyKey, async () => {
        await wait(500);
        const tx = create('loan_collateral', 'C', 'recorded', { asset: db.loan.collateralAsset, amountDrops: input.amountDrops, meta: { loan_ref: db.loan.ref } });
        tx.ref = `${db.loan.ref} · collateral C${db.counters.C - 1}`;
        schedule([
          [3000, () => transition(tx, 'sent')],
          [6000, () => transition(tx, 'lock_confirmed', '[Lending provider]')],
          [
            2000,
            () => {
              transition(tx, 'ltv_updated');
              db.loan.collateralDrops += input.amountDrops;
              emit();
            },
          ],
        ]);
        return tx;
      }),

    setAllowlist: async (enabled) => {
      db.profile.allowlistEnabled = enabled;
      db.securityEvents.unshift({
        id: `s${Date.now()}`,
        title: enabled ? 'Withdrawal allowlist turned on' : 'Withdrawal allowlist turned off',
        meta: 'Just now · iPhone 15',
        at: iso(),
      });
      emit();
    },
    changePassword: async () => {
      await wait();
      db.profile.passwordChangedAt = iso();
      db.devices = db.devices.filter((d) => d.current);
      db.securityEvents.unshift({ id: `s${Date.now()}`, title: 'Password changed · other devices signed out', meta: 'Just now · iPhone 15', at: iso() });
      emit();
    },
    addAllowlistAddress: async (input) => {
      if (!isAssetAddress(input.asset, input.address)) throw new Error(`That isn’t a valid ${assetSpec(input.asset).network} address.`);
      db.allowlist.push({
        id: `a${Date.now()}`,
        asset: input.asset,
        memo: input.memo ?? null,
        label: input.label,
        address: input.address,
        tag: input.tag,
        activeFrom: new Date(now().getTime() + 24 * 3600_000).toISOString(),
      });
      db.securityEvents.unshift({ id: `s${Date.now()}`, title: 'Allowlist address added', meta: `Just now · ${input.label}`, at: iso() });
      emit();
    },
    removeAllowlistAddress: async (id) => {
      const a = db.allowlist.find((x) => x.id === id);
      db.allowlist = db.allowlist.filter((x) => x.id !== id);
      db.securityEvents.unshift({ id: `s${Date.now()}`, title: 'Allowlist address removed', meta: `Just now · ${a?.label ?? ''}`, at: iso() });
      emit();
    },
    revokeDevice: async (id) => {
      const d = db.devices.find((x) => x.id === id);
      if (d?.current) throw new Error('You can’t sign out the device you’re using.');
      db.devices = db.devices.filter((x) => x.id !== id);
      db.securityEvents.unshift({ id: `s${Date.now()}`, title: `Signed out · ${d?.name ?? 'device'}`, meta: 'Just now · iPhone 15', at: iso() });
      emit();
    },

    createTicket: async (input) => {
      await wait();
      const ticket: SupportTicket = {
        ref: `SUP-${String(db.counters.SUP++).padStart(4, '0')}`,
        subject: input.topic + (input.transactionRef ? ` · ${input.transactionRef}` : ''),
        topic: input.topic,
        transactionRef: input.transactionRef,
        createdAt: iso(),
        status: 'open',
        messages: [
          { from: 'me', text: input.message.trim(), meta: 'You · now' },
          { from: 'them', text: 'Thanks — we’ve received your request. Typical first reply: within 4 business hours.', meta: 'Automatic reply' },
        ],
      };
      db.tickets.unshift(ticket);
      emit();
      return ticket;
    },
    acceptConsent: async (document, version) => {
      await wait();
      const consent: Consent = {
        document,
        version,
        acceptedAt: iso(),
        surface: 'Legal & disclosures',
        consentId: `CNS-PROTO-${String(db.counters.CNS++).padStart(4, '0')}`,
      };
      db.consents = db.consents.filter((c) => c.document !== document).concat(consent);
      emit();
      return consent;
    },
    setDisplayCurrency: async (currency) => {
      db.profile.currency = currency as never;
      emit();
    },
    addWatchWallet: async (address) => {
      db.externalWallets = [{ address, access: 'watch', balanceDrops: 312_400_000n }];
      emit();
    },
    addSelfCustodyWallet: async (address) => {
      db.externalWallets = [{ address, access: 'self_custody', balanceDrops: 312_400_000n }];
      emit();
    },
    removeExternalWallet: async (address) => {
      db.externalWallets = db.externalWallets.filter((x) => x.address !== address);
      emit();
    },

    kycStatus: async () => db.kyc,
    submitKyc: async () => {
      await wait(600);
      db.kyc = 'in_progress';
      emit();
      return { reference: 'KYC-PROTO-0042' };
    },
  };
  return api;
};

export const demoApi = createDemoApi();
export const subscribeDemo = (demoApi as Api & { subscribe: (l: () => void) => () => void }).subscribe;
