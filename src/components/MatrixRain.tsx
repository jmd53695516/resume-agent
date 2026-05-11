'use client';

/**
 * Phase 05.2 (D-A-04, CD-02..04): matrix-rain digital cascade background.
 *
 * Source: design-bundle/project/matrix-rain.jsx (port verbatim with TS).
 * Bundle tunables ARE the visual signature — DO NOT alter glyph palette,
 * fontSize, trailFade, speed range, or headWhiteChance. The look is
 * tuned, not arbitrary.
 *
 * Lazy-mounted from chat/page.tsx via next/dynamic({ ssr: false })
 * (CD-02 — keep canvas + RAF out of default chat-mode bundle).
 *
 * CD-03 defensive gates inside the useEffect:
 *   - prefers-reduced-motion: reduce → return early (canvas mounts blank)
 *   - viewport width < 768px → return early (mobile skips rain entirely)
 *
 * CD-04: this is a visual layer ONLY. It sits at z-index 1 (behind the
 * chat panel which gets z-index 5 in matrix mode via Plan 05.2-02 CSS).
 * pointer-events: none — clicks pass through to the live chat panel.
 * The conversation continues to stream above it; matrix is a SKIN.
 *
 * RESEARCH §Pattern 6 + Assumption A5: useRef(0) for RAF id; cleanup
 * cancels the most recent loop. StrictMode double-invoke produces
 * mount → cancel → mount → cancel pattern, ending with one loop alive.
 */

import { useEffect, useRef } from 'react';

const MATRIX_GLYPHS =
  // Half-width katakana (45 chars)
  'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ' +
  // Digits
  '0123456789' +
  // Latin uppercase + symbols for variety
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  ':・."=*+-<>¦|';

// Bundle tunables — DO NOT alter. Visual signature.
const RAIN = {
  fontSize: 18,
  trailFade: 0.06,
  flipChance: 0.04,
  speedMin: 0.35,
  speedMax: 0.95,
  resetTopMin: -50,
  resetTopMax: -5,
  resetChanceAtBottom: 0.018,
  headWhiteChance: 0.72,
} as const;

type Column = {
  y: number;
  speed: number;
  length: number;
  glyphs: string[];
};

function pickGlyph(): string {
  return MATRIX_GLYPHS[Math.floor(Math.random() * MATRIX_GLYPHS.length)];
}

function makeColumn(rowsTall: number): Column {
  return {
    y: Math.random() * rowsTall,
    speed: RAIN.speedMin + Math.random() * (RAIN.speedMax - RAIN.speedMin),
    length: 12 + Math.floor(Math.random() * 26),
    glyphs: [],
  };
}

type Props = {
  visible: boolean;
};

export function MatrixRain({ visible }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!visible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // CD-03: a11y gate — skip animation if user prefers reduced motion.
    // Canvas stays mounted (so the dark background still renders) but
    // there is no animation loop. Static green-on-black is still readable.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    // CD-03: viewport gate — skip animation on small viewports where
    // canvas overhead matters more. Mobile gets the green chat skin
    // (from Plan 02 CSS) but no rain.
    if (window.innerWidth < 768) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Cap DPR at 2 to avoid excess fillrate on retina (UI-SPEC line 850).
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // WR-02 fix: Canvas 2D's `font` setter does not resolve CSS custom
    // properties — `var(--font-matrix)` inside ctx.font is silently
    // ignored. Resolve the family from the actual computed style once at
    // setup so swapping --font-matrix in CSS propagates to the canvas.
    // Fall back to literal 'Share Tech Mono' if the variable is unset.
    const resolvedFontFamily =
      getComputedStyle(document.body).getPropertyValue('--font-matrix').trim() ||
      "'Share Tech Mono'";
    const fontShorthand = `${RAIN.fontSize}px ${resolvedFontFamily}, 'Share Tech Mono', monospace`;

    let width = 0;
    let height = 0;
    let cols: Column[] = [];

    function resize() {
      if (!canvas) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
        ctx.scale(dpr, dpr);
      }
      width = w;
      height = h;
      const colCount = Math.ceil(width / RAIN.fontSize);
      const rowsTall = Math.ceil(height / RAIN.fontSize);
      cols = Array.from({ length: colCount }, () => makeColumn(rowsTall));
    }

    resize();
    window.addEventListener('resize', resize);

    function step() {
      if (!ctx) return;

      // Per-frame fade — black overlay at trailFade alpha. Produces the
      // classic decay-trail effect.
      ctx.fillStyle = `rgba(0, 0, 0, ${RAIN.trailFade})`;
      ctx.fillRect(0, 0, width, height);

      ctx.font = fontShorthand;
      ctx.textBaseline = 'top';

      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const x = i * RAIN.fontSize;

        // Re-randomize trailing glyphs occasionally (flipChance).
        for (let k = 0; k < col.glyphs.length; k++) {
          if (Math.random() < RAIN.flipChance) {
            col.glyphs[k] = pickGlyph();
          }
        }

        // Draw the trail (older glyphs first, head last).
        for (let k = col.glyphs.length - 1; k >= 0; k--) {
          const t = k / col.length;
          const r = Math.floor(10 * (1 - t));
          const g = Math.floor(255 * (1 - t * 0.85));
          const b = Math.floor(60 * (1 - t * 0.9));
          ctx.shadowBlur = 0;
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          const yPx = (col.y - k) * RAIN.fontSize;
          if (yPx > -RAIN.fontSize && yPx < height) {
            ctx.fillText(col.glyphs[k] ?? pickGlyph(), x, yPx);
          }
        }

        // Add a new head glyph at the top of the column.
        const headGlyph = pickGlyph();
        const headColor = Math.random() < RAIN.headWhiteChance ? '#d6ffe6' : '#9bff9b';
        ctx.shadowColor = '#7cff7c';
        ctx.shadowBlur = 8;
        ctx.fillStyle = headColor;
        const headY = col.y * RAIN.fontSize;
        if (headY > -RAIN.fontSize && headY < height) {
          ctx.fillText(headGlyph, x, headY);
        }

        // Push the new head on the trail; trim to length.
        col.glyphs.unshift(headGlyph);
        if (col.glyphs.length > col.length) col.glyphs.length = col.length;

        // Advance the column.
        col.y += col.speed;

        // Reset when past viewport bottom (probabilistically).
        if (col.y * RAIN.fontSize > height && Math.random() < RAIN.resetChanceAtBottom) {
          col.y = RAIN.resetTopMin + Math.random() * (RAIN.resetTopMax - RAIN.resetTopMin);
          col.length = 12 + Math.floor(Math.random() * 26);
          col.glyphs = [];
          col.speed = RAIN.speedMin + Math.random() * (RAIN.speedMax - RAIN.speedMin);
        }
      }

      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [visible]);

  return (
    <div
      data-testid="matrix-rain-stage"
      aria-hidden={!visible}
      className={`fixed inset-0 z-[1] pointer-events-none transition-opacity duration-[400ms] bg-black ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <canvas
        ref={canvasRef}
        data-testid="matrix-canvas"
        className="absolute inset-0 block h-full w-full"
      />
      {/* Vignette overlay — radial gradient darkens edges. */}
      <div
        className="absolute inset-0 mix-blend-multiply"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      {/* Scanlines overlay — repeating linear gradient. */}
      <div
        className="absolute inset-0 mix-blend-multiply opacity-60"
        style={{
          background:
            'repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,.18) 3px, rgba(0,0,0,0) 4px)',
        }}
      />
    </div>
  );
}
