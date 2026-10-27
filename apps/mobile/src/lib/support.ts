/** Where customers ask for a password reset; Compliance replies with a new password from the console. */
export const SUPPORT_EMAIL = 'support.xrpledger@gmail.com';

/** A ready-to-send email to support asking for a password reset for `email`. */
export const passwordResetEmail = (email: string) =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Password reset request')}&body=${encodeURIComponent(
    `Hello,\n\nPlease reset the password for my account: ${email}\n\nI'm sending this from the email address on my account.\n\nThank you`,
  )}`;
