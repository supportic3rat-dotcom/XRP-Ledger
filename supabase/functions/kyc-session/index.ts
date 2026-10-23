import { fnSchemas } from '@xrp/schemas';
import { customerId } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

const SIGNED_URL_SECONDS = 60;

/**
 * Starts identity verification with the KYC provider and returns signed upload URLs (60 s) into the private
 * `kyc` bucket, which only Compliance can read. The decision arrives by provider-webhook-kyc.
 */
export const handler = defineFunction({
  name: 'kyc-session',
  schema: fnSchemas['kyc-session'],
  access: { kind: 'customer' },
  run: async (ctx) => {
    const me = customerId(ctx);
    const { documentType, country, addressDocument } = ctx.input;
    const session = await ctx.providers.kyc.createSession({ customerId: me, documentType, country });
    const files = documentType === 'passport' ? ['id-photo', 'selfie', `address-${addressDocument}`] : ['id-front', 'id-back', 'selfie', `address-${addressDocument}`];
    const uploads: Record<string, { path: string; token: string; signedUrl: string }> = {};
    for (const file of files) {
      const path = `${me}/${session.sessionId}/${file}`;
      const { data, error } = await ctx.db.storage.from('kyc').createSignedUploadUrl(path);
      if (error || !data) throw error ?? new Error('Upload URL failed');
      uploads[file] = { path, token: data.token, signedUrl: data.signedUrl };
    }
    await ctx.rpc('kyc_started', {
      p_customer: me,
      p_provider_ref: session.sessionId,
      p_document_type: documentType,
      p_country: country,
      p_documents: files.map((f) => `${me}/${session.sessionId}/${f}`),
    });
    return { reference: session.sessionId, uploads, expiresIn: SIGNED_URL_SECONDS };
  },
});

if (import.meta.main) serve(handler);
