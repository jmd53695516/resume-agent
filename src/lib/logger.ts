// src/lib/logger.ts
// D-K-01/02 — structured JSON logs to stdout. Pino is deliberately NOT used
// in Phase 2 per CONTEXT.md (worker-thread transport issues on Vercel).
// Phase 4 observability revisits.

type Level = 'debug' | 'info' | 'warn' | 'error';

export function log(payload: Record<string, unknown>, level: Level = 'info'): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    ...payload,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
