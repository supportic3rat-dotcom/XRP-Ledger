import { assertEquals } from 'jsr:@std/assert@1';
import { findExceptions } from '../recon-run/index.ts';

const base = {
  omnibus_drops: '0', customer_liabilities_drops: '0', suspense_drops: '0', validated_ledger: 1, chain: {}, wallets: [],
  suspense_deposits: [], delayed: [], unbooked_fees: null,
};

Deno.test('unbooked fees explain a hot-wallet difference; nothing else is flagged', () => {
  const result = {
    hot: { internal: '84210250036', provider: '84210250000', chain: '84210250000' },
    warm: { internal: '250000000000', provider: '250000000000', chain: '250000000000' },
  };
  const out = findExceptions({ ...base, unbooked_fees: { count: 3, drops: '36' } }, result);
  assertEquals(out.map((e) => e.kind), ['unbooked_fee']);
  assertEquals(out[0]!.note, 'Hot wallet · 3 withdrawals · 0.000036 XRP');
});

Deno.test('an unexplained difference is a mismatch', () => {
  const out = findExceptions(base, { cold: { internal: '950400000000', provider: '950400000000', chain: '950399000000' } });
  assertEquals(out.map((e) => e.kind), ['mismatch']);
});

Deno.test('suspense deposits and late provider confirmations become exceptions with the design’s copy', () => {
  const out = findExceptions(
    {
      ...base,
      suspense_deposits: [{ id: 'd', ref: 'DEP-PROTO-2050', amount_drops: '500000000' }],
      delayed: [{ id: 'y', ref: 'YLD-PROTO-0112', kind: 'yield_allocate', amount_drops: '300000000', minutes: 41 }],
    },
    {},
  );
  assertEquals(out.map((e) => e.note), ['DEP-PROTO-2050 · 500.00 XRP held in suspense', 'YLD-PROTO-0112 · 300.00 XRP pending at [Yield provider] for 41m']);
});
