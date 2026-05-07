'use client';

// src/app/admin/components/AdminNav.tsx
// Phase 4 D-B-03 / D-A-06 + 04-UI-SPEC §8 — top-bar nav.
//
// Background: bg-muted (subdued grey — admin chrome, not brand color).
// Active link: font-semibold + border-b-2 border-[--me] (accent underline).
// Right-side actions: Refresh (router.refresh) + Sign out (signOut → /).
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabaseBrowser } from '@/lib/supabase-browser';

const NAV_ITEMS = [
  { href: '/admin/sessions', label: 'Sessions' },
  { href: '/admin/cost', label: 'Cost' },
  { href: '/admin/abuse', label: 'Abuse' },
  { href: '/admin/health', label: 'Health' },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await supabaseBrowser.auth.signOut();
    router.push('/');
  }

  return (
    <nav className="flex h-11 items-center justify-between gap-6 border-b border-border bg-muted px-6">
      <ul className="flex items-center gap-6">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={
                  active
                    ? 'flex h-11 items-center border-b-2 border-[var(--me)] text-sm font-semibold text-foreground'
                    : 'flex h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground'
                }
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
          <RefreshCw size={14} className="mr-1" />
          Refresh
        </Button>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </nav>
  );
}
