import { formatAmount, unitsToCents } from '@xrp/ledger';
import { sparkPathFrom } from '@xrp/providers';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Card } from '@/components/Card';
import { Sparkline } from '@/components/Charts';
import { CoinLogo } from '@/components/CoinLogo';
import { InputWrap } from '@/components/Form';
import { Icon } from '@/components/Icon';
import { Row } from '@/components/Row';
import { Screen, ScrollBody } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { T } from '@/components/T';
import { useHoldings, useMarkets } from '@/data/hooks';
import { hm } from '@/lib/dates';
import { useMoney } from '@/lib/money';
import { familyFor, useTheme } from '@/theme';

type Filter = 'all' | 'held' | 'up' | 'down';

const pctText = (bps: number) => `${bps >= 0 ? '+' : '−'}${Math.abs(bps / 100).toFixed(2)}%`;

/** Live prices for every supported asset: logo, 7-day sparkline, price and 24h change. Tap through to the asset page. */
export const MarketsScreen = () => {
  const router = useRouter();
  const { c } = useTheme();
  const m = useMoney();
  const markets = useMarkets();
  const holdings = useHoldings();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const rows = markets.data ?? [];
  const live = rows.some((r) => r.live);
  const held = (id: string) => {
    const h = holdings.data?.find((x) => x.asset === id);
    return h ? h.available + h.reserved + h.pendingYield + h.yield + h.collateral : 0n;
  };
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => !needle || r.asset.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle))
      .filter((r) => (filter === 'held' ? held(r.asset) > 0n : filter === 'up' ? r.changeBps >= 0 : filter === 'down' ? r.changeBps < 0 : true))
      .sort((a, b) => (filter === 'up' ? b.changeBps - a.changeBps : filter === 'down' ? a.changeBps - b.changeBps : (a.rank ?? 999) - (b.rank ?? 999)));
  }, [rows, filter, q, holdings.data]);
  const totalCap = rows.reduce((s, r) => s + r.marketCapUsd, 0);
  const gainers = rows.filter((r) => r.changeBps >= 0).length;

  return (
    <Screen>
      <ScrollBody bottom={112}>
        <T size={24} weight={600} ls={-0.02} style={{ marginTop: 8, marginHorizontal: 4, marginBottom: 4 }} accessibilityRole="header">
          Markets
        </T>
        <T size={13} color="text3" style={{ marginHorizontal: 4, marginBottom: 14 }}>
          {live
            ? `Live USD prices · ${rows.length} assets · updated ${rows[0] ? hm(rows[0].updatedAt) : ''} WAT`
            : markets.isLoading
              ? 'Loading live prices…'
              : 'Sample prices'}
        </T>
        {!live && !markets.isLoading ? (
          <Banner tone="warn" icon="alert" style={{ marginBottom: 12 }}>
            Live market data is unavailable right now, so these are sample prices. Pull down later to retry.
          </Banner>
        ) : null}

        {live ? (
          <Card style={{ flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={12} color="text3">
                Market cap · these assets
              </T>
              <T size={16} weight={600} num>
                {m.compact(totalCap)}
              </T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={12} color="text3">
                Up in 24h
              </T>
              <T size={16} weight={600} num>{`${gainers} of ${rows.length}`}</T>
            </View>
          </Card>
        ) : null}

        <InputWrap height={44} style={{ marginBottom: 10 }}>
          <Icon name="search" size="sm" color="text3" />
          <TextInput
            accessibilityLabel="Search markets"
            value={q}
            onChangeText={setQ}
            placeholder="Search name or symbol"
            placeholderTextColor={c.text3}
            autoCapitalize="none"
            autoCorrect={false}
            style={[{ flex: 1, fontSize: 15, fontFamily: familyFor(400), color: c.text, padding: 0 }, { outlineStyle: 'none' } as object]}
          />
        </InputWrap>
        <Segmented
          label="Filter assets"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'held', label: 'Yours' },
            { value: 'up', label: 'Gainers' },
            { value: 'down', label: 'Losers' },
          ]}
          style={{ marginBottom: 12 }}
        />

        <Card>
          {list.map((a, i) => {
            const up = a.changeBps >= 0;
            const color = up ? c.pos : c.neg;
            const units = held(a.asset);
            return (
              <Row
                key={a.asset}
                first={i === 0}
                minHeight={66}
                onPress={() => router.push(`/asset/${a.asset}`)}
                accessibilityRole="link"
                accessibilityLabel={`${a.name}, ${m.price(a.priceMicro)}, ${up ? 'up' : 'down'} ${Math.abs(a.changeBps / 100).toFixed(2)} percent today. Show details`}
              >
                <CoinLogo asset={a.asset} size={36} />
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <T weight={500} numberOfLines={1}>
                    {a.name}
                  </T>
                  <T size={12} color="text3" numberOfLines={1}>
                    {units > 0n ? `${formatAmount(units, a.asset)} · ${m.money(unitsToCents(units, a.priceMicro, a.asset))}` : `${a.rank ? `#${a.rank} · ` : ''}${a.asset}`}
                  </T>
                </View>
                {a.sparkline.length > 1 ? <Sparkline path={sparkPathFrom(a.sparkline)} color={color} /> : null}
                <View style={{ alignItems: 'flex-end', gap: 2, minWidth: 84 }}>
                  <T weight={500} num>
                    {m.price(a.priceMicro)}
                  </T>
                  <T size={12.5} weight={500} num rawColor={color}>
                    {pctText(a.changeBps)}
                  </T>
                </View>
              </Row>
            );
          })}
          {list.length === 0 ? (
            <T size={13.5} color="text3" align="center" style={{ paddingVertical: 24 }}>
              {filter === 'held' ? 'You don’t hold any assets yet.' : 'No assets match.'}
            </T>
          ) : null}
        </Card>
        <T size={12} lh={1.5} color="text3" style={{ marginTop: 14, marginHorizontal: 4 }}>
          Sparklines show the last 7 days. Prices are for reference and aren’t a quote: exchanges are priced on a firm quote you accept.
        </T>
      </ScrollBody>
    </Screen>
  );
};
