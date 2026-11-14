import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Ban, EyeOff, HeartHandshake, Image as ImageIcon, IndianRupee, Link2, ListChecks, MessageSquareText,
  Phone, ScanLine, ShieldAlert, ShieldCheck, Wallet,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useRegistry } from '../state/registry';
import { Button } from '../components/ui';
import { Reveal, RevealGroup, RevealItem, SplitHeading } from '../components/motion';
import StatsCounter from '../components/vengeance/stats-counter';
import { SolarSystem } from '../components/vengeance/solar-system';
import { TypingKeyboard } from '../components/vengeance/typing-keyboard';
import { navigate } from '../state/router';

// three.js scenes: loaded on demand so the first paint stays light.
const WaveGridBackground = lazy(() => import('../components/vengeance/wave-grid-background'));
const ParticleShield = lazy(() => import('../components/vengeance/interactive-particles').then((m) => ({
  default: function ParticleShield(props) {
    const src = useMemo(() => m.makeShieldImage(240), []);
    return <m.InteractiveParticles src={src} {...props} />;
  },
})));

const DEMO_TEXT = 'Your KYC expires today. Update now: sbi-kyc.xyz';

const ORBITS = [
  { id: 'inner', radius: 'var(--radius-inner)', speed: 22, items: [
    { id: 'msg', label: 'Messages', icon: <MessageSquareText size={16} /> },
    { id: 'link', label: 'Links', icon: <Link2 size={16} /> },
  ] },
  { id: 'mid', radius: 'var(--radius-mid)', speed: 34, items: [
    { id: 'phone', label: 'Phone numbers', icon: <Phone size={16} /> },
    { id: 'upi', label: 'UPI IDs', icon: <IndianRupee size={16} /> },
  ] },
  { id: 'outer', radius: 'var(--radius-outer)', speed: 50, items: [
    { id: 'shot', label: 'Screenshots', icon: <ImageIcon size={16} /> },
    { id: 'wallet', label: 'Wallets', icon: <Wallet size={16} /> },
  ] },
];

const STEPS = [
  [ScanLine, 'Check', 'scanner'],
  [HeartHandshake, 'Get help', 'recovery'],
  [ListChecks, 'Track', 'cases'],
];

const PROMISES = [
  [Ban, 'Never asks for your OTP or PIN'],
  [Ban, 'Never charges to “recover” money'],
  [EyeOff, 'Nothing you check is uploaded'],
];

function useWebGL() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      setOk(Boolean(c.getContext('webgl2') || c.getContext('webgl')));
    } catch { setOk(false); }
  }, []);
  return ok;
}

export default function Overview() {
  const reg = useRegistry();
  const reduce = useReducedMotion();
  const webgl = useWebGL();
  const fancy = webgl && !reduce;
  const [typed, setTyped] = useState(Boolean(reduce));

  return (
    <div className="landing">
      {/* Hero */}
      <section className="lx-hero">
        <div className="lx-hero-bg" aria-hidden="true">
          {fancy && <Suspense fallback={null}><WaveGridBackground /></Suspense>}
        </div>
        <RevealGroup className="lx-hero-copy" onMount gap={0.1} delay={0.05}>
          <RevealItem><span className="lx-pill"><ShieldCheck size={14} />Free · Private · On your device</span></RevealItem>
          <SplitHeading lines={['Is it a scam?', { text: 'Check before you pay.', className: 'grad' }]} delay={0.1} />
          <RevealItem className="lx-actions">
            <Button size="lg" icon={ScanLine} onClick={() => navigate('scanner')}>Check now</Button>
            <a className="btn btn-secondary btn-lg" href="#/recovery"><HeartHandshake size={17} />I’ve been scammed</a>
          </RevealItem>
        </RevealGroup>
        <div className="lx-hero-art">
          {fancy
            ? <Suspense fallback={null}><ParticleShield label="Aegis shield" /></Suspense>
            : <ShieldCheck className="lx-hero-static" strokeWidth={1.1} aria-hidden="true" />}
        </div>
      </section>

      {/* Paste → verdict demo */}
      <section className="lx-demo" aria-labelledby="demo-title">
        <Reveal className="lx-head">
          <h2 id="demo-title">Paste it. We check it.</h2>
        </Reveal>
        <div className="lx-demo-grid">
          <Reveal className="lx-demo-kb">
            <p className="sr-only">Example message: {DEMO_TEXT}</p>
            <TypingKeyboard autoTypeText={DEMO_TEXT} onCycle={(s) => setTyped(s === 'typed')} />
          </Reveal>
          <div className="lx-demo-result" aria-live="polite">
            <AnimatePresence mode="wait">
              {typed ? (
                <motion.div key="v" className="lx-verdict" initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
                  <span className="lx-verdict-icon"><ShieldAlert size={22} /></span>
                  <div>
                    <b>Likely a scam</b>
                    <ul>
                      <li>Fake bank link</li>
                      <li>Urgent deadline</li>
                    </ul>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="w" className="lx-waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <ScanLine size={18} /> Checking…
                </motion.div>
              )}
            </AnimatePresence>
            <a className="link-btn" href="#/scanner">Try your own <ArrowRight size={14} /></a>
          </div>
        </div>
      </section>

      {/* Everything it checks */}
      <section className="lx-orbit" aria-labelledby="orbit-title">
        <Reveal className="lx-head">
          <h2 id="orbit-title">One checker for everything.</h2>
        </Reveal>
        <SolarSystem
          center={<ShieldCheck size={30} />}
          orbits={ORBITS}
          isPaused={Boolean(reduce)}
          label="Aegis checks messages, links, phone numbers, UPI IDs, screenshots and wallet addresses."
        />
      </section>

      {/* How it works */}
      <section className="lx-how" aria-labelledby="how-title">
        <Reveal className="lx-head"><h2 id="how-title">Three steps.</h2></Reveal>
        <Reveal className="lx-figure" data-cursor="media">
          <img src="/figures/phone-check.svg" alt="A phone on a desk with a message thread open. A lens checks one suspicious message and the result goes to a blue Aegis shield marked with a check." loading="lazy" width="640" height="400" />
        </Reveal>
        <ol className="lx-steps">
          {STEPS.map(([Icon, title, to], i) => (
            <Reveal as="li" key={title} delay={0.06 * i}>
              <a href={`#/${to}`} className="lx-step">
                <span className="lx-step-n mono">0{i + 1}</span>
                <Icon size={20} />
                <b>{title}</b>
              </a>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Live registry + promise */}
      <section className="lx-bottom">
        <Reveal className="lx-stats">
          <a href="#/registry" className="lx-stat">
            <strong>{reg.meta ? <StatsCounter value={reg.meta.count} duration={1.2} /> : '—'}</strong>
            <span>Community reports</span>
          </a>
          <a href="#/registry" className="lx-stat">
            <strong>{reg.available ? <StatsCounter value={reg.counts.Confirmed} duration={1.2} /> : '—'}</strong>
            <span>Confirmed scams</span>
          </a>
        </Reveal>
        <Reveal as="ul" className="lx-promise" delay={0.06}>
          {PROMISES.map(([Icon, t]) => <li key={t}><Icon size={16} />{t}</li>)}
        </Reveal>
      </section>
    </div>
  );
}
