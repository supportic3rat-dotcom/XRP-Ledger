'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Staff sign-in: email + password, then the authenticator code (aal2 is required for every console page). */
export const SignInForm = ({ url, anonKey, reason }: { url: string; anonKey: string; reason: string | null }) => {
  const router = useRouter();
  const [step, setStep] = useState<'password' | 'totp'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(
    reason === 'mfa' ? 'Staff accounts need an authenticator code. Sign in again.' : reason === 'idle' ? 'Signed out after 15 minutes without activity.' : '',
  );
  const [busy, setBusy] = useState(false);
  const db = createBrowserClient(url, anonKey);

  const submitPassword = async () => {
    setBusy(true);
    setError('');
    const { error: e } = await db.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (e) {
      setError('That email and password don’t match a staff account.');
      return;
    }
    setStep('totp');
  };
  const submitCode = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    setError('');
    const { data } = await db.auth.mfa.listFactors();
    const factor = data?.totp.find((f) => f.status === 'verified');
    if (!factor) {
      setBusy(false);
      setError('This account has no authenticator set up. Ask an administrator to enrol one.');
      return;
    }
    const { error: e } = await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (e) {
      setError('That code didn’t match. Check your authenticator app and try again.');
      return;
    }
    router.replace('/');
    router.refresh();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void (step === 'password' ? submitPassword() : submitCode());
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {step === 'password' ? (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 500 }}>
            Work email
            <input className="in" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 500 }}>
            Password
            <input className="in" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </>
      ) : (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 500 }}>
          Authenticator code
          <input
            className="in mono"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </label>
      )}
      {error ? (
        <span role="alert" style={{ fontSize: 12.5, color: 'var(--neg)' }}>
          {error}
        </span>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {step === 'password' ? 'Continue' : 'Verify and sign in'}
      </button>
    </form>
  );
};
