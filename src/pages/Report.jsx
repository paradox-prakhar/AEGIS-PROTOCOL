import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, FileWarning, Fingerprint, PenLine, RefreshCw, Wallet } from 'lucide-react';
import { evidenceHash, explorerTx, fetchReportsBy, friendlyError, reportIdFromReceipt } from '../chain';
import { useWallet } from '../state/wallet';
import { useRegistry } from '../state/registry';
import { useTx } from '../state/useTx';
import { useToast } from '../state/toast';
import { useLocalList } from '../state/useLocalList';
import { Address, Button, Callout, Card, EmptyState, Field, PageHeader, StatusBadge, TxStatus } from '../components/ui';
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
  const [lastReport, setLastReport] = useState(null);
  const [mine, setMine] = useState({ rows: [], loading: false, error: '', complete: true });

  // Reports filed by the connected wallet, with their live onchain status.
  const loadMine = useCallback(async () => {
    if (!wallet.account || !reg.address) { setMine({ rows: [], loading: false, error: '', complete: true }); return; }
    setMine((m) => ({ ...m, loading: true, error: '' }));
    try {
      const { rows, complete } = await fetchReportsBy(reg.address, wallet.account);
      setMine({ rows, loading: false, error: '', complete });
    } catch (e) {
      setMine((m) => ({ ...m, loading: false, error: friendlyError(e) }));
    }
  }, [wallet.account, reg.address]);
  useEffect(() => { loadMine(); }, [loadMine]);
  const pkgByHash = useMemo(() => new Map(saved.map((s) => [s.hash.toLowerCase(), s])), [saved]);

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
    const receipt = await tx.run(reg.address, 'submit', [form.subject, hash, '']);
    if (receipt) {
      const id = reportIdFromReceipt(receipt);
      const entry = { id, hash, text: pkgText, subject: form.subject, category: form.category, description: form.description, tx: receipt.hash, at: createdAt };
      setSaved([entry, ...saved]);
      setLastReport(entry);
      toast('Report confirmed on Arc Testnet.', 'success');
      loadMine();
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
          {lastReport && (
            <Card title="Report submitted" subtitle="Your report is now public onchain and pending review.">
              <div className="stack">
                <p><CheckCircle2 size={16} /> <b>{lastReport.id !== null ? `Report #${lastReport.id}` : 'Report'}</b> · {lastReport.category}</p>
                <Address value={lastReport.subject} link={false} />
                <p className="muted small" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{lastReport.description}</p>
                <small className="muted">Evidence hash <code>{lastReport.hash.slice(0, 18)}…</code></small>
                <div className="row">
                  {lastReport.id !== null && <a className="btn btn-secondary btn-sm" href={`#/registry?id=${lastReport.id}`}>View in registry</a>}
                  <a className="link-btn" href={explorerTx(lastReport.tx)} target="_blank" rel="noreferrer">Transaction ↗</a>
                </div>
                <small className="muted">Wallets that transacted with this address will be flagged as linked when they are checked.</small>
              </div>
            </Card>
          )}
          <Card title="My reports" subtitle={wallet.isConnected ? 'Reports filed by your connected wallet, with live status' : 'Connect your wallet to see your reports'} pad={false}
            action={wallet.isConnected && <Button variant="ghost" size="sm" icon={RefreshCw} loading={mine.loading} onClick={loadMine}>Refresh</Button>}>
            {mine.error && <p className="field-msg error" role="alert" style={{ padding: '0 16px' }}>{mine.error}</p>}
            {mine.rows.length ? (
              <ul className="list">
                {mine.rows.map((r) => {
                  const pkg = pkgByHash.get(r.evidenceHash.toLowerCase());
                  return (
                    <li key={r.id}>
                      <div>
                        <b><a href={`#/registry?id=${r.id}`}>Report #{r.id}</a>{pkg ? ` · ${pkg.category}` : ''}</b>
                        <Address value={r.address} link={false} />
                        {pkg?.description && <small className="muted" style={{ overflowWrap: 'anywhere' }}>{pkg.description.length > 140 ? `${pkg.description.slice(0, 140)}…` : pkg.description}</small>}
                        <small className="muted">{new Date(r.createdAt * 1000).toLocaleString()} · <code>{r.evidenceHash.slice(0, 14)}…</code></small>
                      </div>
                      <div className="row">
                        <StatusBadge status={r.status} />
                        {pkg && <Button variant="ghost" size="sm" icon={Download} onClick={() => downloadJson(`aegis-evidence-${pkg.hash.slice(2, 12)}.json`, pkg.text)}>File</Button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={FileWarning} title={mine.loading ? 'Loading your reports…' : 'No reports yet'}>
                {wallet.isConnected ? 'Reports you submit from this wallet appear here with their review status.' : 'Connect the wallet you reported from.'}
              </EmptyState>
            )}
            {!mine.complete && <p className="muted small" style={{ padding: '0 16px 12px' }}>Showing reports from the latest 2000 registry records.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
