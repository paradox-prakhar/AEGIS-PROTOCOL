import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { spring } from '../../motion/config';

/**
 * Cursor system (custom, built on framer-motion — none of the four sources ships
 * a dot + ring cursor).
 *
 * - Dot follows the pointer 1:1, ring trails it on a spring.
 * - States: default · link (ring grows) · text (ring → vertical bar) ·
 *   media ("View") · drag · scanning (set by the Scam Checker) · click pulse.
 * - Spotlight: writes --mx/--my on the hovered `.card`/`[data-spotlight]` and
 *   --cx/--cy on <html> for the background glow. CSS does the painting.
 * - Disabled on touch/coarse pointers and with prefers-reduced-motion; the
 *   native cursor is always kept on inputs, textareas, selects and editables.
 *
 * Elements can force a state with `data-cursor="link|text|media|drag|native"`.
 */

const CursorContext = createContext({ setMode: () => {}, enabled: false });
export const useCursor = () => useContext(CursorContext);

const NATIVE = 'input, textarea, select, [contenteditable="true"], [data-cursor="native"]';
const LINK = 'a, button, [role="button"], [role="tab"], label[for], summary, [data-cursor="link"]';
const TEXT = 'p, h1, h2, h3, h4, li, dd, blockquote, [data-cursor="text"]';
const MEDIA = 'img, video, svg[data-media], [data-cursor="media"]';
const DRAG = '[draggable="true"], [data-cursor="drag"]';

function stateFor(el) {
  if (!(el instanceof Element)) return 'default';
  const forced = el.closest('[data-cursor]')?.getAttribute('data-cursor');
  if (forced) return forced;
  if (el.closest(NATIVE)) return 'native';
  if (el.closest(DRAG)) return 'drag';
  if (el.closest(LINK)) return 'link';
  if (el.closest(MEDIA)) return 'media';
  if (el.closest(TEXT)) return 'text';
  return 'default';
}

function useCursorEnabled() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setEnabled(fine.matches && !reduce.matches);
    update();
    fine.addEventListener('change', update);
    reduce.addEventListener('change', update);
    return () => { fine.removeEventListener('change', update); reduce.removeEventListener('change', update); };
  }, []);
  return enabled;
}

const RING = {
  default: { width: 34, height: 34, borderRadius: 999, opacity: 0.55 },
  link: { width: 58, height: 58, borderRadius: 999, opacity: 0.9 },
  text: { width: 3, height: 26, borderRadius: 2, opacity: 0.9 },
  media: { width: 76, height: 76, borderRadius: 999, opacity: 1 },
  drag: { width: 50, height: 50, borderRadius: 14, opacity: 0.9 },
  scanning: { width: 64, height: 64, borderRadius: 999, opacity: 1 },
  native: { width: 0, height: 0, borderRadius: 999, opacity: 0 },
};

function Cursor({ mode }) {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const rx = useSpring(x, spring.cursor);
  const ry = useSpring(y, spring.cursor);
  const [state, setState] = useState('default');
  const [visible, setVisible] = useState(false);
  const [pulse, setPulse] = useState(0);
  const frame = useRef(0);
  const last = useRef({ x: 0, y: 0, target: null });
  const spotEl = useRef(null);

  useEffect(() => {
    const root = document.documentElement;
    const paint = () => {
      frame.current = 0;
      const { x: px, y: py, target } = last.current;
      root.style.setProperty('--cx', `${px}px`);
      root.style.setProperty('--cy', `${py}px`);
      const card = target instanceof Element ? target.closest('.card, [data-spotlight]') : null;
      if (spotEl.current && spotEl.current !== card) spotEl.current.removeAttribute('data-lit');
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${px - r.left}px`);
        card.style.setProperty('--my', `${py - r.top}px`);
        card.setAttribute('data-lit', '');
      }
      spotEl.current = card;
    };
    const onMove = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      x.set(e.clientX);
      y.set(e.clientY);
      last.current = { x: e.clientX, y: e.clientY, target: e.target };
      setVisible(true);
      setState(stateFor(e.target));
      if (!frame.current) frame.current = requestAnimationFrame(paint);
    };
    const onDown = () => setPulse((n) => n + 1);
    const onLeave = () => setVisible(false);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    root.classList.add('has-custom-cursor');
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerleave', onLeave);
      root.classList.remove('has-custom-cursor');
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [x, y]);

  // The Scam Checker's "scanning" state wins over hover states, except over
  // native-cursor elements (the user may still be typing).
  const shown = mode && state !== 'native' ? mode : state;
  const ring = RING[shown] || RING.default;

  return (
    <div className="cursor-layer" aria-hidden="true" data-state={shown} style={{ opacity: visible ? 1 : 0 }}>
      <motion.div className="cursor-ring" style={{ x: rx, y: ry }} animate={ring} transition={{ type: 'spring', ...spring.ui }}>
        <AnimatePresence>
          {shown === 'media' && (
            <motion.span className="cursor-label" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
              View
            </motion.span>
          )}
          {shown === 'drag' && (
            <motion.span className="cursor-label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Drag</motion.span>
          )}
        </AnimatePresence>
        {shown === 'scanning' && <span className="cursor-sweep" />}
      </motion.div>
      <motion.div className="cursor-dot" style={{ x, y }} animate={{ opacity: shown === 'native' || shown === 'text' ? 0 : 1 }} />
      <AnimatePresence>
        {pulse > 0 && (
          <motion.div
            key={pulse}
            className="cursor-pulse"
            style={{ x: last.current.x, y: last.current.y }}
            initial={{ scale: 0.4, opacity: 0.6 }}
            animate={{ scale: 2.2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export function CursorProvider({ children }) {
  const enabled = useCursorEnabled();
  const [mode, setMode] = useState(null);
  const value = useMemo(() => ({ setMode, enabled }), [enabled]);
  return (
    <CursorContext.Provider value={value}>
      {children}
      {enabled && <Cursor mode={mode} />}
    </CursorContext.Provider>
  );
}
