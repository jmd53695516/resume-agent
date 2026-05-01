// src/lib/logger.ts
// Phase 3 D-I-01..05: Pino-backed structured JSON logger. Direct stdout, no transports
// (Pitfall 8 — pino-pretty's worker threads break on Vercel serverless).
// Same export signature as Phase 2 console.log shim so route.ts call sites are unchanged.
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const baseLogger = pino(
  {
    level: isDev ? 'debug' : 'info',
    // String-name level so Vercel log search greps `level: "info"` cleanly
    // (Pino default is numeric — 30, 40, 50). Phase 2 shim emitted strings;
    // preserve that shape (D-I-05 substrate-swap-not-content-change).
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    // ISO timestamp; Vercel parses both ISO and ms.
    timestamp: pino.stdTimeFunctions.isoTime,
    // Suppress pid + hostname (meaningless on Vercel serverless; noise in greps).
    base: undefined,
  },
  // Route through process.stdout so tests can spy on stdout.write and so we
  // never spawn a worker thread (Pitfall 8 — pino-pretty/transports break on
  // Vercel serverless). Pino's default `pino.destination(1)` bypasses
  // process.stdout via fs.writeSync; passing the stream forces .write() calls.
  process.stdout,
);

type Level = 'debug' | 'info' | 'warn' | 'error';
export function log(payload: Record<string, unknown>, level: Level = 'info'): void {
  baseLogger[level](payload);
}

// New for Phase 3 — child loggers per route or per request.
// Plan 03-02 uses this in route.ts to pre-bind session_id on every line.
export function childLogger(bindings: Record<string, unknown>) {
  return baseLogger.child(bindings);
}
