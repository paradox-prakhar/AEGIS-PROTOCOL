/* Vengeance UI — expandable-bento-grid (MIT, © Ashutoshx7). Installed via shadcn CLI.
   Aegis adaptations: cards are real <button>s (keyboard + screen readers), the
   expanded card is a labelled modal dialog with a visible close button and focus
   return, the placeholder "Visit" link (href="#") is removed, body scroll is
   restored correctly, and colours/classes use Aegis tokens. The original shared-
   layout (layoutId) morph froze at its first frame under Vite + framer-motion 14,
   so the dialog uses a calm scale/fade instead. */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useOutsideClick } from '@/hooks/use-outside-click';
import { cn } from '@/lib/utils';

export default function ExpandableBentoGrid({ items, className }) {
  const [active, setActive] = useState(null);
  const ref = useRef(null);
  const closeRef = useRef(null);
  const lastTrigger = useRef(null);
  const id = useId().replace(/:/g, '');

  const close = useCallback(() => {
    setActive(null);
    requestAnimationFrame(() => lastTrigger.current?.focus());
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKeyDown); };
  }, [active, close]);

  useOutsideClick(ref, () => { if (active) close(); });

  return (
    <>
      <AnimatePresence>
        {active && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bento-scrim" />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {active ? (
          <div className="bento-modal-wrap">
            <motion.div
              ref={ref}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`title-${active.id}-${id}`}
              className="bento-modal"
            >
              <motion.div className="bento-modal-art">
                <div className="bento-modal-icon">{active.icon}</div>
              </motion.div>
              <div className="bento-modal-head">
                <div>
                  <motion.h3 id={`title-${active.id}-${id}`}>{active.title}</motion.h3>
                  <motion.p>{active.description}</motion.p>
                </div>
                <button ref={closeRef} type="button" className="icon-btn bento-close" aria-label="Close" onClick={close}><X size={18} /></button>
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.08 } }} exit={{ opacity: 0 }} className="bento-modal-body">
                {active.content}
              </motion.div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
      <ul className={cn('bento', className)}>
        {items.map((item) => (
          <li key={item.id} className={cn('bento-cell', item.className)}>
            <motion.button
              type="button"
              onClick={(e) => { lastTrigger.current = e.currentTarget; setActive(item); }}
              className="bento-card"
              data-spotlight
              aria-haspopup="dialog"
            >
              <motion.div className="bento-icon">{item.icon}</motion.div>
              <div className="bento-text">
                <motion.h3>{item.title}</motion.h3>
                <motion.p>{item.subtitle}</motion.p>
              </div>
              {item.tag && <span className="bento-tag">{item.tag}</span>}
            </motion.button>
          </li>
        ))}
      </ul>
    </>
  );
}
