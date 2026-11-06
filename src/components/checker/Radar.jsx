import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { FlipFadeText } from '../vengeance/flip-fade-text';

/**
 * Radar sweep shown while a check runs (custom — no source ships a radar).
 * Only `transform: rotate` and opacity animate. With reduced motion the sweep
 * is static and the word ticker is replaced by plain text.
 */
export function Radar({ words, tone = 'scanning' }) {
  const reduce = useReducedMotion();
  return (
    <div className={`radar radar-${tone}`} aria-hidden="true">
      <div className="radar-grid" />
      <span className="radar-ring r1" /><span className="radar-ring r2" /><span className="radar-ring r3" />
      {!reduce && tone === 'scanning' && (
        <motion.div className="radar-sweep" animate={{ rotate: 360 }} transition={{ duration: 2.4, ease: 'linear', repeat: Infinity }} />
      )}
      <span className="radar-blip b1" /><span className="radar-blip b2" /><span className="radar-blip b3" />
      <div className="radar-core">
        {reduce || !words?.length
          ? <span className="radar-word">{words?.[0] || 'SCANNING'}</span>
          : <FlipFadeText words={words} interval={900} className="radar-flip" textClassName="radar-word" letterDuration={0.35} staggerDelay={0.03} exitStaggerDelay={0.015} />}
      </div>
    </div>
  );
}
