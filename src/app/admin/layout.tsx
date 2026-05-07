// src/app/admin/layout.tsx
// Phase 4 — top-level admin segment layout. Intentionally a thin pass-through
// because /admin/login is a sibling route that MUST render for unauthenticated
// users (the OAuth sign-in entry point; Plan 04-02 D-A-05). A layout here that
// called requireAdmin() would render <NotAuthorized /> for unauth visitors and
// hide the login button.
//
// The actual auth-guarded admin shell lives under route group
// `src/app/admin/(authed)/layout.tsx` — it calls requireAdmin() and mounts
// AdminNav. Route groups don't change URLs, so /admin/sessions still resolves
// at the same URL.
//
// Per-page requireAdmin() (D-A-03 belt-and-suspenders) is also enforced on
// every (authed)/*/page.tsx server component.
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
