import React from 'react';
import { BadgeCheck, ExternalLink, Info, Phone, ShieldCheck } from 'lucide-react';
import { HELPLINES } from '../data/resources';
import { Reveal, RevealGroup, RevealItem, SplitHeading } from '../components/motion';
import { FaqAccordion } from '../components/vengeance/faq-accordion';

/**
 * Helplines & resources. Contact details come ONLY from src/data/resources.js,
 * which holds verified entries. This page never invents or hard-codes numbers.
 */

const SPOT_FAKE = [
  { question: 'How do I find my bank’s real number?', answer: 'Use the number printed on the back of your card, inside your bank’s official app, or on its official website typed in yourself. Never use a number from a search ad, a comment or a message.' },
  { question: 'A “helpline” asked me to install an app. Is that normal?', answer: 'No. Real helplines do not need remote access to your phone. Apps like AnyDesk or TeamViewer let a scammer control your device. Hang up and uninstall the app.' },
  { question: 'Someone called me back after I posted a complaint online.', answer: 'Be careful. Scammers watch public complaints and call pretending to be support. Contact the company yourself through its official app or website.' },
  { question: 'Will reporting cost me anything?', answer: 'No. Official reporting channels are free. Anyone asking for a fee to file or speed up a complaint is not genuine.' },
];

function HelplineCard({ h }) {
  return (
    <article className="card helpline" data-spotlight>
      <header>
        <h3>{h.name}</h3>
        {h.hours && <span className="tag">{h.hours}</span>}
      </header>
      <p className="muted">{h.use}</p>
      <div className="helpline-actions">
        {h.phone && <a className="btn btn-calm btn-lg helpline-call" href={`tel:${h.phone}`}><Phone size={18} /><span className="mono">{h.phone}</span></a>}
        {h.url && <a className="btn btn-secondary" href={h.url} target="_blank" rel="noreferrer noopener"><ExternalLink size={16} />Open official site</a>}
      </div>
      <p className="helpline-verified"><BadgeCheck size={14} />Verified {h.verifiedOn}{h.source && <> · <a href={h.source} target="_blank" rel="noreferrer noopener">source</a></>}</p>
    </article>
  );
}

export default function Help() {
  return (
    <div className="calm">
      <RevealGroup className="page-header" onMount>
        <div>
          <RevealItem calm className="eyebrow calm-eyebrow"><ShieldCheck size={14} /> Helplines & resources</RevealItem>
          <SplitHeading lines={['Official help,', { text: 'without the guesswork.', className: 'grad' }]} />
          <RevealItem calm as="p">Only verified, official contacts are listed here. If a number isn’t on this page or in your bank’s own app, treat it with caution.</RevealItem>
        </div>
      </RevealGroup>

      {HELPLINES.length ? (
        <div className="helpline-grid">
          {HELPLINES.map((h, i) => <Reveal calm key={h.name} delay={i * 0.06}><HelplineCard h={h} /></Reveal>)}
        </div>
      ) : (
        <Reveal calm className="card helpline-empty" role="note">
          <Info size={22} />
          <div>
            <h3>Verified contacts are being added</h3>
            <p>We only publish helplines after checking them on official government or company sources, so this list is empty for now.</p>
            <p>Until then: <b>call your bank using the number on your card or in its official app</b>, and use your government’s official cybercrime reporting channels — find them by typing the official .gov address yourself, not through ads or messages.</p>
          </div>
        </Reveal>
      )}

      <Reveal calm as="section" className="card calm-faq">
        <FaqAccordion title="Spotting a fake helpline" items={SPOT_FAKE} className="calm-accordion" />
      </Reveal>

      <Reveal calm className="help-links">
        <a className="help-band" href="#/recovery"><Phone size={20} /><span><b>Need to act now?</b><small>Follow the emergency checklist</small></span></a>
        <a className="help-band help-band-accent" href="#/scanner"><ShieldCheck size={20} /><span><b>Got a suspicious number?</b><small>Check it in the Scam checker</small></span></a>
      </Reveal>
    </div>
  );
}
