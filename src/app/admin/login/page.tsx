'use client';

// src/app/admin/login/page.tsx
// Phase 4 D-A-04 / D-A-05 — only unauthed-accessible /admin route. Renders
// the GitHub OAuth sign-in button. Excluded from src/proxy.ts matcher.
//
// UI contract: 04-UI-SPEC.md §1 — centered card on --bg-page, shadcn Button
// with GitHub icon, error message via ?error=oauth_failed query param.
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { supabaseBrowser } from '@/lib/supabase-browser';

// lucide-react v1.x removed brand icons (Github/Twitter/etc.) — use the
// canonical inline GitHub mark (MIT-licensed, ships with simple-icons /
// GitHub Octicons). Sized via SVG width/height; mr-2 spacing matches the
// shadcn Button SVG slot.
function GitHubMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="mr-2"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.16c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.16 1.18a10.96 10.96 0 0 1 5.75 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

export default function AdminLoginPage() {
  const sp = useSearchParams();
  const oauthFailed = sp.get('error') === 'oauth_failed';

  async function signInWithGitHub() {
    await supabaseBrowser.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-page)] px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-[var(--panel)] p-8 shadow-sm">
        <h1 className="mb-2 text-center text-xl font-semibold">Admin sign in</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Sign in with your GitHub account to access the dashboard.
        </p>
        <Button
          size="lg"
          variant="default"
          className="w-full"
          onClick={signInWithGitHub}
        >
          <GitHubMark size={18} />
          Sign in with GitHub
        </Button>
        {oauthFailed && (
          <p className="mt-4 text-center text-sm text-destructive">
            Sign in failed. Try again or contact Joe.
          </p>
        )}
      </div>
    </main>
  );
}
