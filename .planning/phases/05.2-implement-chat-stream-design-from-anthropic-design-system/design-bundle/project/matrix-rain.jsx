// matrix-rain.jsx — canvas-based digital rain.
// Original implementation, but tuned to the iconic look:
//   - black background
//   - falling vertical columns of glyphs
//   - leading glyph is bright white-green; trail fades from bright green to dark
//   - characters in each column "flip" (re-randomize) occasionally as they fall
//   - mix of half-width katakana, digits, and a few Latin letters

const MATRIX_GLYPHS =
  // half-width katakana — the most recognizable matrix glyphs
  'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ' +
  // digits
  '0123456789' +
  // a sprinkling of Latin + symbols for variety
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  ':・."=*+-<>¦|';

const RAIN = {
  fontSize: 18,           // px — column width is roughly this
  trailFade: 0.06,        // alpha of the per-frame black overlay (lower = longer trails)
  flipChance: 0.04,       // probability a non-head glyph re-randomizes per frame
  speedMin: 0.35,         // rows per frame
  speedMax: 0.95,
  resetTopMin: -50,       // when a column resets, start somewhere above the top
  resetTopMax: -5,
  resetChanceAtBottom: 0.018,  // chance per frame a column resets once past viewport
  headWhiteChance: 0.72,  // probability the head glyph is rendered nearly white
};

function MatrixRain({ visible }) {
  const canvasRef = React.useRef(null);
  const rafRef = React.useRef(0);
  const stateRef = React.useRef(null); // {cols: [...], width, height, dpr}

  // (Re)build column state for the current canvas size.
  const buildColumns = React.useCallback((width, height) => {
    const colCount = Math.ceil(width / RAIN.fontSize);
    const cols = new Array(colCount);
    for (let i = 0; i < colCount; i++) {
      cols[i] = makeColumn(height);
    }
    return cols;
  }, []);

  const makeColumn = (height) => ({
    // y is in "rows" (multiply by fontSize for px). Start staggered so the
    // first frame already looks alive instead of a flat row marching down.
    y: Math.random() * (height / RAIN.fontSize),
    speed: RAIN.speedMin + Math.random() * (RAIN.speedMax - RAIN.speedMin),
    length: 12 + Math.floor(Math.random() * 26),
    // Per-column glyph buffer so we can flip individual chars in-place.
    glyphs: [],
  });

  const randomGlyph = () =>
    MATRIX_GLYPHS.charAt(Math.floor(Math.random() * MATRIX_GLYPHS.length));

  // Resize / DPR setup.
  const resize = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${RAIN.fontSize}px "Share Tech Mono", "Courier New", ui-monospace, monospace`;
    ctx.textBaseline = 'top';
    stateRef.current = {
      width: w,
      height: h,
      dpr,
      cols: buildColumns(w, h),
    };
  }, [buildColumns]);

  React.useEffect(() => {
    if (!visible) return;
    resize();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [visible, resize]);

  // Animation loop — runs only while visible.
  React.useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const step = () => {
      const st = stateRef.current;
      if (!st) { rafRef.current = requestAnimationFrame(step); return; }
      const { width, height, cols } = st;

      // Trail effect — paint a translucent black rect over the whole canvas
      // each frame, so older glyphs fade gradually instead of being cleared.
      ctx.fillStyle = `rgba(0, 0, 0, ${RAIN.trailFade})`;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        const x = i * RAIN.fontSize;
        const headRow = Math.floor(c.y);

        // Ensure the glyph buffer covers the visible trail.
        // Index 0 is the head; higher indices are further back in the trail.
        for (let k = 0; k < c.length; k++) {
          if (c.glyphs[k] === undefined) c.glyphs[k] = randomGlyph();
          // Occasional flip — but never the head (it always re-randomizes below).
          else if (k > 0 && Math.random() < RAIN.flipChance) c.glyphs[k] = randomGlyph();
        }

        // Head: re-randomize every frame so it shimmers as it falls.
        c.glyphs[0] = randomGlyph();

        // Draw trail back-to-front so the head ends up on top.
        for (let k = c.length - 1; k >= 0; k--) {
          const row = headRow - k;
          if (row < 0) continue;
          const y = row * RAIN.fontSize;
          if (y > height) continue;

          if (k === 0) {
            // Head — bright, sometimes nearly white for that flicker.
            ctx.fillStyle = Math.random() < RAIN.headWhiteChance
              ? '#d6ffe6'
              : '#9bff9b';
            ctx.shadowColor = '#7cff7c';
            ctx.shadowBlur = 8;
          } else {
            // Trail — fade green from bright to dark by trail position.
            const t = k / c.length; // 0 (head-adjacent) → 1 (tail)
            // Bright green ~ #00ff66, fading to ~ #003311 at the tail.
            const g = Math.round(255 * (1 - t * 0.85));
            const r = Math.round(0  + 10 * (1 - t));
            const b = Math.round(60 * (1 - t * 0.9));
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.shadowBlur = 0;
          }
          ctx.fillText(c.glyphs[k], x, y);
        }
        ctx.shadowBlur = 0;

        c.y += c.speed;

        // Reset condition: once the head has passed the bottom, randomly
        // restart from above the top. Random reset (not deterministic) keeps
        // columns out of sync so the screen never "marches" in lockstep.
        const headY = c.y * RAIN.fontSize;
        const tailY = (c.y - c.length) * RAIN.fontSize;
        if (tailY > height && Math.random() < RAIN.resetChanceAtBottom + 0.02) {
          const next = makeColumn(height);
          next.y = (RAIN.resetTopMin + Math.random() * (RAIN.resetTopMax - RAIN.resetTopMin));
          cols[i] = next;
        } else if (headY > height + 100 && Math.random() < RAIN.resetChanceAtBottom) {
          const next = makeColumn(height);
          next.y = (RAIN.resetTopMin + Math.random() * (RAIN.resetTopMax - RAIN.resetTopMin));
          cols[i] = next;
        }
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible]);

  return (
    <div className={`matrix-stage ${visible ? 'on' : 'off'}`} aria-hidden={!visible}>
      <canvas ref={canvasRef} className="matrix-canvas" />
      <div className="matrix-vignette" />
      <div className="matrix-scanlines" />
    </div>
  );
}

window.MatrixRain = MatrixRain;
