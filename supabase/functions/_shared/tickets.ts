/** The app's SupportTicket shape, built from the rows ticket_create returns. */
export const ticketView = (t: { ref: string; subject: string; topic: string; transaction_ref: string | null; created_at: string; status: string }, message: string) => ({
  ref: t.ref,
  subject: t.subject,
  topic: t.topic,
  transactionRef: t.transaction_ref,
  createdAt: t.created_at,
  status: t.status,
  messages: [
    { from: 'me', text: message.trim(), meta: 'You' },
    { from: 'them', text: 'Thanks, we’ve got your message. We usually reply within 4 hours.', meta: 'Automatic reply' },
  ],
});
