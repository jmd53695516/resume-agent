// src/components/EmailGate.tsx
// GATE-02 + GATE-04 + GATE-05 email gate.
// - zod v4 email validation (Pitfall 6: use z.email({ message }), not deprecated
//   z.string().email()).
// - On successful POST /api/session: sessionStorage.setItem('session_id', id)
//   THEN router.push('/chat'). Order matters — the /chat stub reads this key
//   on mount.
// - Button label: "Let's chat" per CONTEXT.md specifics.
//
// Plan 02-04 (SAFE-13): Cloudflare Turnstile is wired conditionally. When
// `NEXT_PUBLIC_TURNSTILE_ENABLED !== 'true'` (the default), this file behaves
// EXACTLY as Plan 01-03 — no widget, no UX impact. When the flag is on AND
// `NEXT_PUBLIC_TURNSTILE_SITE_ID` is set, the widget renders below the email
// input and submit is gated on a valid token. The token is forwarded server-
// side via the `turnstile_token` field in the request body, where it is
// verified against Cloudflare's siteverify endpoint.
'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Turnstile } from '@marsidev/react-turnstile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EmailSchema = z.email({
  message: "That doesn't look like a valid email — try again?",
});

// Next.js inlines NEXT_PUBLIC_* at build time. Compute these at module scope
// so they constant-fold to literals when the flag is off (zero-cost when
// disabled — the entire Turnstile branch tree-shakes).
const turnstileEnabled = process.env.NEXT_PUBLIC_TURNSTILE_ENABLED === 'true';
const turnstileSiteId = process.env.NEXT_PUBLIC_TURNSTILE_SITE_ID;

export function EmailGate() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Synchronous double-submit guard. The `submitting` state alone races with
  // rapid Enter keystrokes because state updates are async — ref flips
  // immediately so the second call short-circuits (REVIEW WR-03).
  const submittingRef = useRef(false);

  const result = EmailSchema.safeParse(email);
  const showInlineError = touched && !result.success && email.length > 0;
  const inlineError = showInlineError ? result.error.issues[0]?.message : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current || !result.success) return;
    if (turnstileEnabled && !turnstileToken) return;
    submittingRef.current = true;
    setSubmitting(true);
    setServerError(null);
    try {
      const body: Record<string, string> = { email };
      if (turnstileEnabled && turnstileToken) {
        body.turnstile_token = turnstileToken;
      }
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setServerError(errBody.error ?? 'Something went wrong. Try again?');
        return;
      }
      const { id } = await res.json();
      sessionStorage.setItem('session_id', id);
      router.push('/chat');
    } catch {
      setServerError('Network trouble. Try again?');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex max-w-sm flex-col gap-3">
      <Label htmlFor="email">Your email (so Joe can follow up if you&apos;re hiring)</Label>
      <Input
        id="email"
        type="email"
        maxLength={254}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder="you@company.com"
        aria-invalid={!!inlineError}
        aria-describedby={inlineError ? 'email-error' : undefined}
        disabled={submitting}
        required
      />
      {inlineError && (
        <p id="email-error" className="text-sm text-red-600">
          {inlineError}
        </p>
      )}
      {turnstileEnabled && turnstileSiteId && (
        <div data-testid="turnstile-widget">
          <Turnstile
            siteKey={turnstileSiteId}
            onSuccess={(token) => setTurnstileToken(token)}
            onError={() => setTurnstileToken(null)}
            onExpire={() => setTurnstileToken(null)}
            options={{ theme: 'auto', size: 'normal' }}
          />
        </div>
      )}
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button
        type="submit"
        disabled={!result.success || submitting || (turnstileEnabled && !turnstileToken)}
      >
        {submitting ? 'Starting…' : "Let's chat"}
      </Button>
    </form>
  );
}
