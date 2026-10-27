import { adminCssVars } from '@xrp/tokens';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const geist = Geist({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-geist', adjustFontFallback: false });
const geistMono = Geist_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-geist-mono', adjustFontFallback: false });

export const metadata: Metadata = { title: 'XRP Ledger Ops', robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <head>
        {/* Colour tokens from packages/tokens, the single source for every app. */}
        <style>{`:root{${adminCssVars()}}`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
