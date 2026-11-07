import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import TextAnimation from '../vengeance/staggerText';
import { CALM_ROUTES, pageVariants, revealVariants, staggerContainer, stagger } from '../../motion/config';

/**
 * Shared animation building blocks. All of them respect prefers-reduced-motion
 * (globally via <MotionConfig reducedMotion="user"> plus explicit fallbacks
 * where an effect isn't a plain transform).
 */

/** Fade + rise when scrolled into view. `calm` = slower, for the Emergency flow. */
export function Reveal({ as = 'div', children, delay = 0, distance, calm, className, ...rest }) {
  const Tag = motion[as] || motion.div;
  const v = revealVariants(distance, calm);
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      variants={{ ...v, show: { ...v.show, transition: { ...v.show.transition, delay } } }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Staggers direct <RevealItem> children — used for page-load intro sequences. */
export function RevealGroup({ as = 'div', children, gap = stagger.base, delay = 0, className, onMount, ...rest }) {
  const Tag = motion[as] || motion.div;
  return (
    <Tag className={className} initial="hidden" animate={onMount ? 'show' : undefined} whileInView={onMount ? undefined : 'show'}
      viewport={{ once: true }} variants={staggerContainer(gap, delay)} {...rest}>
      {children}
    </Tag>
  );
}

export function RevealItem({ as = 'div', children, calm, className, ...rest }) {
  const Tag = motion[as] || motion.div;
  return <Tag className={className} variants={revealVariants(16, calm)} {...rest}>{children}</Tag>;
}

/**
 * Split-text heading. Each line is passed as a string; words rise in using
 * Vengeance UI's stagger-text. Screen readers get the plain sentence once.
 */
export function SplitHeading({ as: Tag = 'h1', lines, delay = 0, className }) {
  const reduce = useReducedMotion();
  const text = lines.map((l) => (typeof l === 'string' ? l : l.text)).join(' ');
  return (
    <Tag className={className}>
      <span className="sr-only">{text}</span>
      {lines.map((line, i) => {
        const t = typeof line === 'string' ? line : line.text;
        const cls = typeof line === 'string' ? '' : line.className || '';
        return (
          <span key={t} className={`split-line ${cls}`} aria-hidden="true">
            {reduce ? t : <TextAnimation delay={delay + i * 0.12}>{t}</TextAnimation>}
          </span>
        );
      })}
    </Tag>
  );
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/';

/**
 * Scramble/decode text on hover or focus (and once on mount if `onMount`).
 * Width is locked with a hidden copy so layout never shifts.
 */
export function Scramble({ text, as: Tag = 'span', onMount = false, className, duration = 600 }) {
  const reduce = useReducedMotion();
  const [out, setOut] = useState(text);
  const raf = useRef(0);

  const run = () => {
    if (reduce) return;
    cancelAnimationFrame(raf.current);
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const settled = Math.floor(p * text.length);
      setOut(text.split('').map((c, i) => (c === ' ' || i < settled ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join(''));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => { setOut(text); if (onMount) run(); return () => cancelAnimationFrame(raf.current); }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Tag className={`scramble ${className || ''}`} onMouseEnter={run} onFocus={run}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="scramble-ghost">{text}</span>
      <span aria-hidden="true" className="scramble-live">{out}</span>
    </Tag>
  );
}

/** Route transition wrapper. Calm routes (Emergency, Cases) fade only. */
export function PageTransition({ routeKey, children }) {
  const v = pageVariants(CALM_ROUTES.has(routeKey));
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={routeKey} className="page" variants={v} initial="initial" animate="enter" exit="exit">
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Thin top bar showing document scroll progress. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 40, restDelta: 0.001 });
  return <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden="true" />;
}

/** Parallax layer: moves `speed` × scroll distance while its section is on screen. */
export function Parallax({ children, speed = 0.15, className }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [`${speed * 100}px`, `${-speed * 100}px`]);
  return <motion.div ref={ref} className={className} style={{ y }}>{children}</motion.div>;
}
