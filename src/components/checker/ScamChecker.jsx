import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Lock, RotateCcw, ScanLine, Sparkles, Wallet } from 'lucide-react';
import { Button } from '../ui';
import { Radar } from './Radar';
import { Verdict } from './Verdict';
import { screenAddress } from '../../lib/screen';
import { flaggedWallets, linkedRisk } from '../../lib/links';
import { lookupSubject } from '../../chain';
import { isEvmAddress } from '../../lib/format';
import { sampleAddress } from '../../risk';
import { useRegistry } from '../../state/registry';
import { useCursor } from '../cursor/CursorSystem';

const WORDS = ['REGISTRY', 'REPORTS', 'LINKS', 'REVIEWS'];
const STEPS = ['Address', 'Registry reports', 'Linked wallets', 'Verdict'];

function toVerdict(r) {
  const verdict = r.tone === 'danger' ? 'dangerous' : r.tone === 'warning' ? 'suspicious' : 'unknown';
  return {
    verdict, demo: r.demo, matches: r.matches, links: r.links, connected: r.connected, label: r.level,
    findings: r.reasons.map((text) => ({ tone: r.tone === 'danger' ? 'danger' : r.tone === 'warning' ? 'warning' : 'info', text })),
  };
}

export function ScamChecker({ initialValue = '' }) {
  const reg = useRegistry();
  const cursor = useCursor();
  const reduce = useReducedMotion();
  const [value, setValue] = useState(initialValue);
  const [phase, setPhase] = useState('idle'); // idle | scanning | done
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const timers = useRef([]);
  const resultRef = useRef(null);

  useEffect(() => () => { timers.current.forEach(clearTimeout); cursor.setMode(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    timers.current.forEach(clearTimeout);
    setPhase('idle'); setResult(null); setStep(0); setError('');
    cursor.setMode(null);
  }

  /** Walks through the visible steps, then reveals the verdict. */
  function reveal(res) {
    const stepMs = reduce ? 0 : 380;
    STEPS.forEach((_, i) => {
      timers.current.push(setTimeout(() => setStep(i + 1), stepMs * (i + 1)));
    });
    timers.current.push(setTimeout(() => {
      setResult(res);
      setPhase('done');
      cursor.setMode(null);
      requestAnimationFrame(() => resultRef.current?.focus({ preventScroll: false }));
    }, stepMs * (STEPS.length + 0.6)));
  }

  async function run(e) {
    e?.preventDefault();
    setError('');
    const v = value.trim();
    if (!v) { setError('Paste a wallet address to check first.'); return; }
    if (!isEvmAddress(v)) { setError('Enter a valid wallet address: 0x followed by 40 letters/numbers.'); return; }

    timers.current.forEach(clearTimeout);
    timers.current = [];
    setResult(null); setStep(0); setPhase('scanning');
    cursor.setMode('scanning');

    // Direct reports: v2 registries index reports per address, so the whole history is checked;
    // on v1 lookupSubject scans the latest 100. If the lookup fails, use the rows already loaded.
    const direct = (async () => {
      if (!reg.address) return { rows: reg.rows, full: false, ok: reg.available };
      try {
        const found = await lookupSubject(reg.address, v);
        return { rows: found.rows, full: found.complete, ok: true };
      } catch {
        return { rows: reg.rows, full: false, ok: reg.available };
      }
    })();
    // Linked wallets: anything this address transacted with that has a confirmed or open report.
    const linked = linkedRisk(v, flaggedWallets(reg.rows, [sampleAddress])).catch((err) => ({ error: err.message }));

    const [d, linkage] = await Promise.all([direct, linked]);
    const res = toVerdict(screenAddress(v, d.rows, d.ok, d.full, linkage));
    reveal({ ...res, mode: 'wallet', input: v });
  }

  const busy = phase === 'scanning';

  return (
    <div className="checker">
      <form id="checker-panel" className="checker-form" onSubmit={run} noValidate>
        <div className="checker-input">
          <Wallet size={18} aria-hidden="true" />
          <input aria-label="Wallet address" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0x… wallet or contract address"
            spellCheck={false} autoComplete="off" disabled={busy} />
        </div>

        <p className="privacy-note"><Lock size={14} aria-hidden="true" />
          Checks the onchain report registry and the wallet’s transaction links. Never paste private keys or seed phrases.
        </p>
        {error && <p className="field-msg error" role="alert">{error}</p>}

        <div className="checker-actions">
          <Button type="submit" size="lg" icon={ScanLine} loading={busy}>{busy ? 'Checking…' : 'Check wallet'} {!busy && <ArrowRight size={16} />}</Button>
          {phase === 'idle' && (
            <button type="button" className="link-btn" onClick={() => setValue(sampleAddress)}><Sparkles size={14} /> Try an example</button>
          )}
          {phase === 'done' && <Button type="button" variant="ghost" icon={RotateCcw} onClick={() => { reset(); setValue(''); }}>Check another wallet</Button>}
        </div>
      </form>

      <AnimatePresence mode="wait">
        {busy && (
          <motion.div key="scan" className="scan-stage" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} aria-live="polite">
            <Radar words={WORDS} />
            <ol className="scan-steps">
              {STEPS.map((s, i) => (
                <li key={s} className={i < step ? 'done' : i === step ? 'current' : ''}>
                  <span className="scan-step-dot">{i < step && <Check size={11} />}</span>{s}
                </li>
              ))}
            </ol>
          </motion.div>
        )}
        {phase === 'done' && result && (
          <motion.div key="result" ref={resultRef} tabIndex={-1} className="verdict-wrap" aria-live="polite"
            initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 170, damping: 22 }}>
            <Verdict result={result} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
