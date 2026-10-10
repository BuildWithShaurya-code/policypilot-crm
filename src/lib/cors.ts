const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

export function getAllowedOrigin(origin?: string | null): string | null {
  if (!origin) return null;
  const allowlist = new Set<string>(DEFAULT_ALLOWED_ORIGINS);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      allowlist.add(new URL(appUrl).origin);
    } catch {}
  }
  if (allowlist.has(origin)) {
    return origin;
  }
  return null;
}

export function corsHeaders(requestOrigin?: string | null): Record<string, string> {
  const allowed = getAllowedOrigin(requestOrigin);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
    'Vary': 'Origin',
  };

  if (allowed) {
    headers['Access-Control-Allow-Origin'] = allowed;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}
