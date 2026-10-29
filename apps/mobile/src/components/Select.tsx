import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { InputWrap, Radio, SelectChevron, TextField } from './Form';
import { Icon } from './Icon';
import { Row } from './Row';
import { Grab, Sheet } from './Sheet';
import { Card } from './Card';
import { T } from './T';

export type SelectOption = { value: string; label: string };

/** Select field: looks like the design's `.input-wrap select`; opens a bottom-sheet list (decision 14). Long lists get a search box. */
export const Select = ({
  label,
  value,
  options,
  onChange,
  placeholder,
  invalid,
  height = 52,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  height?: number;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = options.find((o) => o.value === value);
  const searchable = options.length > 12;
  const needle = query.trim().toLowerCase();
  const shown = needle ? options.filter((o) => o.label.toLowerCase().includes(needle) || o.value.toLowerCase() === needle) : options;
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${current?.label ?? placeholder ?? ''}`} onPress={() => setOpen(true)}>
        <InputWrap invalid={invalid} height={height} focused={open}>
          <T size={15} style={{ flex: 1 }} numberOfLines={1}>
            {current?.label ?? placeholder ?? ''}
          </T>
          <SelectChevron />
        </InputWrap>
      </Pressable>
      <Sheet open={open} onClose={close} maxHeight={searchable ? 0.9 : 0.7} accessibilityLabel={label}>
        <Grab />
        <T size={18} weight={600} style={{ marginBottom: 14 }} accessibilityRole="header">
          {label}
        </T>
        {searchable ? (
          <TextField
            accessibilityLabel={`Search ${label.toLowerCase()}`}
            placeholder="Search"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            height={44}
            leading={<Icon name="search" size="sm" color="text3" />}
            wrapStyle={{ marginBottom: 12 }}
          />
        ) : null}
        <Card>
          {shown.map((o, i) => (
            <Row
              key={o.value || 'empty'}
              first={i === 0}
              minHeight={52}
              accessibilityRole="button"
              accessibilityState={{ selected: o.value === value }}
              onPress={() => {
                onChange(o.value);
                close();
              }}
            >
              <T style={{ flex: 1 }} weight={500}>
                {o.label}
              </T>
              <Radio on={o.value === value} />
            </Row>
          ))}
          {shown.length === 0 ? (
            <T color="text3" style={{ padding: 16 }}>
              No matches
            </T>
          ) : null}
        </Card>
        <View style={{ height: 8 }} />
      </Sheet>
    </>
  );
};
