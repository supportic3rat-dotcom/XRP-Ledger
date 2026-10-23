import type { Drops } from '@xrp/types';
import { usdToMicro, xrpToDrops } from '@xrp/ledger';
import type { Providers } from './interfaces.ts';
import { chartPeriods, sampleSeries } from './series.ts';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
let counter = 0;
const id = (prefix: string) => `${prefix}-MOCK-${String(++counter).padStart(4, '0')}`;

const PRICE = usdToMicro('2.38');

/** Sample USD prices per asset for the mocks (XRP keeps the design's $2.38). Live prices come from CoinGecko. */
export const MOCK_PRICES: Record<string, bigint> = {
  XRP: PRICE, BTC: usdToMicro('98000'), ETH: usdToMicro('3801.33'), USDT: usdToMicro('1'), USDC: usdToMicro('1'),
  SOL: usdToMicro('182.40'), BNB: usdToMicro('612.50'), ADA: usdToMicro('0.71'), DOGE: usdToMicro('0.215'), TRX: usdToMicro('0.245'),
  LTC: usdToMicro('96.10'), AVAX: usdToMicro('34.20'), DOT: usdToMicro('6.85'), LINK: usdToMicro('17.90'), XLM: usdToMicro('0.38'),
  TON: usdToMicro('5.40'), BCH: usdToMicro('455.20'), POL: usdToMicro('0.48'),
};
const mockPrice = (asset = 'XRP') => MOCK_PRICES[asset] ?? PRICE;

/** Deterministic mocks used in development and tests. No network, no keys. */
export const createMockProviders = (opts: { latencyMs?: number } = {}): Providers => {
  const wait = () => delay(opts.latencyMs ?? 0);
  const transfers = new Map<string, { status: 'pending' | 'submitted' | 'validated' | 'failed'; ledgerHash: string | null; ledgerIndex: number | null }>();
  return {
    custody: {
      health: async () => ({ status: 'operational', note: 'API 120 ms · last balance sync 12:50' }),
      listWallets: async () => [
        { id: 'hot', tier: 'hot', address: 'rHotProtoKcV9tYwZ2hNa19xQb', balanceDrops: xrpToDrops('84210.25') },
        { id: 'warm', tier: 'warm', address: 'rWarmProtoKcV9tYwZ2hNb24mKc', balanceDrops: xrpToDrops('250000') },
        { id: 'cold', tier: 'cold', address: 'rColdProtoKcV9tYwZ2hNc3V9tY', balanceDrops: xrpToDrops('950400') },
      ],
      getBalances: async () => ({ totalDrops: xrpToDrops('1284610.25') }),
      requestWithdrawal: async () => {
        await wait();
        const t = { id: id('CUST'), status: 'submitted' as const, ledgerHash: null, ledgerIndex: null };
        transfers.set(t.id, t);
        return t;
      },
      getTransfer: async (transferId) => ({ id: transferId, ...(transfers.get(transferId) ?? { status: 'failed', ledgerHash: null, ledgerIndex: null }) }),
    },
    kyc: {
      createSession: async ({ customerId }) => ({
        sessionId: id(`KYC-${customerId.slice(0, 4)}`),
        uploadUrls: { front: 'mock://front', back: 'mock://back', selfie: 'mock://selfie', address: 'mock://address' },
      }),
      getResult: async () => ({ decision: 'in_progress' }),
      verifyWebhook: async (_raw, signature) => signature === 'mock-signature',
    },
    screening: {
      screenAddress: async () => ({ risk: 'low', hold: false, reference: id('SCR') }),
      screenTransfer: async () => ({ risk: 'low', hold: false, reference: id('SCR') }),
    },
    liquidity: {
      requestQuote: async ({ asset = 'XRP', toAsset }) => ({
        quoteId: id('QT'),
        priceMicro: asset === 'XRP' ? usdToMicro('2.3742') : mockPrice(asset),
        ...(toAsset ? { toPriceMicro: mockPrice(toAsset) } : {}),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
      executeQuote: async () => ({ executionId: id('EXE'), proceedsCents: 0n }),
    },
    payout: {
      createPayout: async () => ({ payoutId: id('PAY') }),
      getPayout: async () => ({ status: 'pending' }),
    },
    yield: {
      allocate: async () => ({ requestId: id('YLD') }),
      redeem: async () => ({ requestId: id('YLD') }),
      getStatement: async () => ({ grossDrops: xrpToDrops('2.10') as Drops, lines: [] }),
    },
    lending: {
      apply: async () => ({ applicationId: id('LNA') }),
      fund: async () => ({ loanId: id('LN') }),
      getLoan: async () => ({ status: 'active', owedCents: 60_493n }),
      liquidate: async () => ({ accepted: true }),
    },
    prices: {
      getPrice: async (asset) => ({ priceMicro: mockPrice(asset), at: new Date().toISOString(), source: '[Market data provider]' }),
      getHistory: async (asset, period) => {
        const spec = chartPeriods.find((p) => p.id === period) ?? chartPeriods[2]!;
        return sampleSeries(spec, Number(mockPrice(asset)) / 1_000_000, spec.n * 31 + 3, 0.05).map((v, i) => ({ at: String(i), priceMicro: BigInt(Math.round(v * 1_000_000)) }));
      },
    },
  };
};
