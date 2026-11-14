import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Download, HeartHandshake, ListChecks, Phone, Plus } from 'lucide-react';
import { useLocalList } from '../state/useLocalList';
import { useToast } from '../state/toast';
import { Button, Callout, Card, Field } from '../components/ui';
import { Reveal, RevealGroup, RevealItem } from '../components/motion';
import { FaqAccordion } from '../components/vengeance/faq-accordion';
import { downloadJson, isEvmAddress, isTxHash } from '../lib/format';
import { duration, ease } from '../motion/config';

const CATEGORIES = ['Approval phishing', 'Address poisoning', 'Rug pull', 'Impersonation', 'Drainer contract', 'Other suspicious activity'];

/**
 * Emergency checklist. Copy is calm and non-blaming; contact details live only
 * on the Helplines & resources page (#/help) so they are maintained in one place.
 */
const STEPS = [
  {
    id: 'stop', title: 'Stop all contact and payments',
    lead: 'Scammers often push for “one last payment”.',
    items: ['Send no more money.', 'Share no OTP, PIN, password or seed phrase.', 'Uninstall screen-sharing apps (AnyDesk, TeamViewer).'],
  },
  {
    id: 'secure', title: 'Secure your money',
    lead: 'The sooner your bank knows, the better.',
    items: ['Call your bank (number on your card or official app). Block cards, UPI and net banking.', 'Crypto: revoke approvals and move safe funds to a new wallet.'],
  },
  {
    id: 'report', title: 'Report it officially',
    lead: 'Report fast — payments can sometimes be held.',
    items: ['Use the official cybercrime channels on our Helplines page.', 'Keep your complaint number.'],
    link: ['#/help', 'Open helplines'],
  },
  {
    id: 'evidence', title: 'Save your evidence',
    lead: 'A clear record helps your bank and the police.',
    items: ['Screenshot chats, numbers and websites.', 'Note transaction IDs / UTR numbers and times.', 'Save it as an incident below.'],
    link: ['#incident', 'Open an incident'],
  },
  {
    id: 'protect', title: 'Protect your accounts',
    lead: 'Scammers sometimes come back.',
    items: ['Change passwords and turn on two-step verification.', 'Warn family and friends.'],
  },
  {
    id: 'care', title: 'Look after yourself',
    lead: 'It happens to careful people too.',
    items: ['Talk to someone you trust.', 'Paid “recovery agents” are a second scam.'],
  },
];

const FAQ = [
  { question: 'Will I get my money back?', answer: 'It depends on how you paid and how quickly it was reported. Bank and UPI payments reported quickly can sometimes be held. Aegis cannot freeze funds or guarantee recovery.' },
  { question: 'Someone says they can recover my money for a fee. Should I pay?', answer: 'No. “Recovery agents” who ask for fees, remote access or your seed phrase are running another scam.' },
  { question: 'Is my information sent anywhere from this page?', answer: 'No. Your checklist progress and incidents are saved only in this browser. Nothing is sent unless you export a file and share it yourself.' },
  { question: 'I feel embarrassed. Should I still report?', answer: 'Yes. Scams are designed by professionals to fool anyone. Reporting protects you and helps stop the same people from targeting others.' },
];

const EMPTY = { address: '', category: CATEGORIES[0], tx: '', amount: '', evidence: '' };

function ProgressRing({ done, total }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  return (
    <div className="calm-ring" role="img" aria-label={`${done} of ${total} steps done`}>
      <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r={r} className="calm-ring-track" />
        <motion.circle cx="36" cy="36" r={r} className="calm-ring-fill" strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - done / total) }} transition={{ duration: duration.calm, ease: ease.calm }} />
      </svg>
      <span><b>{done}</b>/{total}</span>
    </div>
  );
}

export default function Recovery() {
  const toast = useToast();
  const [cases, setCases] = useLocalList('aegis-cases');
  const [doneIds, setDoneIds] = useLocalList('aegis-emergency-steps');
  const [openId, setOpenId] = useState(() => STEPS.find((s) => !doneIds.includes(s.id))?.id || STEPS[0].id);
  const [touched, setTouched] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const errors = {
    address: !isEvmAddress(form.address) && 'Enter a valid 0x… address.',
    tx: !isTxHash(form.tx) && 'Enter a valid 66-character transaction hash.',
    amount: !(Number(form.amount) >= 0 && form.amount !== '') && 'Enter the reported loss.',
    evidence: form.evidence.trim().length < 20 && 'At least 20 characters.',
  };
  const done = STEPS.filter((s) => doneIds.includes(s.id)).length;

  function toggle(id) {
    const next = doneIds.includes(id) ? doneIds.filter((x) => x !== id) : [...doneIds, id];
    setDoneIds(next);
    if (!doneIds.includes(id)) {
      const nextOpen = STEPS.find((s) => !next.includes(s.id));
      if (nextOpen) setOpenId(nextOpen.id);
    }
  }

  function submit(e) {
    e.preventDefault();
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    const item = { id: crypto.randomUUID(), ...form, created: new Date().toISOString(), status: 'Evidence collected' };
    if (setCases([item, ...cases])) {
      toast('Incident saved in this browser. You can follow it under My cases.', 'success');
      setForm(EMPTY);
      setTouched(false);
    } else toast('Browser storage is unavailable. Export your evidence manually.', 'error');
  }

  const latest = cases[0];
  const exportCase = (item) => downloadJson(`aegis-incident-${item.id}.json`, {
    protocol: 'AEGIS', network: 'Arc Testnet',
    disclaimer: 'User-submitted allegations; not verified. No issuer request has been sent.', ...item,
  });

  return (
    <div className="calm">
      <RevealGroup className="calm-hero" onMount gap={0.16}>
        <RevealItem calm className="eyebrow calm-eyebrow"><HeartHandshake size={14} /> Emergency help</RevealItem>
        <RevealItem calm as="h1">You’re not alone.</RevealItem>
        <RevealItem calm as="p">One step at a time. Tick each one when done.</RevealItem>
        <RevealItem calm className="calm-hero-actions">
          <a className="btn btn-calm btn-lg" href="#/help"><Phone size={17} />Helplines</a>
          <a className="btn btn-ghost btn-lg" href="#/cases"><ListChecks size={17} />My cases</a>
        </RevealItem>
      </RevealGroup>

      <div className="grid-main calm-grid">
        <Reveal calm as="section" className="card calm-card" aria-labelledby="steps-title">
          <header className="calm-progress">
            <ProgressRing done={done} total={STEPS.length} />
            <div>
              <h2 id="steps-title">Your checklist</h2>
              <p className="muted">{done === STEPS.length ? 'All done.' : `${STEPS.length - done} left — no rush.`}</p>
            </div>
          </header>
          <ol className="calm-steps">
            {STEPS.map((s, i) => {
              const isDone = doneIds.includes(s.id);
              const open = openId === s.id;
              return (
                <li key={s.id} className={`calm-step ${isDone ? 'done' : ''} ${open ? 'open' : ''}`}>
                  <div className="calm-step-head">
                    <button type="button" className="calm-check" role="checkbox" aria-checked={isDone} onClick={() => toggle(s.id)}
                      aria-label={`Mark “${s.title}” as ${isDone ? 'not done' : 'done'}`}>
                      {isDone ? <Check size={16} /> : <span>{i + 1}</span>}
                    </button>
                    <button type="button" className="calm-step-title" aria-expanded={open} aria-controls={`step-${s.id}`} onClick={() => setOpenId(open ? null : s.id)}>
                      <span>{s.title}</span><ChevronDown size={18} className="calm-chevron" />
                    </button>
                  </div>
                  <motion.div id={`step-${s.id}`} className="calm-step-body" initial={false}
                    animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} transition={{ duration: duration.slow, ease: ease.calm }}>
                    <div>
                      <p className="calm-lead">{s.lead}</p>
                      <ul>{s.items.map((t) => <li key={t}>{t}</li>)}</ul>
                      <div className="row">
                        {s.link && <a className="link-btn" href={s.link[0]}>{s.link[1]} <ArrowRight size={14} /></a>}
                        {!isDone && <Button variant="secondary" size="sm" icon={Check} onClick={() => toggle(s.id)}>I’ve done this</Button>}
                      </div>
                    </div>
                  </motion.div>
                </li>
              );
            })}
          </ol>
        </Reveal>

        <div className="stack">
          <Reveal calm delay={0.15}>
            <Card title="Open an incident" subtitle="Stays in this browser. Nothing is uploaded." className="calm-card" >
              <form onSubmit={submit} noValidate id="incident">
                <Field label="Scammer’s wallet address" error={touched && errors.address}><input value={form.address} onChange={set('address')} placeholder="0x…" spellCheck={false} className="mono" /></Field>
                <Field label="What kind of scam?"><select value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
                <Field label="Transaction hash" error={touched && errors.tx}><input value={form.tx} onChange={set('tx')} placeholder="0x…" spellCheck={false} className="mono" /></Field>
                <Field label="Amount lost (USDC)" error={touched && errors.amount}><input type="number" inputMode="decimal" min="0" step="0.000001" value={form.amount} onChange={set('amount')} placeholder="0.00" /></Field>
                <Field label="What happened?" hint="Timeline, links and contacts used. Don’t include passwords, OTPs or card numbers." error={touched && errors.evidence}>
                  <textarea rows={5} maxLength={5000} value={form.evidence} onChange={set('evidence')} placeholder="In your own words…" />
                </Field>
                <div className="form-actions"><Button type="submit" icon={Plus}>Save incident</Button></div>
              </form>
              {latest && (
                <div className="calm-latest">
                  <span className="muted small">Latest: {latest.category} · {new Date(latest.created).toLocaleDateString()}</span>
                  <div className="row">
                    <Button variant="ghost" size="sm" icon={Download} onClick={() => exportCase(latest)}>Export</Button>
                    <a className="link-btn" href="#/cases">All cases ({cases.length}) <ArrowRight size={14} /></a>
                  </div>
                </div>
              )}
            </Card>
          </Reveal>
          <Reveal calm delay={0.25}>
            <Callout tone="warning" title="Recovery is never guaranteed">
              Aegis cannot freeze assets and sends no request automatically. Beware of “recovery services” that ask for fees or your seed phrase — they are scams.
            </Callout>
          </Reveal>
        </div>
      </div>

      <Reveal calm as="section" className="card calm-faq">
        <FaqAccordion title="Common questions" items={FAQ} className="calm-accordion" />
      </Reveal>
    </div>
  );
}
