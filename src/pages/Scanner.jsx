import React from 'react';
import { EyeOff, HeartHandshake, ShieldCheck, Smartphone } from 'lucide-react';
import { ScamChecker } from '../components/checker/ScamChecker';
import { Reveal, RevealGroup, RevealItem, SplitHeading } from '../components/motion';

const LEGEND = [
  ['safe', 'Looks safe', 'No common warning signs found. Still check it was expected.'],
  ['warning', 'Suspicious', 'Some warning signs. Slow down and verify through an official channel.'],
  ['danger', 'Likely a scam', 'Matches known scam patterns or a confirmed registry report. Don’t respond or pay.'],
  ['neutral', 'No record', 'For wallet addresses: nothing on record. Never treat this as safe.'],
];

const PROMISES = [
  [EyeOff, 'Private by design', 'Text, links and screenshots are checked in your browser. Nothing is uploaded or stored.'],
  [ShieldCheck, 'Transparent rules', 'Every result lists the exact warning signs found, in plain language.'],
  [Smartphone, 'Works on any phone', 'Large buttons, readable text, no app to install.'],
];

export default function Scanner({ params }) {
  return (
    <>
      <RevealGroup className="page-header checker-header" onMount>
        <div>
          <RevealItem className="eyebrow">Scam checker</RevealItem>
          <SplitHeading lines={['Not sure about a message?', { text: 'Check it before you act.', className: 'grad' }]} />
          <RevealItem as="p">Paste a message, link, phone number, UPI ID or wallet address — or upload a screenshot. You’ll get a clear answer and what to do next.</RevealItem>
        </div>
      </RevealGroup>

      <div className="grid-main checker-grid">
        <Reveal className="card checker-card">
          <ScamChecker
            initialMode={params.address ? 'wallet' : params.mode || 'message'}
            initialValue={params.address || ''}
          />
        </Reveal>
        <div className="stack">
          <Reveal delay={0.1} className="card">
            <h3 className="side-title">How to read results</h3>
            <ul className="legend">
              {LEGEND.map(([tone, title, text]) => (
                <li key={tone}><span className={`legend-dot dot-${tone}`} /><div><b>{title}</b><p className="muted">{text}</p></div></li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.18} className="card promise-card">
            <ul className="promise-list">
              {PROMISES.map(([Icon, t, d]) => (
                <li key={t}><span className="feature-icon"><Icon size={17} /></span><div><b>{t}</b><p className="muted">{d}</p></div></li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.24}>
            <a className="help-band" href="#/recovery">
              <HeartHandshake size={20} />
              <span><b>Already lost money?</b><small>Get calm, step-by-step help now</small></span>
            </a>
          </Reveal>
        </div>
      </div>
    </>
  );
}
