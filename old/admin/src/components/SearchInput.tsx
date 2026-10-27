'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

/** Filters as you type by updating `?q=` (server-rendered list). */
export const SearchInput = ({ label, placeholder }: { label: string; placeholder: string }) => {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get('q') ?? '');
  return (
    <input
      className="in"
      aria-label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        const next = new URLSearchParams(params);
        if (e.target.value) next.set('q', e.target.value);
        else next.delete('q');
        router.replace(`${path}?${next.toString()}`, { scroll: false });
      }}
    />
  );
};
