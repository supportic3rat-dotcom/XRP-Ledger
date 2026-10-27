import type { Role } from './types';

type Personal = { name: string; email: string; phone: string; dob: string };

/** Personal data by role, as the design and the `customers_masked` view define it. */
export const maskPersonal = (p: Personal, role: Role): Personal => {
  const words = p.name.split(' ');
  const domain = p.email.split('@')[1] ?? '';
  const last4 = p.phone.replace(/\s/g, '').slice(-4);
  if (role === 'compliance') return p;
  if (role === 'operations') {
    return {
      name: `${words[0] ?? ''} ${(words[1] ?? '').charAt(0)}.`,
      email: `${p.email.slice(0, 2)}•••@${domain}`,
      phone: `${p.phone.split(' ')[0] ?? ''} ••• ••• ${last4}`,
      dob: `••••-••-•• (${p.dob.slice(0, 4)})`,
    };
  }
  return { name: words.map((w) => `${w.charAt(0)}••••`).join(' '), email: `•••@${domain}`, phone: `•••• ${last4}`, dob: 'Hidden' };
};

export const MASK_NOTE: Record<Role, string> = {
  compliance: 'Full personal data is visible to Compliance. Each record you open is written to the audit log.',
  operations: 'Operations sees partially masked personal data. Ask Compliance if you need the full record.',
  auditor: 'Auditors see masked personal data only. Balances and flags are shown in full.',
};
