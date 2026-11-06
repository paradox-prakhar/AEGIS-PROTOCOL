/**
 * Shared motion language. Every animated component imports from here so the
 * product moves with one voice. Values mirror the CSS easing tokens in
 * src/styles/tokens.css.
 *
 * Rule of thumb: animate transform + opacity only.
 */

export const ease = {
  out: [0.22, 1, 0.36, 1],      // default: quick start, soft landing
  inOut: [0.65, 0, 0.35, 1],    // page transitions
  calm: [0.33, 0, 0.2, 1],      // Emergency flow: slow, even, reassuring
};

export const duration = {
  fast: 0.16,
  base: 0.28,
  slow: 0.6,
  calm: 0.9,
};

export const spring = {
  /** Cursor ring trailing the dot. */
  cursor: { stiffness: 380, damping: 32, mass: 0.6 },
  /** Magnetic buttons pulling toward the pointer. */
  magnetic: { stiffness: 220, damping: 18, mass: 0.4 },
  /** General UI (expanding panels, badges). */
  ui: { stiffness: 300, damping: 30 },
  /** Verdict reveal — satisfying but not bouncy/alarming. */
  verdict: { stiffness: 170, damping: 22 },
};

export const stagger = {
  tight: 0.04,
  base: 0.08,
  calm: 0.16,
};

/** Fade + rise used by <Reveal>. */
export const revealVariants = (distance = 18, calm = false) => ({
  hidden: { opacity: 0, y: distance },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: calm ? duration.calm : duration.slow, ease: calm ? ease.calm : ease.out },
  },
});

/** Parent that staggers its <Reveal> children. */
export const staggerContainer = (gap = stagger.base, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

/** Route transition. Calm routes get a slower, translation-free fade. */
export const pageVariants = (calm = false) => ({
  initial: { opacity: 0, y: calm ? 0 : 10 },
  enter: { opacity: 1, y: 0, transition: { duration: calm ? duration.calm : duration.base + 0.1, ease: ease.out } },
  exit: { opacity: 0, transition: { duration: duration.fast, ease: ease.inOut } },
});

/** Routes that must only ever use calm motion. */
export const CALM_ROUTES = new Set(['recovery', 'cases']);

export const magnetic = { radius: 90, strength: 0.28 };
