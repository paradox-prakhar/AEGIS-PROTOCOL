import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, FileWarning, HeartHandshake, Info, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { GlowBorderCard } from '../vengeance/glow-border-card';
import { Address, StatusBadge } from '../ui';
import { stagger } from '../../motion/config';

const META = {
  safe: {
    label: 'Looks safe', icon: ShieldCheck, colors: ['#34d399', '#2de2e6', '#34d399'],
    summary: 'No reports or links to reported wallets were found.',
    next: ['Still verify the address through another channel before sending funds.', 'Send a small test amount first.'],
  },
  suspicious: {
    label: 'Suspicious', icon: AlertTriangle, colors: ['#fbbf24', '#f59e0b', '#fbbf24'],
    summary: 'This wallet has open reports, or has transacted with a reported wallet. Slow down.',
    next: ['Don’t send funds or approve tokens for this address yet.', 'Confirm the address with the recipient through another channel.', 'Watch the registry: the report may be confirmed or rejected soon.'],
  },
  dangerous: {
    label: 'Spam wallet', icon: ShieldAlert, colors: ['#f87171', '#fb7185', '#f87171'],
    summary: 'This wallet is a confirmed spam wallet or is linked to one. Do not send funds.',
    next: ['Do not send funds, sign messages or approve tokens for this address.', 'Revoke any token approvals you gave it.', 'Already sent funds? Get step-by-step help now — acting quickly helps.'],
  },
  unknown: {
    label: 'No record found', icon: ShieldQuestion, colors: ['#8592a4', '#2de2e6', '#8592a4'],
    summary: 'We found nothing on record. That is not the same as safe.',
    next: ['Only send money to addresses you have verified through another channel.', 'Send a small test amount first if you must proceed.'],
  },
};

const TONE_ICON = { danger: ShieldAlert, warning: AlertTriangle, info: Info };

export function Verdict({ result }) {
  const m = META[result.verdict] || META.unknown;
  const Icon = m.icon;
  const colors = Array.from({ length: 10 }, (_, i) => m.colors[i % m.colors.length]);
  return (
    <GlowBorderCard width="100%" height="auto" borderRadius="var(--radius-lg)" animationDuration={10} gradientColors={colors}
      borderWidth="2px" blurAmount="10px" inset="-2px" className={`verdict verdict-${result.verdict}`}>
      <div className="verdict-body">
        <header className="verdict-head">
          <motion.span className="verdict-icon" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 170, damping: 16, delay: 0.1 }}>
            <Icon size={28} />
          </motion.span>
          <div>
            <p className="verdict-kicker">Result{result.demo && <span className="tag">DEMO FIXTURE</span>}</p>
            <h2 className="verdict-label">{result.label || m.label}</h2>
            <p className="verdict-summary">{m.summary}</p>
          </div>
        </header>

        {result.input && result.mode !== 'message' && <p className="verdict-input mono">{result.input}</p>}

        {result.findings?.length > 0 && (
          <motion.ul className="verdict-findings" initial="hidden" animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: stagger.base, delayChildren: 0.2 } } }}>
            {result.findings.map((f) => {
              const FI = TONE_ICON[f.tone] || Info;
              return (
                <motion.li key={f.text} className={`finding finding-${f.tone}`}
                  variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}>
                  <FI size={16} aria-hidden="true" /><span>{f.text}</span>
                </motion.li>
              );
            })}
          </motion.ul>
        )}

        {result.matches?.length > 0 && (
          <div className="verdict-matches">
            <p className="muted small">Matching registry records</p>
            {result.matches.map((r) => (
              <a key={r.id} className="match" href={`#/registry?id=${r.id}`}>
                <span>Report #{r.id}</span><StatusBadge status={r.status} /><span className="muted">by</span><Address value={r.reporter} link={false} />
              </a>
            ))}
          </div>
        )}

        {result.links?.length > 0 && (
          <div className="verdict-matches">
            <p className="muted small">Linked reported wallets — this address transacted with them</p>
            {result.links.map((l) => (
              <a key={l.address} className="match" href={`#/scanner?address=${l.address}`}>
                <Address value={l.address} link={false} />
                <StatusBadge status={l.status === 'Confirmed' ? 'Confirmed' : 'Pending'} />
                <span className="muted">{l.txs.length} tx</span>
              </a>
            ))}
          </div>
        )}

        {result.connected?.length > 0 && (
          <div className="verdict-matches">
            <p className="muted small">Connected wallets flagged as spam by association ({result.connected.length})</p>
            {result.connected.slice(0, 20).map((c) => (
              <a key={c.address} className="match" href={`#/scanner?address=${c.address}`}>
                <Address value={c.address} link={false} />
                <span className="muted">{c.txs.length} tx with this wallet</span>
              </a>
            ))}
            {result.connected.length > 20 && <p className="muted small">…and {result.connected.length - 20} more.</p>}
          </div>
        )}

        <div className="verdict-next">
          <h3>What to do next</h3>
          <ol>{m.next.map((t) => <li key={t}>{t}</li>)}</ol>
        </div>

        <div className="verdict-actions">
          {result.verdict === 'dangerous' && (
            <a className="btn btn-calm" href="#/recovery"><HeartHandshake size={16} />I already sent funds</a>
          )}
          {result.mode === 'wallet' && (
            <a className="btn btn-secondary" href={`#/report?address=${result.input}`}><FileWarning size={16} />Report this address</a>
          )}
          <a className="link-btn" href="#/registry">View the registry <ArrowRight size={14} /></a>
        </div>
        <p className="verdict-disclaimer">
          Registry results are community allegations reviewed onchain, and link flags come from the wallet’s recent transactions — a strong signal, not a guarantee.
        </p>
      </div>
    </GlowBorderCard>
  );
}
