'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { LogoMark } from '@/components/LogoMark';

/** Customer sign-in for the web dashboard (not in the design; built from its field, button and card styles). */
export const SignIn = ({ url, anonKey }: { url: string; anonKey: string }) => {
  const router = useRouter();
  const db = useMemo(() => createBrowserClient(url, anonKey), [url, anonKey]);
  const [step, setStep] = useState<'password' | 'code'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const done = () => {
    router.replace('/');
    router.refresh();
  };
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (step === 'password') {
        const { error: e } = await db.auth.signInWithPassword({ email: email.trim(), password });
        if (e) return setError('That email and password don’t match.');
        const { data } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
        if (data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2') return setStep('code');
        return done();
      }
      if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code from your authenticator app.');
      const { data } = await db.auth.mfa.listFactors();
      const factor = data?.totp.find((f) => f.status === 'verified');
      const { error: e } = factor ? await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code }) : { error: new Error('no factor') };
      if (e) return setError('That code didn’t match. Check your authenticator app and try again.');
      done();
    } finally {
      setBusy(false);
    }
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
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>{step === 'password' ? 'Sign in' : 'Two-factor authentication'}</h1>
        {step === 'password' ? (
          <>
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
                <input
                  id="si-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="field">
            <label className="label" htmlFor="si-code">
              Authentication code
            </label>
            <div className="input-wrap">
              <input
                id="si-code"
                className="code-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <span className="help">Lost your authenticator? Use a backup code in the mobile app.</span>
          </div>
        )}
        {error ? (
          <span className="err" role="alert">
            {error}
          </span>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {step === 'password' ? 'Continue' : 'Verify and sign in'}
        </button>
      </form>
    </div>
  );
};
