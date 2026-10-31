export const dynamic = 'force-dynamic';

export function GET() {
  const value = process.env.GA_ID;
  const gaId = value && /^G-[A-Z0-9]+$/.test(value) ? value : null;
  return Response.json({ gaId }, { headers: { 'Cache-Control': 'no-store' } });
}
