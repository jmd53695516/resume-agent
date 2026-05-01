// src/app/chat/layout.tsx
// SERVER COMPONENT. Mounts StatusBanner above the chat page (which is a Client
// Component). Plan 03-04 D-F-01 — banner on both / and /chat to capture
// deep-linkers who land on /chat without coming through /.
import { StatusBanner } from '@/components/StatusBanner';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StatusBanner page="chat" />
      {children}
    </>
  );
}
