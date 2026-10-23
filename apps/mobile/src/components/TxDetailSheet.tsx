import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { TxView } from '@/data/describeTx';
import { Banner } from './Banner';
import { Card } from './Card';
import { CopyButton } from './CopyButton';
import { IconButton } from './IconButton';
import { KV } from './KV';
import { Grab, Sheet } from './Sheet';
import { Status } from './Status';
import { T } from './T';
import { Timeline } from './Timeline';
import { TxIcon } from './TxRow';

/** Transaction detail sheet (Home, XRP detail, history): amount, status, details, progress, note, copy + help. */
export const TxDetailSheet = ({
  tx,
  onClose,
  stacked,
  closeLabel = 'Close',
}: {
  tx: TxView | null;
  onClose: () => void;
  stacked?: boolean;
  closeLabel?: string;
}) => {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [tx?.id]);
  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 2600);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <Sheet open={!!tx} onClose={onClose} scrim="home" maxHeight={stacked ? 0.9 : 0.82} stackBehavior="push" accessibilityLabel={tx?.title}>
      {tx ? (
        <>
          <Grab />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <TxIcon icon={tx.icon} asset={tx.asset} />
            <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
              <T size={17} weight={600} accessibilityRole="header">
                {tx.title}
              </T>
              <T size={12.5} color="text3">
                {tx.when}
              </T>
            </View>
            <IconButton icon="close" label={closeLabel} onPress={onClose} style={{ marginRight: -10 }} />
          </View>
          <View style={{ alignItems: 'center', gap: 4, paddingTop: 8, paddingBottom: 16 }}>
            <T size={30} weight={500} ls={-0.02} num>
              {tx.amount}
            </T>
            <T size={13} color="text3" num>
              {tx.fiat}
            </T>
            <View style={{ marginTop: 6 }}>
              <Status tone={tx.tone} label={tx.status} />
            </View>
          </View>
          <Card>
            <KV fixedKeys items={tx.rows.map((r) => ({ k: r.k, v: r.v, ...(r.mono ? { mono: true } : {}) }))} rowPad={10} />
          </Card>
          <T size={13} weight={600} color="text2" style={{ marginTop: 18, marginHorizontal: 4, marginBottom: 8 }}>
            Progress
          </T>
          <Card>
            <Timeline steps={tx.steps} size={13.5} inlineTime />
          </Card>
          <Banner tone={tx.noteTone} icon="info" style={{ marginTop: 12 }}>
            {tx.note}
          </Banner>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <CopyButton
              label={copied ? 'Copied' : 'Copy reference'}
              height={44}
              radius={8}
              font={13.5}
              style={{ flex: 1 }}
              onPress={() => {
                Clipboard.setStringAsync(tx.ref).catch(() => undefined);
                setCopied(true);
              }}
            />
            <CopyButton
              label="Get help with this"
              weight={500}
              role="link"
              height={44}
              radius={8}
              font={13.5}
              style={{ flex: 1 }}
              onPress={() => {
                onClose();
                router.push({ pathname: '/support', params: { tx: tx.ref } });
              }}
            />
          </View>
        </>
      ) : null}
    </Sheet>
  );
};
