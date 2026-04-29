// src/app/chat/page.tsx
// Phase 1 stub — exercises GATE-04 (sessionStorage read) without pulling in the
// AI SDK. Phase 2 replaces this file entirely with the real streaming chat UI.
// 'use client' is required because sessionStorage is undefined during SSR and
// useEffect only runs client-side. If no session_id is found, redirect back to
// the landing page so a direct /chat visit isn't a dead end.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ChatStub() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const id = sessionStorage.getItem('session_id');
    if (!id) {
      router.replace('/');
      return;
    }
    setSessionId(id);
    setChecked(true);
  }, [router]);

  if (!checked) {
    // Brief flash while we decide whether to redirect. Keeping this minimal
    // avoids rendering the "coming in Phase 2" copy to a user who will
    // immediately be redirected away.
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-6 py-12">
      <h1 className="text-xl font-semibold text-slate-900">Chat coming in Phase 2</h1>
      <p className="text-slate-700">
        Your session started. I&apos;ll remember the email you left and pick up the streaming chat
        once it lands.
      </p>
      <p className="text-sm text-slate-600">
        Session id: <code className="rounded bg-slate-100 px-1 py-0.5">{sessionId}</code>
      </p>
    </main>
  );
}
