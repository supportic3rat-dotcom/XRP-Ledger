import { redirect } from 'next/navigation';
import { SignIn } from './SignIn';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !anonKey) redirect('/'); // demo mode has no accounts
  return <SignIn url={url} anonKey={anonKey} />;
}
