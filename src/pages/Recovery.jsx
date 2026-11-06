import React, { useState } from 'react';
import { Download, LifeBuoy, Plus, Trash2 } from 'lucide-react';
import { useLocalList } from '../state/useLocalList';
import { useToast } from '../state/toast';
import { Address, Badge, Button, Callout, Card, EmptyState, Field, PageHeader } from '../components/ui';
import { downloadJson, isEvmAddress, isTxHash } from '../lib/format';

const CATEGORIES = ['Approval phishing', 'Address poisoning', 'Rug pull', 'Impersonation', 'Drainer contract', 'Other suspicious activity'];
const STEPS = [
  ['Revoke approvals', 'Immediately revoke token approvals granted to the attacker from a clean device.'],
  ['Move remaining funds', 'Transfer unaffected assets to a fresh wallet with a new seed phrase.'],
  ['Document everything', 'Record transaction hashes, messages and URLs. Export this incident package.'],
  ['Contact issuers & authorities', 'Use the issuer’s official incident process. Only authorized issuers can freeze eligible funds.'],
];

export default function Recovery() {
  const toast = useToast();
  const [cases, setCases] = useLocalList('aegis-cases');
  const [touched, setTouched] = useState(false);
  const [form, setForm] = useState({ address: '', category: CATEGORIES[0], tx: '', amount: '', evidence: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const errors = {
    address: !isEvmAddress(form.address) && 'Enter a valid 0x… address.',
    tx: !isTxHash(form.tx) && 'Enter a valid 66-character transaction hash.',
    amount: !(Number(form.amount) >= 0 && form.amount !== '') && 'Enter the reported loss.',
    evidence: form.evidence.trim().length < 20 && 'At least 20 characters.',
  };

  function submit(e) {
    e.preventDefault();
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    const item = { id: crypto.randomUUID(), ...form, created: new Date().toISOString(), status: 'Evidence collected' };
    if (setCases([item, ...cases])) {
      toast('Incident saved in this browser. Export the package for your records.', 'success');
      setForm({ address: '', category: CATEGORIES[0], tx: '', amount: '', evidence: '' });
      setTouched(false);
    } else toast('Browser storage is unavailable. Export your evidence manually.', 'error');
  }

  const exportCase = (item) => downloadJson(`aegis-incident-${item.id}.json`, {
    protocol: 'AEGIS', network: 'Arc Testnet',
    disclaimer: 'User-submitted allegations; not verified. No issuer request has been sent.', ...item,
  });

  return (
    <>
      <PageHeader eyebrow="Respond" title="Recovery center"
        description="Build a structured, exportable incident record. Incidents stay in this browser — nothing is uploaded." />
      <div className="steps-row">
        {STEPS.map(([t, d], i) => (
          <div key={t} className="mini-step"><span>{i + 1}</span><div><b>{t}</b><p className="muted">{d}</p></div></div>
        ))}
      </div>
      <div className="grid-main">
        <Card title="Open an incident">
          <form onSubmit={submit} noValidate>
            <div className="form-grid">
              <Field label="Attacker / recipient address" error={touched && errors.address}><input value={form.address} onChange={set('address')} placeholder="0x…" spellCheck={false} /></Field>
              <Field label="Category"><select value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Transaction hash" error={touched && errors.tx}><input value={form.tx} onChange={set('tx')} placeholder="0x…" spellCheck={false} /></Field>
              <Field label="Reported loss (USDC)" error={touched && errors.amount}><input type="number" min="0" step="0.000001" value={form.amount} onChange={set('amount')} placeholder="0.00" /></Field>
            </div>
            <Field label="Evidence and context" error={touched && errors.evidence}>
              <textarea rows={5} maxLength={5000} value={form.evidence} onChange={set('evidence')} placeholder="Timeline of events, links, screenshots you hold, contacts made…" />
            </Field>
            <div className="form-actions"><Button type="submit" icon={Plus}>Save incident</Button></div>
          </form>
        </Card>
        <div className="stack">
          <Card title="Your incidents" subtitle={`${cases.length} saved locally`} pad={false}>
            {cases.length ? (
              <ul className="list">
                {cases.map((c) => (
                  <li key={c.id}>
                    <div>
                      <div className="row"><b>{c.category}</b><Badge tone="info">{c.status}</Badge></div>
                      <Address value={c.address} />
                      <small className="muted">{new Date(c.created).toLocaleDateString()} · {c.amount} USDC</small>
                    </div>
                    <div className="row">
                      <Button variant="ghost" size="sm" icon={Download} onClick={() => exportCase(c)}>Export</Button>
                      <button className="icon-btn" aria-label="Delete incident" title="Delete" onClick={() => { if (confirm('Delete this local incident? Export it first if you need it.')) setCases(cases.filter((x) => x.id !== c.id)); }}><Trash2 size={15} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={LifeBuoy} title="No incidents">Records you create will appear here.</EmptyState>}
          </Card>
          <Callout tone="warning" title="Recovery is never guaranteed">
            Aegis cannot freeze assets and sends no request automatically. Beware of “recovery services” that ask for fees or your seed phrase — they are scams.
          </Callout>
        </div>
      </div>
    </>
  );
}
