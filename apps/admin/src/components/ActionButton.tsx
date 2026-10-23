'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useTransition } from 'react';
import type { ActionResult } from '@/lib/data/types';
import { useToast } from './Toast';

/**
 * A design `<button class="btn …">` that runs a Server Action, toasts its message and refreshes the server
 * view. Errors from SQL / Edge Functions are shown as they come.
 */
export const ActionButton = ({
  action,
  className,
  disabled,
  children,
  onDone,
}: {
  action: () => Promise<ActionResult>;
  className: string;
  disabled?: boolean;
  children: ReactNode;
  onDone?: (r: ActionResult) => void;
}) => {
  const router = useRouter();
  const say = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      onClick={() =>
        start(async () => {
          const r = await action();
          if (r.ok) {
            if (r.message) say(r.message);
          } else say(r.error);
          onDone?.(r);
          router.refresh();
        })
      }
    >
      {children}
    </button>
  );
};
