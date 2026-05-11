'use client';

/**
 * Phase 05.2 (D-B-01..03): top-right view toggle pill.
 *
 * Source: design-bundle/project/Chat Stream.html:240-284.
 *
 * D-B-02: Labels are "Light Mode" / "Dark Mode" — DELIBERATE cheeky
 * double-meaning where "Dark Mode" launches the matrix view. DO NOT
 * flatten to honest "Chat" / "Matrix" under code-review pressure.
 * The recruiter clicks "Dark Mode" expecting a normal dark theme,
 * gets a Hollywood digital-rain Easter egg — the design medium IS
 * the message.
 *
 * D-B-03: state lives in chat/page.tsx, no persistence (no localStorage,
 * no sessionStorage, no prefers-color-scheme). Resets on page reload.
 *
 * Matrix-mode visual variant is handled entirely by Plan 05.2-02's
 * body.matrix-mode [data-testid="view-toggle"] CSS — no conditional
 * styling logic in this component (CD-04 — same DOM, different CSS).
 */

type Props = {
  view: 'chat' | 'matrix';
  onChange: (v: 'chat' | 'matrix') => void;
};

export function ViewToggle({ view, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="View"
      data-testid="view-toggle"
      className="fixed right-[18px] top-[18px] z-50 inline-flex rounded-full border border-black/10 bg-white/80 p-[3px] backdrop-blur-md backdrop-saturate-150 shadow-[0_4px_20px_-8px_rgba(15,15,20,0.18),0_1px_0_rgba(255,255,255,0.6)_inset]"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === 'chat'}
        data-testid="view-toggle-light"
        onClick={() => onChange('chat')}
        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-[7px] text-[12.5px] font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--me)] ${
          view === 'chat'
            ? 'bg-foreground text-[var(--panel)]'
            : 'text-muted-foreground'
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-55" />
        Light Mode
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'matrix'}
        data-testid="view-toggle-dark"
        onClick={() => onChange('matrix')}
        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-[7px] text-[12.5px] font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--me)] ${
          view === 'matrix'
            ? 'bg-foreground text-[var(--panel)]'
            : 'text-muted-foreground'
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-55" />
        Dark Mode
      </button>
    </div>
  );
}
