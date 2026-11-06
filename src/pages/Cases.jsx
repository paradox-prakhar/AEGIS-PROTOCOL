import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Circle, Download, FileWarning, LifeBuoy, ListChecks, Trash2, Wallet } from 'lucide-react';
import { useLocalList } from '../state/useLocalList';
import { useRegistry } from '../state/registry';
import { useWallet } from '../state/wallet';
import { useToast } from '../state/toast';
import { Address, Badge, Button, EmptyState, StatusBadge } from '../components/ui';
import { Reveal, RevealGroup, RevealItem } from '../components/motion';
import { downloadJson, formatDate, relativeTime } from '../lib/format';
import { duration, ease, stagger } from '../motion/config';

/**
 * Case tracker. Incidents are the browser-local records from the Emergency
 * flow; registry status is read live from the onchain registry.
 * `exportedAt` / `reportedAt` / `reference` are optional fields added to the
 * same local record when the user takes those steps.
 */

function Timeline({ steps }) {
  return (
    <motion.ol className="timeline" initial="hidden" animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger.calm } } }}>
      {steps.map((s) => (
        <motion.li key={s.title} className={`tl-step tl-${s.state}`}
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: duration.calm, ease: ease.calm } } }}>
          <span className="tl-dot" aria-hidden="true">{s.state === 'done' ? <Check size={13} /> : <Circle size={8} />}</span>
          <div className="tl-body">
            <div className="tl-head">
              <b>{s.title}</b>
              <span className="sr-only">— {s.state === 'done' ? 'done' : s.state === 'current' ? 'in progress' : 'not started'}</span>
              {s.when && <time className="tl-when">{s.when}</time>}
            </div>
            {s.text && <p>{s.text}</p>}
            {s.action}
          </div>
        </motion.li>
      ))}
    </motion.ol>
  );
}

function ReportedForm({ onSave }) {
  const [ref, setRef] = useState('');
  return (
    <form className="tl-inline" onSubmit={(e) => { e.preventDefault(); onSave(ref.trim()); }}>
      <input aria-label="Complaint or acknowledgement number (optional)" placeholder="Complaint / acknowledgement no. (optional)" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={64} />
      <Button type="submit" size="sm" variant="secondary" icon={Check}>I’ve reported it</Button>
    </form>
  );
}

function IncidentCard({ item, matches, reviewDelay, onUpdate, onDelete }) {
  const first = [...matches].sort((a, b) => a.createdAt - b.createdAt)[0];
  const resolved = matches.find((m) => m.status === 'Confirmed' || m.status === 'Rejected');
  const open = matches.find((m) => m.status === 'Pending' || m.status === 'Challenged');

  const exportCase = () => {
    downloadJson(`aegis-incident-${item.id}.json`, {
      protocol: 'AEGIS', network: 'Arc Testnet',
      disclaimer: 'User-submitted allegations; not verified. No issuer request has been sent.', ...item,
    });
    if (!item.exportedAt) onUpdate({ exportedAt: new Date().toISOString() });
  };

  const steps = [
    { title: 'Incident recorded', state: 'done', when: new Date(item.created).toLocaleString(), text: `${item.category} · ${item.amount} USDC` },
    {
      title: 'Evidence exported', state: item.exportedAt ? 'done' : 'current',
      when: item.exportedAt && new Date(item.exportedAt).toLocaleString(),
      text: item.exportedAt ? 'Keep this file safe — your bank or the police may ask for it.' : 'Download a copy you can share with your bank or the police.',
      action: !item.exportedAt && <Button size="sm" variant="secondary" icon={Download} onClick={exportCase}>Export evidence</Button>,
    },
    {
      title: 'Reported to the authorities', state: item.reportedAt ? 'done' : item.exportedAt ? 'current' : 'upcoming',
      when: item.reportedAt && new Date(item.reportedAt).toLocaleString(),
      text: item.reportedAt ? (item.reference ? <>Reference <code>{item.reference}</code></> : 'Marked as reported.') : <>Use the official channels on <a className="link-btn" href="#/help">Helplines &amp; resources</a>, then note your reference here.</>,
      action: !item.reportedAt && <ReportedForm onSave={(reference) => onUpdate({ reportedAt: new Date().toISOString(), reference })} />,
    },
    {
      title: 'Warned the community onchain', state: first ? 'done' : 'upcoming',
      when: first && formatDate(first.createdAt),
      text: first ? <>Report #{first.id} is on the public registry{matches.length > 1 ? ` (${matches.length} reports in total)` : ''}.</> : 'Optional: publish a signed report so others are warned before paying this address.',
      action: !first && <a className="link-btn" href={`#/report?address=${item.address}`}><FileWarning size={14} /> Report this address</a>,
    },
    {
      title: 'Community review', state: resolved ? 'done' : open ? 'current' : 'upcoming',
      when: resolved ? 'Decided' : open && reviewDelay ? `Window ends ${relativeTime(open.createdAt + reviewDelay)}` : undefined,
      text: resolved ? <>Outcome: <StatusBadge status={resolved.status} /></> : open ? <>Status: <StatusBadge status={open.status} /> — anyone can challenge before a reviewer decides.</> : 'Starts once an onchain report exists.',
    },
  ];
  const doneCount = steps.filter((s) => s.state === 'done').length;

  return (
    <article className="card case-card" aria-labelledby={`case-${item.id}`}>
      <header className="case-head">
        <div>
          <h3 id={`case-${item.id}`}>{item.category}</h3>
          <Address value={item.address} />
        </div>
        <div className="case-head-end">
          <Badge tone={doneCount === steps.length ? 'success' : 'info'}>{doneCount}/{steps.length} steps</Badge>
          <button className="icon-btn" aria-label="Export incident" title="Export" onClick={exportCase}><Download size={15} /></button>
          <button className="icon-btn" aria-label="Delete incident" title="Delete" onClick={() => { if (confirm('Delete this local incident? Export it first if you need it.')) onDelete(); }}><Trash2 size={15} /></button>
        </div>
      </header>
      <div className="case-progress" aria-hidden="true"><motion.span initial={{ scaleX: 0 }} animate={{ scaleX: doneCount / steps.length }} transition={{ duration: duration.calm, ease: ease.calm }} /></div>
      <Timeline steps={steps} />
    </article>
  );
}

export default function Cases() {
  const reg = useRegistry();
  const w = useWallet();
  const toast = useToast();
  const [cases, setCases] = useLocalList('aegis-cases');
  const mine = w.account ? reg.rows.filter((r) => r.reporter?.toLowerCase() === w.account.toLowerCase()) : [];
  const reviewDelay = reg.meta?.reviewDelay;

  const update = (id, patch) => {
    if (!setCases(cases.map((c) => (c.id === id ? { ...c, ...patch } : c)))) toast('Browser storage is unavailable.', 'error');
  };

  return (
    <div className="calm">
      <RevealGroup className="page-header" onMount>
        <div>
                    <RevealItem calm as="h1">My cases</RevealItem>
          <RevealItem calm as="p">What’s done, and what’s next.</RevealItem>
        </div>
      </RevealGroup>

      {cases.length ? (
        <div className="case-list">
          {cases.map((c, i) => (
            <Reveal calm key={c.id} delay={i * 0.08}>
              <IncidentCard item={c} reviewDelay={reviewDelay}
                matches={reg.rows.filter((r) => r.address.toLowerCase() === c.address.toLowerCase())}
                onUpdate={(patch) => update(c.id, patch)}
                onDelete={() => setCases(cases.filter((x) => x.id !== c.id))} />
            </Reveal>
          ))}
        </div>
      ) : (
        <Reveal calm className="card">
          <EmptyState icon={LifeBuoy} title="No cases yet"
            action={<a className="btn btn-calm" href="#/recovery">Start the emergency checklist</a>}>
            If something has gone wrong, the emergency checklist walks you through what to do and lets you open an incident.
          </EmptyState>
        </Reveal>
      )}

      <Reveal calm as="section" className="card" aria-labelledby="mine-title">
        <header className="card-head">
          <div><h3 id="mine-title">Reports you signed onchain</h3></div>
        </header>
        {!w.isConnected ? (
          <EmptyState icon={Wallet} title="Connect your wallet to see your reports"
            action={w.installed && <Button variant="secondary" onClick={() => w.connect().catch(() => {})} loading={w.connecting}>Connect wallet</Button>} />
        ) : mine.length ? (
          <ul className="list">
            {mine.map((r) => (
              <li key={r.id}>
                <div>
                  <div className="row"><b>Report #{r.id}</b><StatusBadge status={r.status} /></div>
                  <Address value={r.address} link={false} />
                  <small className="muted">Filed {relativeTime(r.createdAt)}</small>
                </div>
                <a className="link-btn" href={`#/registry?id=${r.id}`}>Open</a>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={FileWarning} title="No reports from this wallet">{reg.error || 'Reports you submit will appear here with their review status.'}</EmptyState>
        )}
      </Reveal>
    </div>
  );
}
