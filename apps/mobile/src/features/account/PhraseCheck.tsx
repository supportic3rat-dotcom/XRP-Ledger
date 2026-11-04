import { PHRASE_LENGTH } from '@xrp/schemas';
import type { CustomerProfile } from '@xrp/types';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { create } from 'zustand';
import { Button } from '@/components/Button';
import { ErrorText, Help } from '@/components/Form';
import { PhrasePicker } from '@/components/PhrasePicker';
import { Grab, Sheet } from '@/components/Sheet';
import { T } from '@/components/T';
import { api } from '@/data';
import { qk } from '@/data/keys';
import { queryClient } from '@/data/queryClient';
import { SUPPORT_EMAIL } from '@/lib/support';

export const PHRASE_MISMATCH = 'Those words or their order don’t match. Try again.';

/** The 30-word grid with a count, a way to start over, the error and the submit button. */
export const PhraseEntry = ({
  words,
  picked,
  onPick,
  error,
  busy,
  submitLabel,
  onSubmit,
}: {
  words: string[];
  picked: string[];
  onPick: (next: string[]) => void;
  error: string;
  busy: boolean;
  submitLabel: string;
  onSubmit: () => void;
}) => (
  <View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <T size={12.5} color="text3" num>{`${picked.length} of ${PHRASE_LENGTH} picked`}</T>
      {picked.length ? (
        <Pressable accessibilityRole="button" onPress={() => onPick([])} hitSlop={12}>
          <T size={13} weight={500} color="accentText">
            Start over
          </T>
        </Pressable>
      ) : null}
    </View>
    <PhrasePicker words={words} picked={picked} onChange={onPick} invalid={!!error} />
    <ErrorText>{error}</ErrorText>
    <Button label={submitLabel} loading={busy} disabled={picked.length < PHRASE_LENGTH} onPress={onSubmit} />
  </View>
);

type Pending = { title: string; resolve: (ok: boolean) => void };
const usePhraseCheck = create<{ pending: Pending | null }>()(() => ({ pending: null }));

/**
 * Asks for the security phrase before a withdrawal or deposit. Resolves true once it matches (or right away when the
 * customer hasn't turned it on), false if they close the sheet.
 */
export const confirmPhrase = (title: string): Promise<boolean> => {
  if (queryClient.getQueryData<CustomerProfile>(qk.profile)?.securityPhraseEnabled === false) return Promise.resolve(true);
  return new Promise((resolve) => {
    usePhraseCheck.getState().pending?.resolve(false);
    usePhraseCheck.setState({ pending: { title, resolve } });
  });
};

/** Mounted once at the root; shows the sheet `confirmPhrase` asks for. */
export const PhraseCheckHost = () => {
  const pending = usePhraseCheck((s) => s.pending);
  const [words, setWords] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = (ok: boolean) => {
    pending?.resolve(ok);
    usePhraseCheck.setState({ pending: null });
    setWords(null);
    setPicked([]);
    setError('');
  };

  const load = () => {
    setError('');
    api
      .phraseChallenge()
      .then((ch) => (ch ? setWords(ch.words) : finish(true)))
      .catch(() => {
        setWords([]);
        setError('We couldn’t load your security phrase. Check your connection and try again.');
      });
  };
  useEffect(() => {
    if (pending) load();
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.verifyPhrase(picked);
      if (r.ok) finish(true);
      else {
        setPicked([]);
        setError(PHRASE_MISMATCH);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t check your security phrase. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!pending && words !== null} onClose={() => finish(false)} scrim="deep" shadow="strong" maxHeight={0.92} accessibilityLabel="Enter your security phrase">
      <Grab />
      <T size={18} weight={600} style={{ marginBottom: 6 }} accessibilityRole="header">
        {pending?.title ?? 'Enter your security phrase'}
      </T>
      <Help style={{ marginBottom: 14 }}>Tap your 6 words in the order you chose them.</Help>
      {words?.length ? (
        <PhraseEntry words={words} picked={picked} onPick={(p) => (setPicked(p), setError(''))} error={error} busy={busy} submitLabel="Confirm" onSubmit={() => void submit()} />
      ) : (
        <View style={{ gap: 12 }}>
          <ErrorText>{error}</ErrorText>
          <Button label="Try again" onPress={load} />
        </View>
      )}
      <Help align="center" style={{ marginTop: 14 }}>{`Forgot your phrase? Email ${SUPPORT_EMAIL} from the address on your account.`}</Help>
    </Sheet>
  );
};
