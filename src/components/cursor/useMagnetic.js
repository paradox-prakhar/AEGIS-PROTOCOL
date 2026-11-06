import { useEffect } from 'react';
import { animate } from 'framer-motion';
import { magnetic, spring } from '../../motion/config';

/**
 * Gently pulls `ref` toward the pointer while it is within `radius` px of the
 * element's edge, then springs back. Writes transform directly (no re-renders).
 * No-op on touch devices and with prefers-reduced-motion.
 */
export function useMagnetic(ref, { radius = magnetic.radius, strength = magnetic.strength, enabled = true } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return undefined;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) return undefined;

    let cur = { x: 0, y: 0 };
    let active = false;
    let controls = [];
    const set = () => { el.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`; };
    const to = (tx, ty) => {
      controls.forEach((c) => c.stop());
      controls = [
        animate(cur.x, tx, { type: 'spring', ...spring.magnetic, onUpdate: (v) => { cur.x = v; set(); } }),
        animate(cur.y, ty, { type: 'spring', ...spring.magnetic, onUpdate: (v) => { cur.y = v; set(); } }),
      ];
    };

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const near = Math.abs(dx) < r.width / 2 + radius && Math.abs(dy) < r.height / 2 + radius;
      if (near && !el.disabled) {
        active = true;
        to(dx * strength, dy * strength);
      } else if (active) {
        active = false;
        to(0, 0);
      }
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      controls.forEach((c) => c.stop());
      el.style.transform = '';
    };
  }, [ref, radius, strength, enabled]);
}
