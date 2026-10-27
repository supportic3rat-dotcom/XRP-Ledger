import type { ReactNode } from 'react';

/** Page header: title, one-line purpose, and the environment pill. */
export const PageHead = ({ title, sub, env }: { title: string; sub: string; env: ReactNode }) => (
  <header className="flex flex-wrap items-center justify-between gap-[12px]">
    <div className="flex flex-col gap-[2px]">
      <h1 className="m-0 text-[21px] font-semibold tracking-[-0.015em]">{title}</h1>
      <p className="m-0 text-[13.5px] text-text-2">{sub}</p>
    </div>
    {env}
  </header>
);

export const EnvPill = ({ demo }: { demo: boolean }) => (
  <span className="pill warn">
    {demo
      ? 'Staging · XRPL testnet · sample data'
      : `${process.env.NEXT_PUBLIC_ENV_LABEL ?? 'Staging'} · XRPL ${process.env.NEXT_PUBLIC_XRPL_NETWORK ?? 'testnet'}`}
  </span>
);
