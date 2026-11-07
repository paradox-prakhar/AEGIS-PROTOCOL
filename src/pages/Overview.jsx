import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, BadgeCheck, Ban, Clock, Database, EyeOff, FileWarning, Gavel, HeartHandshake,
  LifeBuoy, ListChecks, ScanLine, ShieldCheck, ShieldX, Swords,
} from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { useRegistry } from '../state/registry';
import { useWallet } from '../state/wallet';
import { Address, Button, Card, EmptyState, StatusBadge } from '../components/ui';
import { ScanForm } from '../components/ScanForm';
import { Parallax, Reveal, RevealGroup, RevealItem, Scramble, SplitHeading } from '../components/motion';
import StatsCounter from '../components/vengeance/stats-counter';
import { relativeTime } from '../lib/format';
import { navigate } from '../state/router';

// Heavy decorative background (hundreds of DOM tiles): loaded lazily, desktop only.
const PerspectiveGrid = lazy(() => import('../components/vengeance/perspective-grid'));

const LIFECYCLE = [
  ['Detect', 'Screen any destination against the shared registry before you sign.', ScanLine, 'scanner'],
  ['Report', 'Hash your evidence and sign an onchain allegation.', FileWarning, 'report'],
  ['Challenge', 'Anyone can dispute a report with counter-evidence.', Swords, 'review'],
  ['Resolve', 'A trusted reviewer adjudicates after a 2-day window.', Gavel, 'review'],
  ['Recover', 'Assemble an exportable incident package for issuers.', LifeBuoy, 'recovery'],
];

const HOW = [
  ['01', 'Check', 'Paste a message, link, number or wallet. Get a clear Safe, Suspicious or Dangerous answer with reasons.', ScanLine, 'scanner'],
  ['02', 'Act calmly', 'If something went wrong, a step-by-step checklist tells you exactly what to do first.', HeartHandshake, 'recovery'],
  ['03', 'Track & warn others', 'Follow each case to the end and warn the community with a signed onchain report.', ListChecks, 'cases'],
];

const NEVER = [
  [Ban, 'We never ask for your OTP, PIN, password or seed phrase.'],
  [Ban, 'We never charge to “recover” money. Anyone who does is a scammer.'],
  [EyeOff, 'What you check stays on your device. Nothing is uploaded.'],
  [BadgeCheck, 'Every result explains why — no black-box scores.'],
];

function useDesktop() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px) and (hover: hover)');
    const update = () => setOk(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return ok;
}

function Counter({ value, loading }) {
  if (loading) return <span className="skeleton" style={{ width: 48 }} />;
  if (typeof value !== 'number') return '—';
  return <StatsCounter value={value} duration={1.2} />;
}

export default function Overview() {
  const reg = useRegistry();
  const wallet = useWallet();
  const desktop = useDesktop();
  const reduce = useReducedMotion();
  const recent = reg.rows.slice(0, 6);
  const open = reg.counts.Pending + reg.counts.Challenged;
  const loading = reg.loading && !reg.meta;

  return (
    <>
      <section className="hero landing-hero">
        {desktop && !reduce && (
          <Suspense fallback={null}>
            <div className="hero-grid" aria-hidden="true"><PerspectiveGrid gridSize={22} fadeRadius={70} className="hero-grid-inner" /></div>
          </Suspense>
        )}
        <RevealGroup className="hero-copy" onMount gap={0.1} delay={0.1}>
          <RevealItem>
            <span className="hero-tag"><span className={`live-dot ${reg.available ? '' : 'down'}`} />
              <Scramble text={reg.available ? 'REGISTRY LIVE · ARC TESTNET' : reg.loading ? 'CONNECTING · ARC TESTNET' : 'REGISTRY OFFLINE'} onMount />
            </span>
          </RevealItem>
          <SplitHeading lines={['Pause. Check.', { text: 'Stay one step ahead of scams.', className: 'grad' }]} delay={0.15} />
          <RevealItem as="p">Aegis helps you spot scam messages, links, numbers and wallets before you pay — and guides you calmly if something has already gone wrong.</RevealItem>
          <RevealItem className="hero-actions">
            <Button size="lg" icon={ScanLine} onClick={() => navigate('scanner')}>Check something now</Button>
            <a className="btn btn-calm btn-lg" href="#/recovery"><HeartHandshake size={17} />I’ve been scammed</a>
          </RevealItem>
          <RevealItem className="trust-chips">
            <span><EyeOff size={14} />Checks run on your device</span>
            <span><ShieldCheck size={14} />Plain-language reasons</span>
            <span><Database size={14} />Open onchain registry</span>
          </RevealItem>
        </RevealGroup>
        <Parallax className="hero-visual" speed={0.12}>
          <div aria-hidden="true" className="hero-radar">
            <div className="orbit o1" /><div className="orbit o2" /><div className="orbit o3" />
            <div className="sweep" />
            <div className="hero-shield"><ShieldCheck size={64} strokeWidth={1.2} /></div>
            <span className="blip b1" /><span className="blip b2" /><span className="blip b3" />
          </div>
        </Parallax>
      </section>

      <div className="stats">
        {[
          ['Onchain reports', reg.meta?.count, 'Total submitted to the registry', Database],
          ['Open allegations', reg.available ? open : undefined, `${reg.counts.Challenged} challenged`, Clock, open ? 'warning' : undefined],
          ['Confirmed threats', reg.available ? reg.counts.Confirmed : undefined, 'Adjudicated by reviewer', ShieldX, reg.counts.Confirmed ? 'danger' : undefined],
          ['Rejected', reg.available ? reg.counts.Rejected : undefined, 'Allegations dismissed', ShieldCheck],
        ].map(([label, value, hint, Icon, tone], i) => (
          <Reveal key={label} delay={i * 0.06} className={`stat ${tone ? `stat-${tone}` : ''}`}>
            <div className="stat-top"><span>{label}</span><Icon size={16} /></div>
            <strong><Counter value={value} loading={loading} /></strong>
            <p>{hint}</p>
          </Reveal>
        ))}
      </div>

      <section className="how" aria-labelledby="how-title">
        <Reveal className="how-head">
          <div className="eyebrow">How it works</div>
          <h2 id="how-title">Three calm steps, from doubt to done.</h2>
        </Reveal>
        <div className="how-grid">
          <Reveal className="card how-figure" data-cursor="media">
            <img src="/figures/inspection-gate.svg" alt="An inspection gate on a bench: messages ride a conveyor through a scanner arch while a signal tower shows the verdict with green, amber and red lamps." loading="lazy" width="640" height="400" />
            <p className="how-figure-cap"><span className="mono">FIG 1</span> Every message passes the gate; the tower shows the verdict.</p>
          </Reveal>
          <ol className="how-steps">
            {HOW.map(([n, title, text, Icon, to], i) => (
              <Reveal as="li" key={n} delay={0.08 * i}>
                <a className="card how-step" href={`#/${to}`}>
                  <span className="how-n mono">{n}</span>
                  <span className="how-icon"><Icon size={18} /></span>
                  <div><b>{title}</b><p>{text}</p></div>
                  <ArrowUpRight size={16} className="how-arrow" />
                </a>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <div className="grid-2">
        <Reveal>
          <Card title="Quick wallet check" subtitle="Screen a recipient address before your next transfer or approval.">
            <ScanForm compact />
            <a className="link-btn quick-more" href="#/scanner">Check a message, link or number instead <ArrowRight size={14} /></a>
          </Card>
        </Reveal>
        <Reveal delay={0.08}>
          <Card
            title="Recent registry activity"
            subtitle="Latest onchain reports"
            action={<a className="link-btn" href="#/registry">View all <ArrowUpRight size={14} /></a>}
            pad={false}
          >
            {recent.length ? (
              <ul className="activity">
                {recent.map((r) => (
                  <li key={r.id}>
                    <a href={`#/registry?id=${r.id}`}>
                      <span className="activity-id">#{r.id}</span>
                      <div className="activity-main">
                        <Address value={r.address} link={false} />
                        <small className="muted">{relativeTime(r.createdAt)}</small>
                      </div>
                      <StatusBadge status={r.status} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Activity} title={reg.error ? 'Registry unavailable' : 'No reports yet'}
                action={!reg.error && <Button variant="secondary" size="sm" onClick={() => navigate('report')}>Submit the first report</Button>}>
                {reg.error || 'The shared registry is live and waiting for its first signed report.'}
              </EmptyState>
            )}
          </Card>
        </Reveal>
      </div>

      <section className="trust" aria-labelledby="trust-title">
        <Reveal className="card trust-card">
          <div className="trust-copy">
            <div className="eyebrow">Our promise</div>
            <h2 id="trust-title">Built so it can never look like a scam itself.</h2>
            <p className="muted">Consistent branding, no pressure, no hidden steps. If anything claiming to be Aegis breaks these rules, it isn’t us.</p>
          </div>
          <ul className="never-list">
            {NEVER.map(([Icon, t]) => <li key={t}><Icon size={18} /><span>{t}</span></li>)}
          </ul>
        </Reveal>
      </section>

      <Reveal>
        <Card title="The onchain protection lifecycle" subtitle="Every registry step is transparent, wallet-signed, and verifiable on Arc Testnet.">
          <div className="lifecycle">
            {LIFECYCLE.map(([title, text, Icon, to], i) => (
              <a key={title} className="lifecycle-step" href={`#/${to}`}>
                <div className="lifecycle-icon"><Icon size={18} /></div>
                <span className="lifecycle-n">0{i + 1}</span>
                <b>{title}</b>
                <p>{text}</p>
              </a>
            ))}
          </div>
        </Card>
      </Reveal>

      {!wallet.isConnected && (
        <Reveal className="cta-band">
          <div>
            <b>New to Arc Testnet?</b>
            <p className="muted">Connect a MetaMask-compatible wallet and grab free test USDC to pay gas.</p>
          </div>
          <div className="row">
            <a className="btn btn-ghost" href="https://faucet.circle.com/" target="_blank" rel="noreferrer">Circle faucet <ArrowUpRight size={14} /></a>
            <Button onClick={() => wallet.connect().catch(() => {})} loading={wallet.connecting}>Connect wallet</Button>
          </div>
        </Reveal>
      )}
    </>
  );
}
