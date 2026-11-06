import React, { useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Info, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { explorerAddress, explorerTx } from '../chain';
import { shortAddress } from '../lib/format';

export function Button({ variant = 'primary', size, icon: Icon, loading, children, className = '', ...props }) {
  return (
    <button className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <Loader2 size={16} className="spin" /> : Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

export function Card({ title, subtitle, action, children, className = '', pad = true }) {
  return (
    <section className={`card ${pad ? '' : 'card-flush'} ${className}`}>
      {(title || action) && (
        <header className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

const STATUS_TONE = { Pending: 'warning', Challenged: 'info', Confirmed: 'danger', Rejected: 'neutral' };
export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONE[status] || 'neutral'} dot>{status}</Badge>;
}

export function Badge({ tone = 'neutral', dot, children }) {
  return <span className={`badge badge-${tone}`}>{dot && <i />}{children}</span>;
}

export function CopyButton({ value, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); });
      }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export function Address({ value, full, tx, link = true }) {
  if (!value) return <span className="muted">—</span>;
  const href = tx ? explorerTx(value) : explorerAddress(value);
  return (
    <span className="address">
      <code title={value}>{full ? value : shortAddress(value, 8, 6)}</code>
      <CopyButton value={value} label={tx ? 'Copy hash' : 'Copy address'} />
      {link && (
        <a className="icon-btn" href={href} target="_blank" rel="noreferrer" aria-label="Open in explorer" title="Open in explorer" onClick={(e) => e.stopPropagation()}>
          <ExternalLink size={14} />
        </a>
      )}
    </span>
  );
}

const CALLOUT_ICON = { info: Info, warning: AlertTriangle, danger: ShieldAlert, success: CheckCircle2 };
export function Callout({ tone = 'info', title, children, action }) {
  const Icon = CALLOUT_ICON[tone] || Info;
  return (
    <div className={`callout callout-${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon size={18} />
      <div>
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
      {action}
    </div>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <label className={`field ${error ? 'field-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-msg error">{error}</span> : hint && <span className="field-msg">{hint}</span>}
    </label>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && <div className="empty-icon"><Icon size={26} /></div>}
      <h4>{title}</h4>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone, loading }) {
  return (
    <article className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <div className="stat-top"><span>{label}</span>{Icon && <Icon size={16} />}</div>
      <strong>{loading ? <span className="skeleton" style={{ width: 48 }} /> : value}</strong>
      {hint && <p>{hint}</p>}
    </article>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

const STAGES = [
  ['simulating', 'Simulate'],
  ['signing', 'Sign'],
  ['pending', 'Confirm'],
  ['confirmed', 'Done'],
];
export function TxStatus({ tx }) {
  if (tx.stage === 'idle') return null;
  const idx = STAGES.findIndex(([s]) => s === tx.stage);
  const failed = tx.stage === 'failed';
  const label = {
    simulating: 'Simulating with eth_call…',
    signing: 'Waiting for your signature in the wallet…',
    pending: 'Submitted. Waiting for confirmation…',
    confirmed: 'Confirmed on Arc Testnet.',
    failed: tx.error,
  }[tx.stage];
  return (
    <div className={`txstatus ${failed ? 'txstatus-failed' : ''} ${tx.stage === 'confirmed' ? 'txstatus-ok' : ''}`} aria-live="polite">
      {!failed && (
        <ol className="txsteps">
          {STAGES.map(([s, name], i) => (
            <li key={s} className={i < idx || tx.stage === 'confirmed' ? 'done' : i === idx ? 'current' : ''}>
              <span>{i < idx || tx.stage === 'confirmed' ? <Check size={12} /> : i + 1}</span>{name}
            </li>
          ))}
        </ol>
      )}
      <div className="txstatus-msg">
        {failed ? <XCircle size={16} /> : tx.stage === 'confirmed' ? <CheckCircle2 size={16} /> : <Loader2 size={16} className="spin" />}
        <span>{label}</span>
      </div>
      {tx.hash && <div className="txstatus-hash"><span className="muted">Transaction</span><Address value={tx.hash} tx /></div>}
    </div>
  );
}

export function Tabs({ value, onChange, items }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(([key, label, count]) => (
        <button key={key} role="tab" aria-selected={value === key} className={value === key ? 'active' : ''} onClick={() => onChange(key)}>
          {label}{count !== undefined && <span className="tab-count">{count}</span>}
        </button>
      ))}
    </div>
  );
}
