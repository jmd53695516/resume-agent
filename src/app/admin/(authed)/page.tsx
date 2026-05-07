// src/app/admin/(authed)/page.tsx
// Phase 4 D-B-02 — /admin redirects to default landing /admin/sessions.
// Lives under (authed) route group so the parent layout's requireAdmin()
// guards this redirect; unauth users hit the (authed) layout's NotAuthorized
// fallback rather than getting an unguarded 308.
import { redirect } from 'next/navigation';

export default function AdminIndexPage() {
  redirect('/admin/sessions');
}
