// Team allow-list for the "email only" sign-in.
//
// NOTE: this is a lightweight gate, not hard security — the directory data is readable
// by anyone with the public API key once anonymous sign-in is on. It exists so only
// recognised team emails get into the UI. To add someone, drop their email in
// ALLOWED_EMAILS, or add their whole company domain to ALLOWED_DOMAINS.

const ALLOWED_DOMAINS = ['yventures.com.sg'];

const ALLOWED_EMAILS = [
  'lyj898@gmail.com',
];

export function isAllowed(rawEmail: string): boolean {
  const email = rawEmail.trim().toLowerCase();
  if (!email.includes('@')) return false;
  if (ALLOWED_EMAILS.includes(email)) return true;
  const domain = email.split('@')[1];
  return ALLOWED_DOMAINS.includes(domain);
}
