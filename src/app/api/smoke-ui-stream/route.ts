// src/app/api/_smoke-ui-stream/route.ts
// Temporary Phase 2 smoke route — exercises AI SDK v6 createUIMessageStream
// end-to-end (RESEARCH Open Question A1). Delete after Plan 02-03 ChatUI
// confirms deflection rendering works via /api/chat (which uses the same
// chunk API from Plan 02-02).
//
// Usage: GET /api/_smoke-ui-stream returns a streaming assistant-style
// message so we can point a browser at it and confirm the wire protocol.
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(): Promise<Response> {
  const text =
    'Smoke test: createUIMessageStream + text-start/text-delta/text-end works in AI SDK v6.';
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute({ writer }) {
        const id = crypto.randomUUID();
        writer.write({ type: 'text-start', id });
        // Split into 3 deltas to verify streaming (not just atomic send)
        const parts = [text.slice(0, 30), text.slice(30, 60), text.slice(60)];
        for (const delta of parts) {
          writer.write({ type: 'text-delta', id, delta });
        }
        writer.write({ type: 'text-end', id });
      },
    }),
  });
}
