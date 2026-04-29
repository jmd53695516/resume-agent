// src/components/EmailGate.tsx
// GATE-02 + GATE-04 + GATE-05 email gate.
// - zod v4 email validation (Pitfall 6: use z.email({ message }), not deprecated
//   z.string().email()).
// - On successful POST /api/session: sessionStorage.setItem('session_id', id)
//   THEN router.push('/chat'). Order matters — the /chat stub reads this key
//   on mount.
// - Button label: "Let's chat" per CONTEXT.md specifics.
'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EmailSchema = z.email({
  message: "That doesn't look like a valid email — try again?",
});

export function EmailGate() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
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
    submittingRef.current = true;
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setServerError(body.error ?? 'Something went wrong. Try again?');
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
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={!result.success || submitting}>
        {submitting ? 'Starting…' : "Let's chat"}
      </Button>
    </form>
  );
}
