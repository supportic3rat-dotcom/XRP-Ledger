import { fnSchemas } from '@xrp/schemas';
import { defineFunction, serve } from '../_shared/handler.ts';

/** Compliance opens a full customer record; the read itself is written to the audit log in SQL. */
export const handler = defineFunction({
  name: 'customer-open',
  schema: fnSchemas['customer-open'],
  access: { kind: 'staff', roles: ['compliance'] },
  run: (ctx) => ctx.rpc('open_customer_record', { p_customer: ctx.input.customerId }, 'user'),
});

if (import.meta.main) serve(handler);
