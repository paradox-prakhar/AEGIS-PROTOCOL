import React from 'react';
import { HeartHandshake } from 'lucide-react';
import { ScamChecker } from '../components/checker/ScamChecker';
import { Reveal, RevealGroup, RevealItem, SplitHeading } from '../components/motion';

const LEGEND = [
  ['safe', 'Looks safe'],
  ['warning', 'Suspicious'],
  ['danger', 'Likely a scam'],
  ['neutral', 'No record'],
];

export default function Scanner({ params }) {
  return (
    <div className="narrow-page">
      <RevealGroup className="page-header center-header" onMount>
        <div>
          <SplitHeading lines={['Check it', { text: 'before you act.', className: 'grad' }]} />
          <RevealItem as="p">Message, link, number, UPI, wallet or screenshot.</RevealItem>
        </div>
      </RevealGroup>

      <Reveal className="card checker-card">
        <ScamChecker
          initialMode={params.address ? 'wallet' : params.mode || 'message'}
          initialValue={params.address || ''}
        />
      </Reveal>

      <Reveal delay={0.1} as="ul" className="legend-row" aria-label="What results mean">
        {LEGEND.map(([tone, title]) => <li key={tone}><span className={`legend-dot dot-${tone}`} />{title}</li>)}
      </Reveal>

      <Reveal delay={0.16}>
        <a className="help-band" href="#/recovery">
          <HeartHandshake size={20} />
          <span><b>Already lost money?</b><small>Get step-by-step help</small></span>
        </a>
      </Reveal>
    </div>
  );
}
