'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import type { NavEntry } from './Shell';

export const NavList = ({ nav }: { nav: NavEntry[] }) => {
  const path = usePathname();
  return (
    <nav className="navlist" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {nav.map((n) => {
        const on = n.href === '/' ? path === '/' : path.startsWith(n.href);
        return (
          <Link key={n.href} className={`nav-item ${on ? 'on' : ''}`} href={n.href} aria-current={on ? 'page' : undefined}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
            {n.count ? <span className="count">{n.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
};
