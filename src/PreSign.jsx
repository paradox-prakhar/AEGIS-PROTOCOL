import React, { useState } from 'react';
import { isAddress, parseEther } from 'ethers';
import { activeRegistry, describeError, lookupSubject, rpcProvider, subjectStatus } from './chain';
import { assess, crossCheck } from './risk';
import { parseFeeds, queryFeeds, simulateTransaction } from './signals';

// Pre-sign check: simulate a pending transaction and screen its destination against every connected signal.
export default function PreSign() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [out, setOut] = useState(null);

  async function run(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(''); setOut(null);
    try {
      const to = String(f.get('to')).trim();
      const from = String(f.get('from')).trim();
      const data = String(f.get('data') || '0x').trim() || '0x';
      if (!/^0x([0-9a-fA-F]{2})*$/.test(data)) throw new Error('Calldata must be hex like 0x095ea7b3…');
      const value = f.get('value') ? parseEther(String(f.get('value'))) : 0n;
      const registryAddress = activeRegistry();
      const feeds = parseFeeds(import.meta.env.VITE_THREAT_FEEDS);
      const feedResult = feeds.length ? await queryFeeds(to, feeds) : null;
      const isFlagged = async (a) => {
        if (feedResult?.hits.length && a.toLowerCase() === to.toLowerCase()) return true;
        if (!registryAddress) return false;
        const s = await subjectStatus(registryAddress, a).catch(() => ({ confirmed: 0 }));
        return s.confirmed > 0;
      };
      const simulation = await simulateTransaction(rpcProvider(), { from, to, data, value }, { isFlagged });
      const rows = registryAddress ? (await lookupSubject(registryAddress, to).catch(() => ({ rows: [] }))).rows : [];
      setOut({ simulation, verdict: assess({ arcRows: rows, feeds: feedResult, simulation }) });
    } catch (err) { setError(describeError(err)); } finally { setBusy(false); }
  }

  return (
    <section className="panel inset">
      <h3>Pre-sign check</h3>
      <p>Paste a transaction you are about to sign. Aegis simulates it and checks the destination before you approve. Nothing is sent from your wallet.</p>
      <form onSubmit={run}>
        <label>From (your address)<input name="from" required pattern="0x[a-fA-F0-9]{40}" placeholder="0x…" /></label>
        <label>To (contract or recipient)<input name="to" required pattern="0x[a-fA-F0-9]{40}" placeholder="0x…" /></label>
        <label>Calldata (optional)<input name="data" placeholder="0x…" /></label>
        <label>Value in USDC (optional)<input name="value" type="number" min="0" step="0.000001" /></label>
        <button className="primary" disabled={busy}>{busy ? 'Checking…' : 'Check transaction'}</button>
      </form>
      {error && <div className="alert" role="alert">{error}</div>}
      {out && (
        <div className={'result ' + (out.verdict.danger || out.simulation.findings.some((x) => x.severity === 'critical' || x.severity === 'high') ? 'danger' : '')} aria-live="polite">
          <strong>{out.verdict.level}{out.verdict.score !== null && ` · ${out.verdict.score}/100`}</strong>
          {out.simulation.findings.length === 0 && <p>No dangerous patterns found in the calldata.</p>}
          {out.simulation.findings.map((x) => <p key={x.code + x.text}>{x.severity.toUpperCase()}: {x.text}</p>)}
          {out.simulation.gas !== null && <p>Estimated gas: {out.simulation.gas.toString()}.</p>}
          {out.simulation.notes.map((n) => <p key={n}>{n}</p>)}
          {out.verdict.reasons.map((r) => <p key={r}>{r}</p>)}
          <p>A clean result is not a guarantee of safety.</p>
        </div>
      )}
    </section>
  );
}
