import React, { useMemo, useState } from 'react';
import { Download, FileWarning, Fingerprint, PenLine, Wallet } from 'lucide-react';
import { evidenceHash } from '../chain';
import { useWallet } from '../state/wallet';
import { useRegistry } from '../state/registry';
import { useTx } from '../state/useTx';
import { useToast } from '../state/toast';
import { useLocalList } from '../state/useLocalList';
import { Address, Button, Callout, Card, EmptyState, Field, PageHeader, TxStatus } from '../components/ui';
import { downloadJson, isEvmAddress, isTxHash } from '../lib/format';

const CATEGORIES = ['Approval phishing', 'Address poisoning', 'Rug pull', 'Impersonation', 'Drainer contract', 'Other suspicious activity'];
const blank = { subject: '', category: CATEGORIES[0], description: '', txs: '' };

export default function Report({ params = {} }) {
  const wallet = useWallet();
  const reg = useRegistry();
  const tx = useTx();
  const toast = useToast();
  const [saved, setSaved] = useLocalList('aegis-evidence-packages');
  const [form, setForm] = useState(() => ({ ...blank, subject: params.address || blank.subject }));
  const [createdAt, setCreatedAt] = useState(() => new Date().toISOString());
  const [backedUp, setBackedUp] = useState(false);
  const [touched, setTouched] = useState(false);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setBackedUp(false); };
  const txList = form.txs.split(/[\s,]+/).filter(Boolean);

  const errors = {
    subject: !isEvmAddress(form.subject) ? 'Enter a valid 0x… address.' : '',
    description: form.description.trim().length < 20 ? 'Describe the incident in at least 20 characters.' : '',
    txs: txList.some((t) => !isTxHash(t)) ? 'Each transaction hash must be 0x followed by 64 hex characters.' : '',
  };
  const valid = !errors.subject && !errors.description && !errors.txs;

  const pkgText = useMemo(() => JSON.stringify({
    protocol: 'AEGIS',
    version: 1,
    network: 'Arc Testnet',
    registry: reg.address,
    subject: form.subject,
    category: form.category,
    description: form.description,
    transactions: txList,
    preparedAt: createdAt,
    disclaimer: 'User-submitted allegation. Not verified until resolved by the registry reviewer.',
  }, null, 2), [form, createdAt, reg.address]); // eslint-disable-line react-hooks/exhaustive-deps
  const hash = valid ? evidenceHash(pkgText) : '';

  function backup() {
    downloadJson(`aegis-evidence-${hash.slice(2, 12)}.json`, pkgText);
    setBackedUp(true);
  }

  async function submit(e) {
    e.preventDefault();
    setTouched(true);
    if (!valid || !backedUp) return;
    const receipt = await tx.run(reg.address, 'submit', [form.subject, hash]);
    if (receipt) {
      setSaved([{ hash, text: pkgText, subject: form.subject, category: form.category, tx: receipt.hash, at: createdAt }, ...saved]);
      toast('Report confirmed on Arc Testnet.', 'success');
      setForm(blank);
      setCreatedAt(new Date().toISOString());
      setBackedUp(false);
      setTouched(false);
      reg.refresh();
      wallet.refreshBalance();
    }
  }

  return (
    <>
      <PageHeader eyebrow="Report" title="Submit a threat report"
        description="Your evidence package stays offchain. Only its Keccak-256 hash is published, signed by your wallet." />
      <div className="grid-main">
        <Card title="Evidence package" subtitle="Everything in this form is hashed. Keep the exported file — it's the only way to prove what you submitted.">
          <form onSubmit={submit} noValidate>
            <div className="form-grid">
              <Field label="Suspected address" error={touched && errors.subject}>
                <input value={form.subject} onChange={set('subject')} placeholder="0x…" spellCheck={false} />
              </Field>
              <Field label="Category">
                <select value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
              </Field>
            </div>
            <Field label="What happened?" hint={`${form.description.length}/5000`} error={touched && errors.description}>
              <textarea value={form.description} onChange={set('description')} maxLength={5000} rows={6}
                placeholder="Describe the incident: how you were contacted, what you signed, links to supporting material…" />
            </Field>
            <Field label="Related transaction hashes (optional)" hint="Separate with spaces, commas or new lines." error={touched && errors.txs}>
              <textarea value={form.txs} onChange={set('txs')} rows={2} placeholder="0x…" spellCheck={false} />
            </Field>

            <div className="hash-box">
              <Fingerprint size={18} />
              <div>
                <small className="muted">Evidence hash (keccak256)</small>
                <code>{hash || 'Complete the form to compute the hash'}</code>
              </div>
              <Button type="button" variant="secondary" size="sm" icon={Download} disabled={!valid} onClick={backup}>
                {backedUp ? 'Saved' : 'Export'}
              </Button>
            </div>

            <label className="check">
              <input type="checkbox" checked={backedUp} disabled={!valid} onChange={(e) => setBackedUp(e.target.checked)} />
              <span>I've saved an exact copy of this evidence package. Editing the form after export changes the hash.</span>
            </label>

            {!wallet.isConnected ? (
              <Callout tone="info" title="Connect a wallet to sign" action={<Button size="sm" icon={Wallet} onClick={() => wallet.connect().catch(() => {})}>Connect</Button>}>
                Submitting costs a small amount of test USDC for gas.
              </Callout>
            ) : (
              <div className="form-actions">
                <Button type="submit" icon={PenLine} loading={tx.busy} disabled={!reg.available || !valid || !backedUp}>Sign & submit report</Button>
                <span className="muted small">Simulated before signing. Reports are public and permanent.</span>
              </div>
            )}
            <TxStatus tx={tx} />
          </form>
        </Card>

        <div className="stack">
          <Callout tone="warning" title="Before you publish">
            Never include private keys, seed phrases, or personal information about victims. Allegations are public and can be challenged by anyone.
          </Callout>
          <Card title="Your submitted packages" subtitle="Stored in this browser only" pad={false}>
            {saved.length ? (
              <ul className="list">
                {saved.map((s) => (
                  <li key={s.hash}>
                    <div>
                      <b>{s.category}</b>
                      <Address value={s.subject} link={false} />
                      <small className="muted"><code>{s.hash.slice(0, 14)}…</code></small>
                    </div>
                    <div className="row">
                      <Button variant="ghost" size="sm" icon={Download} onClick={() => downloadJson(`aegis-evidence-${s.hash.slice(2, 12)}.json`, s.text)}>File</Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={FileWarning} title="Nothing submitted yet">Confirmed submissions and their evidence files appear here.</EmptyState>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
