import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { PhrasePicker } from '@/components/PhrasePicker';
import { renderScreen } from './render';

const WORDS = ['acorn', 'amber', 'anchor', 'apple', 'arrow', 'atlas', 'autumn', 'badge'];

const Harness = ({ onChange }: { onChange: (p: string[]) => void }) => {
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <PhrasePicker
      words={WORDS}
      picked={picked}
      onChange={(p) => {
        setPicked(p);
        onChange(p);
      }}
    />
  );
};

describe('Security phrase picker', () => {
  it('keeps the order words are tapped, renumbers when one is taken out, and stops at 6', async () => {
    const seen: string[][] = [];
    await renderScreen(<Harness onChange={(p) => seen.push(p)} />);
    for (const w of ['atlas', 'acorn', 'badge']) await fireEvent.press(screen.getByLabelText(w));
    expect(seen.at(-1)).toEqual(['atlas', 'acorn', 'badge']);
    expect(screen.getByLabelText('badge, word 3')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('acorn, word 2'));
    expect(seen.at(-1)).toEqual(['atlas', 'badge']);
    expect(screen.getByLabelText('badge, word 2')).toBeTruthy();

    for (const w of ['amber', 'anchor', 'apple', 'arrow']) await fireEvent.press(screen.getByLabelText(w));
    expect(seen.at(-1)).toHaveLength(6);
    await fireEvent.press(screen.getByLabelText('autumn'));
    expect(seen.at(-1)).toHaveLength(6);
  });
});
