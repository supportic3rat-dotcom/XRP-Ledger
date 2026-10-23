'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { LogoMark } from '@/components/LogoMark';

/** Customer sign-in for the web dashboard (not in the design; built from its field, button and card styles). */
export const SignIn = ({ url, anonKey }: { url: string; anonKey: string }) => {
  const router = useRouter();
  const db = useMemo(() => createBrowserClient(url, anonKey), [url, anonKey]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  /** Email and password are the whole sign-in: there is no second step. */
  const submit = async () => {
    setBusy(true);
    setError('');
    const { error: e } = await db.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (e) return setError('That email and password don’t match.');
    router.replace('/');
    router.refresh();
  };

  return (
    <div
      className="app"
      style={{
        ['--accent' as string]: '#0A0A0A',
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        background: '#F7F8F6',
        color: '#17211D',
        fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: 14,
        lineHeight: 1.4,
      }}
    >
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ width: '100%', maxWidth: 400, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark />
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>XRP Ledger</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>Sign in</h1>
        <div className="field">
          <label className="label" htmlFor="si-email">
            Email
          </label>
          <div className="input-wrap">
            <input id="si-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="si-password">
            Password
          </label>
          <div className="input-wrap">
            <input id="si-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        {error ? (
          <span className="err" role="alert">
            {error}
          </span>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Sign in
        </button>
      </form>
    </div>
  );
};
