import type { Href } from 'expo-router';

/** Console links from the data layer ("/queue?sel=…") as app routes under /ops. */
export const opsRoute = (href: string): Href => {
  const [path = '', query = ''] = href.split('?');
  const sel = new URLSearchParams(query).get('sel');
  switch (path) {
    case '/queue':
      return (sel ? `/ops/approval/${sel}` : '/ops/queue') as Href;
    case '/users':
      return (sel ? `/ops/customer/${sel}` : '/ops/users') as Href;
    case '/transactions':
      return (sel ? `/ops/tx/${sel}` : '/ops/transactions') as Href;
    case '/assets':
      return (sel ? `/ops/asset/${sel}` : '/ops/assets') as Href;
    case '/reconciliation':
    case '/custody':
    case '/audit':
      return `/ops${path}` as Href;
    default:
      return '/ops' as Href;
  }
};
