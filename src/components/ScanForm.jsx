import React, { useState } from 'react';
import { ArrowRight, ShieldAlert, ShieldQuestion, ShieldX, ShieldCheck, Search, Sparkles } from 'lucide-react';
import { sampleAddress } from '../risk';
import { screenAddress } from '../lib/screen';
import { isEvmAddress } from '../lib/format';
import { useRegistry } from '../state/registry';
import { Address, Button, StatusBadge } from './ui';

const TONE_ICON = { danger: ShieldX, warning: ShieldAlert, info: ShieldCheck, neutral: ShieldQuestion };

export function ScanResult({ result, address, compact }) {
  const Icon = TONE_ICON[result.tone];
  return (
    <div className={`result result-${result.tone}`}>
      <div className="result-head">
        <span className="result-icon"><Icon size={22} /></span>
        <div>
          <div className="result-level">{result.level}{result.demo && <span className="tag">DEMO FIXTURE</span>}</div>
          <code className="muted">{address}</code>
        </div>
        {result.score !== null && (
          <div className="score" style={{ '--p': result.score }}>
            <span>{result.score}</span><small>/100</small>
          </div>
        )}
      </div>
      <ul className="result-reasons">{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      {!compact && result.matches.length > 0 && (
        <div className="result-matches">
          <div className="muted small">Matching registry records</div>
          {result.matches.map((m) => (
            <a key={m.id} className="match" href={`#/registry?id=${m.id}`}>
              <span>Report #{m.id}</span><StatusBadge status={m.status} /><span className="muted">by</span><Address value={m.reporter} link={false} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function ScanForm({ compact, initial = '' }) {
  const reg = useRegistry();
  const [address, setAddress] = useState(initial);
  const [result, setResult] = useState(null);
  const [scanned, setScanned] = useState('');
  const [error, setError] = useState('');

  function run(target) {
    const value = target.trim();
    if (!isEvmAddress(value)) {
      setError('Enter a valid 42-character EVM address (0x followed by 40 hex characters).');
      setResult(null);
      return;
    }
    setError('');
    setScanned(value);
    setResult(screenAddress(value, reg.rows, reg.available));
  }

  return (
    <div className="scan">
      <form className="scan-form" onSubmit={(e) => { e.preventDefault(); run(address); }}>
        <div className={`scan-input ${error ? 'invalid' : ''}`}>
          <Search size={18} />
          <input
            aria-label="Wallet or contract address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Paste a wallet or contract address · 0x…"
            spellCheck={false}
            autoComplete="off"
          />
          <Button type="submit" loading={reg.loading}>Scan <ArrowRight size={15} /></Button>
        </div>
        {error && <p className="field-msg error">{error}</p>}
      </form>
      <div className="scan-meta">
        <button type="button" className="link-btn" onClick={() => { setAddress(sampleAddress); run(sampleAddress); }}>
          <Sparkles size={13} /> Try a demo threat
        </button>
        <span className="muted small">
          {reg.available ? `Checks ${reg.rows.length} onchain record${reg.rows.length === 1 ? '' : 's'} + local fixtures` : reg.loading ? 'Loading registry…' : 'Registry offline · local fixtures only'}
        </span>
      </div>
      {result && <ScanResult result={result} address={scanned} compact={compact} />}
    </div>
  );
}
