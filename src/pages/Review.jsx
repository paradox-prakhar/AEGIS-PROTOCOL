import React, { useEffect, useState } from 'react';
import { Gavel, Search, Swords, ShieldCheck, ShieldX, Wallet, Download } from 'lucide-react';
import { evidenceHash, fetchReport, friendlyError, hasChallenged } from '../chain';
import { useWallet } from '../state/wallet';
import { useRegistry } from '../state/registry';
import { useTx } from '../state/useTx';
import { useToast } from '../state/toast';
import { Address, Button, Callout, Card, Field, PageHeader, StatusBadge, TxStatus } from '../components/ui';
import { downloadJson, duration, formatDate } from '../lib/format';

export default function Review({ params }) {
  const wallet = useWallet();
  const reg = useRegistry();
  const toast = useToast();
  const tx = useTx();
  const [idInput, setIdInput] = useState(params.id ?? '');
  const [report, setReport] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [already, setAlready] = useState(false);
  const [evidence, setEvidence] = useState('');
  const [now, setNow] = useState(Date.now() / 1000);

  useEffect(() => { const t = setInterval(() => setNow(Date.now() / 1000), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { if (params.id !== undefined) { setIdInput(params.id); load(params.id); } }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (report && wallet.account) hasChallenged(reg.address, report.id, wallet.account).then(setAlready).catch(() => setAlready(false));
    else setAlready(false);
  }, [report, wallet.account, reg.address]);

  async function load(raw = idInput) {
    setLookupError('');
    setReport(null);
    tx.reset();
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 0) return setLookupError('Enter a whole-number report ID.');
    if (reg.meta && id >= reg.meta.count) return setLookupError(`Report #${id} does not exist. The registry has ${reg.meta.count} report(s).`);
    try {
      setReport(await fetchReport(reg.address, id));
    } catch (e) {
      setLookupError(friendlyError(e));
    }
  }

  const isReviewer = wallet.account && reg.meta && wallet.account.toLowerCase() === reg.meta.reviewer.toLowerCase();
  const isOpen = report && (report.status === 'Pending' || report.status === 'Challenged');
  const opensAt = report ? report.createdAt + (reg.meta?.reviewDelay || 172800) : 0;
  const windowOpen = now >= opensAt;

  async function after(receipt, msg) {
    if (!receipt) return;
    toast(msg, 'success');
    setEvidence('');
    await reg.refresh();
    load(report.id);
  }

  return (
    <>
      <PageHeader eyebrow="Adjudicate" title="Challenge & review"
        description="Dispute an allegation with counter-evidence, or — as the trusted reviewer — resolve it once the two-day window has passed." />

      <Card>
        <form className="lookup" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <Field label="Report ID">
            <input type="number" min="0" step="1" value={idInput} onChange={(e) => setIdInput(e.target.value)} placeholder="e.g. 0" />
          </Field>
          <Button type="submit" icon={Search} variant="secondary">Look up</Button>
        </form>
        {lookupError && <p className="field-msg error">{lookupError}</p>}
        {report && (
          <div className="report-summary">
            <div className="row between">
              <h3>Report #{report.id}</h3>
              <StatusBadge status={report.status} />
            </div>
            <dl className="kv kv-cols">
              <dt>Subject</dt><dd><Address value={report.address} /></dd>
              <dt>Reporter</dt><dd><Address value={report.reporter} /></dd>
              <dt>Submitted</dt><dd>{formatDate(report.createdAt)}</dd>
              <dt>Review window</dt><dd>{!isOpen ? 'Resolved' : windowOpen ? 'Open now' : `Opens in ${duration(opensAt - now)}`}</dd>
            </dl>
          </div>
        )}
      </Card>

      {!wallet.isConnected && (
        <Callout tone="info" title="Connect a wallet to challenge or resolve" action={<Button size="sm" icon={Wallet} onClick={() => wallet.connect().catch(() => {})}>Connect</Button>} />
      )}

      {report && isOpen && (
        <div className="grid-2">
          <Card title={<><Swords size={17} /> Challenge this report</>} subtitle="Submit the hash of your counter-evidence. Each wallet can challenge a report once.">
            {already ? (
              <Callout tone="success">Your connected wallet has already challenged this report.</Callout>
            ) : (
              <form onSubmit={async (e) => { e.preventDefault(); after(await tx.run(reg.address, 'challenge', [BigInt(report.id), evidenceHash(evidence), '']), 'Challenge confirmed.'); }}>
                <Field label="Counter-evidence" hint={evidence.length >= 20 ? `Hash ${evidenceHash(evidence).slice(0, 18)}…` : 'At least 20 characters. Export a copy before signing.'}>
                  <textarea rows={5} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Explain why this allegation is wrong, with verifiable references…" />
                </Field>
                <div className="form-actions">
                  <Button type="submit" icon={Swords} loading={tx.busy} disabled={!wallet.isConnected || evidence.length < 20}>Sign challenge</Button>
                  <Button type="button" variant="ghost" size="sm" icon={Download} disabled={evidence.length < 20}
                    onClick={() => downloadJson(`aegis-challenge-${report.id}.txt`, evidence)}>Export</Button>
                </div>
              </form>
            )}
          </Card>

          <Card title={<><Gavel size={17} /> Reviewer resolution</>} subtitle={<>Reviewer: <Address value={reg.meta?.reviewer} /></>}>
            {!isReviewer ? (
              <Callout tone="info">Only the registry reviewer can resolve reports. {wallet.isConnected && 'Your connected wallet is not the reviewer.'}</Callout>
            ) : !windowOpen ? (
              <Callout tone="warning" title="Review window not open">Resolution unlocks {formatDate(opensAt)} ({duration(opensAt - now)} from now).</Callout>
            ) : (
              <div className="resolve">
                <p className="muted">Resolution is final. Confirmed reports are flagged as threats by every Aegis client.</p>
                <div className="row">
                  <Button variant="danger" icon={ShieldX} loading={tx.busy} onClick={async () => after(await tx.run(reg.address, 'resolve', [BigInt(report.id), true]), 'Report confirmed.')}>Confirm threat</Button>
                  <Button variant="secondary" icon={ShieldCheck} loading={tx.busy} onClick={async () => after(await tx.run(reg.address, 'resolve', [BigInt(report.id), false]), 'Allegation rejected.')}>Reject allegation</Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
      {report && !isOpen && <Callout tone="info">This report is {report.status.toLowerCase()} and can no longer be challenged or resolved.</Callout>}
      <TxStatus tx={tx} />
    </>
  );
}
