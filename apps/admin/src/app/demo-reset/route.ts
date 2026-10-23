import { NextResponse } from 'next/server';
import { resetDemo } from '@/lib/data/demo';
import { hasBackend } from '@/lib/env';

/** Demo mode only: restore the sample data (used by the end-to-end tests). */
export const POST = () => {
  if (hasBackend()) return new NextResponse(null, { status: 404 });
  resetDemo();
  return NextResponse.json({ ok: true });
};
