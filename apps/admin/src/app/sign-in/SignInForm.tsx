'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Staff sign-in: email and password. Every console page then checks the staff role on the server. */
export const SignInForm = ({ url, anonKey, reason }: { url: string; anonKey: string; reason: string | null }) => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    reason === 'staff' ? 'That account isn’t a staff account.' : reason === 'idle' ? 'Signed out after 15 minutes without activity.' : '',
  );
  const [busy, setBusy] = useState(false);
  const db = createBrowserClient(url, anonKey);

  const submit = async () => {
    setBusy(true);
    setError('');
    const { error: e } = await db.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (e) {
      setError('That email and password don’t match a staff account.');
      return;
    }
    router.replace('/');
    router.refresh();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 500 }}>
        Work email
        <input className="in" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 500 }}>
        Password
        <input className="in" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error ? (
        <span role="alert" style={{ fontSize: 12.5, color: 'var(--neg)' }}>
          {error}
        </span>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        Sign in
      </button>
    </form>
  );
};
