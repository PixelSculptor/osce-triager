import { NextResponse } from 'next/server';

// TEMPORARY DIAGNOSTIC — REMOVE BEFORE MERGING.
// Logs runtime env values server-side (visible only via `wrangler tail`) and
// returns a MASKED view in the HTTP response so the URL alone never leaks secrets.
// Owner reads full values from `wrangler tail`. Rotate the DB password after use.
export const dynamic = 'force-dynamic';

function mask(value: string | undefined): string {
  if (value == null) return '<undefined>';
  if (value === '') return '<empty string>';
  if (value.length <= 8) return `len=${value.length} ****`;
  return `len=${value.length} ${value.slice(0, 4)}…${value.slice(-4)}`;
}

// Break a connection string into its non-secret parts (host/port/params) so we
// can confirm WHICH pooler/port/sslmode prod actually uses, without the password.
function describeDbUrl(raw: string | undefined) {
  if (!raw) return { present: false };
  try {
    const u = new URL(raw);
    return {
      present: true,
      protocol: u.protocol,
      user: mask(decodeURIComponent(u.username)),
      hasPassword: u.password.length > 0,
      host: u.hostname,
      port: u.port || '(default)',
      database: u.pathname.replace(/^\//, ''),
      searchParams: Object.fromEntries(u.searchParams.entries()),
    };
  } catch (e) {
    return {
      present: true,
      parseError: e instanceof Error ? e.message : String(e),
    };
  }
}

export function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Full values to server logs only (wrangler tail). NOT returned to the client.
  console.log('[debug-env] DATABASE_URL =', dbUrl);
  console.log('[debug-env] NEXT_PUBLIC_SUPABASE_URL =', supaUrl);
  console.log('[debug-env] NEXT_PUBLIC_SUPABASE_ANON_KEY =', anonKey);

  return NextResponse.json({
    note: 'TEMPORARY diagnostic — full values are in `wrangler tail`. Remove this route after use.',
    DATABASE_URL: describeDbUrl(dbUrl),
    NEXT_PUBLIC_SUPABASE_URL: supaUrl ?? '<undefined>',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: mask(anonKey),
  });
}
