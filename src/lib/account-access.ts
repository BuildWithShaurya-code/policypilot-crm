/** Private business access is configured on the server, never through user metadata. */
export function isAccountAllowed(email?: string | null): boolean {
  const configured = process.env.APP_ALLOWED_EMAILS;
  if (!configured?.trim()) return process.env.NODE_ENV !== 'production';
  const allowed = configured.split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  return Boolean(email && allowed.includes(email.trim().toLowerCase()));
}
