// src/app/admin/(authed)/layout.tsx
// Phase 4 D-B-03 — admin shell. Calls requireAdmin() at top (Layer 2 of
// two-layer perimeter; Layer 1 is src/proxy.ts). On null result, renders
// <NotAuthorized />. Otherwise renders the top-bar nav and the child page.
//
// This layout lives under route group `(authed)` so /admin/login (a sibling
// route, not under this group) can render unauthenticated for the OAuth
// sign-in flow. URLs are unaffected by route groups (parens-wrapped folder).
//
// Freshness: `dynamic = 'force-dynamic'` makes every request SSR-fresh.
// Do NOT also set `revalidate = 60` — under force-dynamic that's dead code
// (Next.js silently ignores it). D-B-04's "60s segment revalidate" intent is
// satisfied by force-dynamic + AdminNav's manual Refresh button.
import { requireAdmin } from '@/lib/admin-auth';
import NotAuthorized from '../components/NotAuthorized';
import { AdminNav } from '../components/AdminNav';

export const dynamic = 'force-dynamic'; // never static — auth + recent data

export default async function AuthedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) {
    return <NotAuthorized />;
  }
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <AdminNav />
      <main className="px-6 py-6">{children}</main>
    </div>
  );
}
