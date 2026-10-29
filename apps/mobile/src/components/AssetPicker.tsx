import { formatAmount, unitsToCents } from '@xrp/ledger';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useHoldings, usePriceMap } from '@/data/hooks';
import { useMoney } from '@/lib/money';
import { familyFor, useTheme } from '@/theme';
import { Card } from './Card';
import { CoinLogo } from './CoinLogo';
import { InputWrap, Radio, SelectChevron } from './Form';
import { Icon } from './Icon';
import { Row } from './Row';
import { Grab, Sheet } from './Sheet';
import { T } from './T';

export type PickableAsset = { id: string; name: string; network: string; note?: string; disabled?: boolean };

/** Search + list of assets with logo, network and the customer's available balance. Used inside a sheet or inline. */
export const AssetList = ({
  assets,
  value,
  onPick,
  showBalance = true,
}: {
  assets: PickableAsset[];
  value?: string | null;
  onPick: (id: string) => void;
  showBalance?: boolean;
}) => {
  const { c } = useTheme();
  const holdings = useHoldings();
  const { prices } = usePriceMap();
  const m = useMoney();
  const [q, setQ] = useState('');
  const avail = (id: string) => holdings.data?.find((h) => h.asset === id)?.available ?? 0n;
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle ? assets.filter((a) => a.id.toLowerCase().includes(needle) || a.name.toLowerCase().includes(needle)) : assets;
    // Held assets first, by USD value; then the rest in registry order.
    return [...filtered].sort((a, b) => {
      const va = unitsToCents(avail(a.id), prices[a.id] ?? 0n, a.id);
      const vb = unitsToCents(avail(b.id), prices[b.id] ?? 0n, b.id);
      return vb > va ? 1 : vb < va ? -1 : 0;
    });
  }, [q, assets, holdings.data, prices]);
  return (
    <>
      <InputWrap height={44} style={{ marginBottom: 12 }}>
        <Icon name="search" size="sm" color="text3" />
        <TextInput
          accessibilityLabel="Search assets"
          value={q}
          onChangeText={setQ}
          placeholder="Search name or symbol"
          placeholderTextColor={c.text3}
          autoCapitalize="none"
          autoCorrect={false}
          style={[{ flex: 1, fontSize: 15, fontFamily: familyFor(400), color: c.text, padding: 0 }, { outlineStyle: 'none' } as object]}
        />
      </InputWrap>
      <Card>
        {list.map((a, i) => {
          const units = avail(a.id);
          return (
            <Row
              key={a.id}
              first={i === 0}
              minHeight={60}
              accessibilityRole="button"
              accessibilityLabel={`${a.name}, ${a.id}, ${a.network}${a.disabled ? `. ${a.note ?? 'Unavailable'}` : ''}`}
              accessibilityState={{ selected: a.id === value }}
              onPress={a.disabled ? undefined : () => onPick(a.id)}
            >
              <View style={{ opacity: a.disabled ? 0.45 : 1 }}>
                <CoinLogo asset={a.id} size={36} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <T weight={500} color={a.disabled ? 'text3' : 'text'} numberOfLines={1}>{`${a.name} · ${a.id}`}</T>
                <T size={12} color="text3" numberOfLines={1}>
                  {a.note ?? a.network}
                </T>
              </View>
              {showBalance && units > 0n ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <T size={13.5} weight={500} num>
                    {formatAmount(units, a.id)}
                  </T>
                  <T size={12} color="text3" num>
                    {m.money(unitsToCents(units, prices[a.id] ?? 0n, a.id))}
                  </T>
                </View>
              ) : null}
              {value !== undefined ? <Radio on={a.id === value} /> : null}
            </Row>
          );
        })}
        {list.length === 0 ? (
          <T size={13.5} color="text3" align="center" style={{ paddingVertical: 20 }}>
            No assets match “{q}”.
          </T>
        ) : null}
      </Card>
    </>
  );
};

/** A select field showing the chosen asset's logo; opens a searchable asset sheet. */
export const AssetSelect = ({
  label,
  value,
  assets,
  onChange,
  height = 56,
}: {
  label: string;
  value: string;
  assets: PickableAsset[];
  onChange: (id: string) => void;
  height?: number;
}) => {
  const [open, setOpen] = useState(false);
  const current = assets.find((a) => a.id === value);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${current ? `${current.name}, ${current.id}` : 'none'}`} onPress={() => setOpen(true)}>
        <InputWrap height={height} focused={open}>
          {current ? <CoinLogo asset={current.id} size={28} /> : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={15} weight={500} numberOfLines={1}>
              {current ? `${current.name} · ${current.id}` : 'Choose an asset'}
            </T>
            {current ? (
              <T size={12} color="text3" numberOfLines={1}>
                {current.network}
              </T>
            ) : null}
          </View>
          <SelectChevron />
        </InputWrap>
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} maxHeight={0.86} accessibilityLabel={label}>
        <Grab />
        <T size={18} weight={600} style={{ marginBottom: 14 }} accessibilityRole="header">
          {label}
        </T>
        <AssetList
          assets={assets}
          value={value}
          onPick={(id) => {
            onChange(id);
            setOpen(false);
          }}
        />
      </Sheet>
    </>
  );
};

/** "US dollars to your bank account" choice, shown above the asset list when receiving. */
export const UsdOption = ({ on, onPress }: { on: boolean; onPress: () => void }) => (
  <Row first minHeight={60} accessibilityRole="button" accessibilityLabel="US dollars, paid to your bank account" accessibilityState={{ selected: on }} onPress={onPress}>
    <CoinLogo asset="USD" size={36} />
    <View style={{ flex: 1, gap: 1 }}>
      <T weight={500}>US dollars · USD</T>
      <T size={12} color="text3">
        Paid to your bank account
      </T>
    </View>
    <Radio on={on} />
  </Row>
);
