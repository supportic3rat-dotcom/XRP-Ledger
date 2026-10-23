import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

// Registered as 'Geist' / 'Geist Mono', which the design's font stacks name directly.
const geist = Geist({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-geist', adjustFontFallback: false });
const geistMono = Geist_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-geist-mono', adjustFontFallback: false });

export const metadata: Metadata = { title: 'XRP Ledger — Overview', description: 'Your custodial XRP Ledger account.' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
