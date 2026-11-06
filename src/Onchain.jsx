import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatEther, isAddress } from 'ethers';
import {
  activeRegistry, addressUrl, configuredRegistry, connectWallet, defaultReviewer, deployRegistry, describeError,
  evidenceHash, expectedDeployer, fetchReports, registryInfo, rememberRegistry, reportIdFromReceipt, sendRegistryTx, txUrl,
} from './chain';
import { CATEGORIES, MAX_DESCRIPTION, arkivEntityUrl, arkivTxUrl } from './arkiv-meta';
const arkiv = () => import('./arkiv');

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
const date = (s) => (s ? new Date(s * 1000).toLocaleString() : '—');
const PENDING_KEY = 'aegis-pending-arkiv';
const loadPending = () => { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch { return null; } };
const savePending = (v) => { try { v ? localStorage.setItem(PENDING_KEY, JSON.stringify(v)) : localStorage.removeItem(PENDING_KEY); } catch { /* storage unavailable */ } };
const same = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export default function Onchain() {
  const [account, setAccount] = useState('');
  const [balance, setBalance] = useState('');
  const [address, setAddress] = useState(activeRegistry);
  const [info, setInfo] = useState(null);
  const [reviewerInput, setReviewerInput] = useState(defaultReviewer);
  const [rows, setRows] = useState([]);
  const [nextBefore, setNextBefore] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [tx, setTx] = useState('');
  const [dual, setDual] = useState(null);
  const busyRef = useRef(false);

  const validRegistry = isAddress(address);
  const isReviewer = same(account, info?.reviewer);
  const isPending = same(account, info?.pendingReviewer);
  const v2 = (info?.version ?? 0) >= 2;

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return undefined;
    const reset = () => { if (busyRef.current) return; setAccount(''); setBalance(''); setMessage('Wallet account or network changed. Reconnect before continuing.'); };
    eth.on('accountsChanged', reset);
    eth.on('chainChanged', reset);
    return () => { eth.removeListener?.('accountsChanged', reset); eth.removeListener?.('chainChanged', reset); };
  }, []);

  const refresh = useCallback(async (target = address) => {
    const [nextInfo, page] = await Promise.all([registryInfo(target), fetchReports(target)]);
    setInfo(nextInfo);
    setRows(page.rows);
    setNextBefore(page.nextBefore);
    return nextInfo;
  }, [address]);

  // Auto-load the configured shared registry so visitors see live data without clicking.
  useEffect(() => {
    if (!validRegistry) return;
    let cancelled = false;
    refresh().catch((e) => { if (!cancelled) setError(describeError(e)); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn) {
    busyRef.current = true; setBusy(true); setError(''); setTx(''); setMessage('Waiting for wallet or network confirmation…');
    try { await fn(); } catch (e) { setError(describeError(e)); setMessage(''); } finally { busyRef.current = false; setBusy(false); }
  }

  async function connect() {
    const signer = await connectWallet();
    const a = await signer.getAddress();
    setAccount(a);
    setBalance(formatEther(await signer.provider.getBalance(a)));
    setMessage('Connected to Arc Testnet.');
  }

  async function write(method, args, done = 'Transaction confirmed on Arc Testnet.') {
    const receipt = await sendRegistryTx(address, method, args, (hash) => { setTx(hash); setMessage('Transaction submitted. Waiting for confirmation…'); });
    await refresh();
    setMessage(done);
    return receipt;
  }

  // One report, two networks: Arkiv entity first (public, queryable), then Arc (adjudicated source of truth).
  async function submitBoth(f) {
    const subject = String(f.get('subject'));
    const hash = evidenceHash(f.get('evidence'));
    const uri = String(f.get('uri') || '').trim();
    const category = String(f.get('category'));
    const description = String(f.get('description') || '').trim();
    let pending = loadPending();
    if (!pending || !same(pending.subject, subject) || pending.evidenceHash !== hash || pending.registry !== address) {
      setDual({ stage: 'arkiv' });
      setMessage('Step 1 of 2: approve the Arkiv (Rabdi) transaction in your wallet…');
      const made = await (await arkiv()).createArkivReport({ subject, category, evidenceHash: hash, description });
      pending = { subject, evidenceHash: hash, registry: address, entityKey: made.entityKey, arkivTx: made.txHash, reporter: made.reporter };
      savePending(pending);
    }
    setDual({ stage: 'arc', entityKey: pending.entityKey, arkivTx: pending.arkivTx });
    setMessage('Step 2 of 2: switch to Arc Testnet and approve the registry transaction…');
    let receipt;
    try {
      receipt = await write('submit', [subject, hash, uri, pending.entityKey], 'Report confirmed on Arc and linked to its Arkiv record.');
    } catch (e) {
      setDual({ stage: 'retry', entityKey: pending.entityKey, arkivTx: pending.arkivTx });
      throw new Error(`${describeError(e)} Your Arkiv record is saved but is not a verified report until Arc succeeds. Submit again to retry with the same Arkiv entity.`);
    }
    savePending(null);
    setDual({ stage: 'done', entityKey: pending.entityKey, arkivTx: pending.arkivTx, arcTx: receipt.hash, reportId: reportIdFromReceipt(receipt, address) });
  }

  async function linkBack() {
    setMessage('Approve the Arkiv transaction that records the Arc report id on your entity…');
    const { txHash } = await (await arkiv()).linkArcReport(dual.entityKey, { arcReportId: dual.reportId, arcTxHash: dual.arcTx });
    setDual({ ...dual, linkTx: txHash });
    setMessage('Arc report id recorded on Arkiv.');
  }

  function onForm(e, method) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const uri = String(f.get('uri') || '').trim();
    let args;
    if (method === 'submit' && v2) { run(async () => { await submitBoth(f); form.reset(); }); return; }
    if (method === 'submit') args = [f.get('subject'), evidenceHash(f.get('evidence')), uri];
    else if (method === 'challenge') args = [BigInt(f.get('id')), evidenceHash(f.get('evidence')), uri];
    else args = [BigInt(f.get('id')), f.get('decision') === 'confirm'];
    run(async () => { await write(method, args); form.reset(); });
  }

  async function loadOlder() {
    const page = await fetchReports(address, { before: nextBefore });
    setRows((r) => [...r, ...page.rows]);
    setNextBefore(page.nextBefore);
    setMessage('');
  }

  async function deploy() {
    const deployed = await deployRegistry(reviewerInput, (hash) => {
      setTx(hash);
      setMessage('Deployment submitted. Keep the transaction link if you close this tab.');
    });
    setAddress(deployed);
    const saved = rememberRegistry(deployed);
    await refresh(deployed);
    setMessage(`Deployed v2 registry ${deployed}. ${saved ? 'Saved in this browser. ' : ''}Run scripts/verify-deployment.mjs, then set VITE_REGISTRY_ADDRESS and rebuild to share it.`);
  }

  return (
    <section className="panel">
      <h3>Arc Testnet · Onchain workspace</h3>
      <p>Real wallet signatures, real testnet transactions. Evidence text stays offchain; only its Keccak-256 hash (and an optional URI) is public.</p>

      <div className="toolbar">
        <button type="button" className="primary" disabled={busy} onClick={() => run(connect)}>
          {account ? 'Reconnect wallet' : 'Connect & switch to Arc Testnet'}
        </button>
        {account && <span className="mono">{short(account)} · {Number(balance).toFixed(4)} USDC{isReviewer && ' · reviewer'}</span>}
      </div>

      <div aria-live="polite">
        {message && <div className="notice">{message}</div>}
        {error && <div className="alert" role="alert">{error}</div>}
        {tx && <p><a href={txUrl(tx)} target="_blank" rel="noreferrer">View transaction on explorer ↗</a></p>}
      </div>

      {dual && (
        <div className="notice" role="status">
          <strong>{dual.stage === 'done' ? 'Report on both networks' : dual.stage === 'retry' ? 'Arc step failed. Arkiv record kept' : 'Submitting…'}</strong>
          {dual.entityKey && <p className="mono small">Arkiv entity: <a href={arkivEntityUrl(dual.entityKey)} target="_blank" rel="noreferrer">{short(dual.entityKey)} ↗</a>{dual.arkivTx && <> · <a href={arkivTxUrl(dual.arkivTx)} target="_blank" rel="noreferrer">Arkiv tx ↗</a></>}</p>}
          {dual.arcTx && <p className="mono small">Arc report #{dual.reportId ?? '?'} · <a href={txUrl(dual.arcTx)} target="_blank" rel="noreferrer">Arc tx ↗</a></p>}
          {dual.stage === 'done' && !dual.linkTx && dual.reportId !== null && <button type="button" className="secondary" disabled={busy} onClick={() => run(linkBack)}>Record Arc report id on Arkiv (optional)</button>}
          {dual.linkTx && <p className="mono small"><a href={arkivTxUrl(dual.linkTx)} target="_blank" rel="noreferrer">Arkiv link tx ↗</a></p>}
        </div>
      )}

      {info && (
        <div className="stats compact">
          <article><div>Registry</div><strong className="mono small"><a href={addressUrl(info.address)} target="_blank" rel="noreferrer">{short(info.address)} ↗</a></strong><p>Contract v{info.version}</p></article>
          <article><div>Reports</div><strong>{info.reportCount}</strong><p>{v2 ? 'Full onchain index' : 'v1 · scanner covers latest 100'}</p></article>
          <article><div>Reviewer</div><strong className="mono small">{short(info.reviewer)}</strong><p>{info.pendingReviewer ? `Pending: ${short(info.pendingReviewer)}` : `${info.reviewDelay / 86400}-day review delay`}</p></article>
          <article><div>Status</div><strong>{info.paused ? 'Paused' : 'Active'}</strong><p>{info.paused ? 'Submissions disabled' : 'Accepting reports'}</p></article>
        </div>
      )}

      <div className="twocol">
        <div>
          <label>Registry address
            <input value={address} onChange={(e) => { setAddress(e.target.value.trim()); setRows([]); setInfo(null); }} placeholder="0x…" disabled={!!configuredRegistry && busy} />
          </label>
          <button type="button" className="secondary" disabled={busy || !validRegistry} onClick={() => run(async () => { await refresh(); setMessage('Registry loaded.'); })}>Load registry</button>

          <details className="deploy">
            <summary>Deploy a new v2 registry</summary>
            {expectedDeployer && <p className="mono">Deployment wallet: {expectedDeployer}</p>}
            <label>Reviewer address (use a multisig for production)
              <input value={reviewerInput} onChange={(e) => setReviewerInput(e.target.value.trim())} placeholder="0x…" />
            </label>
            <button type="button" className="secondary" disabled={busy || !account || !isAddress(reviewerInput)} onClick={() => run(deploy)}>Deploy registry with wallet</button>
            <p>Deploy once and share one address with every client. The reviewer adjudicates reports after the review delay and can pause submissions in an emergency.</p>
          </details>
        </div>

        <form onSubmit={(e) => onForm(e, 'submit')}>
          <h3>Submit a report</h3>
          <label>Suspected address<input name="subject" required pattern="0x[a-fA-F0-9]{40}" placeholder="0x…" /></label>
          <label>Evidence package (keep an exact copy; only its hash is published)
            <textarea name="evidence" required minLength={20} maxLength={20000} />
          </label>
          {v2 && (
            <>
              <label>Category<select name="category">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label>Public summary (stored on Arkiv; no personal data, max {MAX_DESCRIPTION} chars)<input name="description" required maxLength={MAX_DESCRIPTION} /></label>
              <label>Evidence URI (optional, e.g. ipfs://…; no personal data)<input name="uri" maxLength={256} /></label>
            </>
          )}
          <button className="primary" disabled={busy || !validRegistry || info?.paused}>{v2 ? 'Sign & submit to Arkiv + Arc' : 'Sign & submit report'}</button>
          {v2 ? <p>Two wallet approvals: an Arkiv (Rabdi) transaction paid in tGLM, then an Arc transaction paid in USDC.</p> : info && <p>This registry is v1 and has no Arkiv link. Deploy the v2 registry to enable Arkiv + Arc reports.</p>}
        </form>
      </div>

      <div className="twocol">
        <form onSubmit={(e) => onForm(e, 'challenge')}>
          <h3>Challenge a report</h3>
          <label>Report ID<input type="number" name="id" min="0" step="1" required /></label>
          <label>Counter-evidence<textarea name="evidence" minLength={20} maxLength={20000} required /></label>
          {v2 && <label>Evidence URI (optional)<input name="uri" maxLength={256} /></label>}
          <button className="secondary" disabled={busy || !validRegistry || info?.paused}>Sign challenge</button>
        </form>

        <form onSubmit={(e) => onForm(e, 'resolve')}>
          <h3>Reviewer resolution</h3>
          <p>Only the reviewer can resolve, and only after the review window.</p>
          <label>Report ID<input type="number" name="id" min="0" step="1" required /></label>
          <label>Decision<select name="decision"><option value="reject">Reject allegation</option><option value="confirm">Confirm report</option></select></label>
          <button className="secondary" disabled={busy || !validRegistry || (account && info && !isReviewer)}>Sign resolution</button>
        </form>
      </div>

      {v2 && (isReviewer || isPending) && (
        <div className="panel inset">
          <h3>Reviewer administration</h3>
          {isReviewer && (
            <>
              <button type="button" className="secondary" disabled={busy} onClick={() => run(() => write(info.paused ? 'unpause' : 'pause', [], info.paused ? 'Registry unpaused.' : 'Registry paused.'))}>
                {info.paused ? 'Unpause registry' : 'Pause submissions & challenges'}
              </button>
              <form onSubmit={(e) => { e.preventDefault(); const to = new FormData(e.currentTarget).get('to'); run(() => write('transferReviewer', [to], 'Nomination recorded. The new reviewer must accept.')); }}>
                <label>Nominate new reviewer (two-step; enter 0x000…000 to cancel)<input name="to" required pattern="0x[a-fA-F0-9]{40}" /></label>
                <button className="secondary" disabled={busy}>Nominate reviewer</button>
              </form>
            </>
          )}
          {isPending && <button type="button" className="primary" disabled={busy} onClick={() => run(() => write('acceptReviewer', [], 'You are now the reviewer.'))}>Accept reviewer role</button>}
        </div>
      )}

      <h3 style={{ marginTop: 30 }}>Shared registry records</h3>
      <div className="tablewrap">
        <table>
          <thead><tr><th>ID</th><th>SUBJECT</th><th>STATUS</th><th>CREATED</th><th>REPORTER</th><th>EVIDENCE HASH</th><th>ARKIV</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td className="mono"><a href={addressUrl(r.address)} target="_blank" rel="noreferrer">{r.address}</a></td>
                <td><span className="badge">{r.status}{r.challengeCount ? ` · ${r.challengeCount}` : ''}</span></td>
                <td>{date(r.createdAt)}</td>
                <td className="mono">{short(r.reporter)}</td>
                <td className="mono" title={r.evidenceHash}>{r.evidenceHash.slice(0, 18)}…</td>
                <td className="mono">{r.arkivEntityKey ? <a href={arkivEntityUrl(r.arkivEntityKey)} target="_blank" rel="noreferrer">{short(r.arkivEntityKey)} ↗</a> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>{info ? 'No reports yet.' : 'Load a deployed registry to see shared records.'}</p>}
      {nextBefore !== null && <button type="button" className="secondary" disabled={busy} onClick={() => run(loadOlder)}>Load older reports</button>}
    </section>
  );
}
