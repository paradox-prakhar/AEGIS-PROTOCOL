import React, { useEffect, useMemo, useState } from 'react';
import { Database, RefreshCw, Search, Swords, X, ExternalLink } from 'lucide-react';
import { useRegistry } from '../state/registry';
import { READ_WINDOW, explorerAddress } from '../chain';
import { Address, Button, Callout, Card, EmptyState, PageHeader, StatusBadge, Tabs } from '../components/ui';
import { EvidenceVerifier } from '../components/EvidenceVerifier';
import { duration, formatDate, relativeTime } from '../lib/format';
import { navigate } from '../state/router';

function Detail({ report, meta, onClose }) {
  const now = Date.now() / 1000;
  const opensAt = report.createdAt + (meta?.reviewDelay || 0);
  const open = report.status === 'Pending' || report.status === 'Challenged';
  return (
    <>
      <div className="scrim show" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`Report ${report.id}`}>
        <header className="drawer-head">
          <div>
            <div className="eyebrow">Report #{report.id}</div>
            <h3>Registry record</h3>
          </div>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="drawer-body">
          <div className="row between"><StatusBadge status={report.status} /><span className="muted small">{relativeTime(report.createdAt)}</span></div>
          <dl className="kv">
            <dt>Subject</dt><dd><Address value={report.address} full /></dd>
            <dt>Reporter</dt><dd><Address value={report.reporter} full /></dd>
            <dt>Evidence hash</dt><dd><code className="break">{report.evidenceHash}</code></dd>
            <dt>Submitted</dt><dd>{formatDate(report.createdAt)}</dd>
            <dt>Review window</dt>
            <dd>{!open ? 'Closed — resolved' : now >= opensAt ? 'Open — reviewer may resolve' : `Opens in ${duration(opensAt - now)} (${formatDate(opensAt)})`}</dd>
          </dl>
          {open && (
            <div className="row">
              <Button variant="secondary" icon={Swords} onClick={() => navigate('review', { id: report.id })}>Challenge or resolve</Button>
              <a className="btn btn-ghost" href={explorerAddress(report.address)} target="_blank" rel="noreferrer"><ExternalLink size={15} />Subject on explorer</a>
            </div>
          )}
          <EvidenceVerifier expected={report.evidenceHash} />
        </div>
      </aside>
    </>
  );
}

export default function Registry({ params }) {
  const reg = useRegistry();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (params.id !== undefined) setSelected(Number(params.id));
  }, [params.id]);

  const rows = useMemo(() => reg.rows.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    const q = query.trim().toLowerCase();
    return !q || r.address.toLowerCase().includes(q) || r.reporter.toLowerCase().includes(q) || String(r.id) === q;
  }), [reg.rows, filter, query]);

  const report = reg.rows.find((r) => r.id === selected);
  const close = () => { setSelected(null); if (params.id !== undefined) navigate('registry'); };

  return (
    <>
      <PageHeader
        eyebrow="Shared intelligence"
        title="Threat registry"
        description="Every report, challenge and resolution recorded in the shared Arc Testnet registry contract."
        actions={<Button variant="secondary" icon={RefreshCw} loading={reg.loading} onClick={() => reg.refresh()}>Refresh</Button>}
      />
      {reg.error && <Callout tone="danger" title="Could not read the registry">{reg.error}</Callout>}
      {reg.meta && reg.meta.count > READ_WINDOW && (
        <Callout tone="warning">Showing the latest {READ_WINDOW} of {reg.meta.count} reports. Older records are not indexed by this interface.</Callout>
      )}
      <Card pad={false}>
        <div className="toolbar">
          <Tabs value={filter} onChange={setFilter} items={[
            ['all', 'All', reg.rows.length],
            ['Pending', 'Pending', reg.counts.Pending],
            ['Challenged', 'Challenged', reg.counts.Challenged],
            ['Confirmed', 'Confirmed', reg.counts.Confirmed],
            ['Rejected', 'Rejected', reg.counts.Rejected],
          ]} />
          <div className="search">
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search address, reporter or ID" aria-label="Search registry" />
          </div>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>ID</th><th>Subject</th><th>Status</th><th>Reporter</th><th>Evidence hash</th><th>Submitted</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => setSelected(r.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelected(r.id)}>
                    <td className="num">#{r.id}</td>
                    <td><Address value={r.address} /></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td><Address value={r.reporter} link={false} /></td>
                    <td><code className="muted">{r.evidenceHash.slice(0, 10)}…{r.evidenceHash.slice(-6)}</code></td>
                    <td className="muted nowrap">{relativeTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Database} title={reg.loading ? 'Loading records…' : reg.rows.length ? 'No matching records' : 'The registry is empty'}
            action={!reg.loading && !reg.rows.length && !reg.error && <Button size="sm" onClick={() => navigate('report')}>Submit a report</Button>}>
            {reg.rows.length ? 'Try a different filter or search term.' : !reg.loading && 'No reports have been submitted to this registry yet.'}
          </EmptyState>
        )}
      </Card>
      <p className="muted small registry-addr">Registry contract: {reg.address ? <Address value={reg.address} full /> : 'not configured'}</p>
      {report && <Detail report={report} meta={reg.meta} onClose={close} />}
    </>
  );
}
