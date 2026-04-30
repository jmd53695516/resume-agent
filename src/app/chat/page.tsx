'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatUI } from '@/components/ChatUI';

export default function ChatPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const id = typeof window !== 'undefined' ? sessionStorage.getItem('session_id') : null;
    if (!id) {
      router.replace('/');
      return;
    }
    setSessionId(id);
  }, [router]);

  if (!hydrated || !sessionId) {
    // Brief flash before hydration / redirect. Avoids hydration mismatch.
    return null;
  }

  return <ChatUI sessionId={sessionId} />;
}
