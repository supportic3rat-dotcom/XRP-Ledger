'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hasBackend } from '@/lib/env';
import { DEMO_ROLE_COOKIE } from '@/lib/session';

/** Demo mode only: choose which sample staff member to be. */
export const chooseDemoRole = async (role: 'operations' | 'compliance' | 'auditor') => {
  if (hasBackend()) return;
  (await cookies()).set(DEMO_ROLE_COOKIE, role, { httpOnly: true, sameSite: 'strict', path: '/', secure: process.env.NODE_ENV === 'production' });
  redirect('/');
};
