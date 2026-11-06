import React from 'react';
import { Activity, ArrowRight, ArrowUpRight, Clock, Database, FileWarning, Gavel, LifeBuoy, ScanLine, ShieldCheck, ShieldX, Swords } from 'lucide-react';
import { useRegistry } from '../state/registry';
import { useWallet } from '../state/wallet';
import { Address, Button, Card, EmptyState, Stat, StatusBadge } from '../components/ui';
import { ScanForm } from '../components/ScanForm';
import { relativeTime } from '../lib/format';
import { navigate } from '../state/router';

const LIFECYCLE = [
  ['Detect', 'Screen any destination against the shared registry before you sign.', ScanLine, 'scanner'],
  ['Report', 'Hash your evidence and sign an onchain allegation.', FileWarning, 'report'],
  ['Challenge', 'Anyone can dispute a report with counter-evidence.', Swords, 'review'],
  ['Resolve', 'A trusted reviewer adjudicates after a 2-day window.', Gavel, 'review'],
  ['Recover', 'Assemble an exportable incident package for issuers.', LifeBuoy, 'recovery'],
];

export default function Overview() {
  const reg = useRegistry();
  const wallet = useWallet();
  const recent = reg.rows.slice(0, 6);
  const open = reg.counts.Pending + reg.counts.Challenged;

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-tag"><span className={`live-dot ${reg.available ? '' : 'down'}`} /> {reg.available ? 'Registry live on Arc Testnet' : reg.loading ? 'Connecting to Arc Testnet' : 'Registry unreachable'}</span>
          <h1>Know who you're paying<br /><span className="grad">before you sign.</span></h1>
          <p>Aegis is a shared, onchain evidence registry for wallet threats. Screen addresses, publish hashed evidence, dispute allegations, and build recovery records — all signed by your own wallet.</p>
          <div className="hero-actions">
            <Button size="lg" icon={ScanLine} onClick={() => navigate('scanner')}>Scan an address</Button>
            <Button size="lg" variant="ghost" onClick={() => navigate('report')}>Report a threat <ArrowRight size={16} /></Button>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit o1" /><div className="orbit o2" /><div className="orbit o3" />
          <div className="sweep" />
          <div className="hero-shield"><ShieldCheck size={64} strokeWidth={1.2} /></div>
          <span className="blip b1" /><span className="blip b2" /><span className="blip b3" />
        </div>
      </section>

      <div className="stats">
        <Stat label="Onchain reports" value={reg.meta?.count ?? '—'} hint="Total submitted to the registry" icon={Database} loading={reg.loading && !reg.meta} />
        <Stat label="Open allegations" value={reg.available ? open : '—'} hint={`${reg.counts.Challenged} challenged`} icon={Clock} tone={open ? 'warning' : undefined} loading={reg.loading && !reg.meta} />
        <Stat label="Confirmed threats" value={reg.available ? reg.counts.Confirmed : '—'} hint="Adjudicated by reviewer" icon={ShieldX} tone={reg.counts.Confirmed ? 'danger' : undefined} loading={reg.loading && !reg.meta} />
        <Stat label="Rejected" value={reg.available ? reg.counts.Rejected : '—'} hint="Allegations dismissed" icon={ShieldCheck} loading={reg.loading && !reg.meta} />
      </div>

      <div className="grid-2">
        <Card title="Quick security check" subtitle="Screen a recipient before your next transfer or approval.">
          <ScanForm compact />
        </Card>

        <Card
          title="Recent registry activity"
          subtitle="Latest onchain reports"
          action={<a className="link-btn" href="#/registry">View all <ArrowUpRight size={14} /></a>}
          pad={false}
        >
          {recent.length ? (
            <ul className="activity">
              {recent.map((r) => (
                <li key={r.id}>
                  <a href={`#/registry?id=${r.id}`}>
                    <span className="activity-id">#{r.id}</span>
                    <div className="activity-main">
                      <Address value={r.address} link={false} />
                      <small className="muted">{relativeTime(r.createdAt)}</small>
                    </div>
                    <StatusBadge status={r.status} />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Activity} title={reg.error ? 'Registry unavailable' : 'No reports yet'}
              action={!reg.error && <Button variant="secondary" size="sm" onClick={() => navigate('report')}>Submit the first report</Button>}>
              {reg.error || 'The shared registry is live and waiting for its first signed report.'}
            </EmptyState>
          )}
        </Card>
      </div>

      <Card title="The protection lifecycle" subtitle="Every step is transparent, wallet-signed, and verifiable onchain.">
        <div className="lifecycle">
          {LIFECYCLE.map(([title, text, Icon, to], i) => (
            <a key={title} className="lifecycle-step" href={`#/${to}`}>
              <div className="lifecycle-icon"><Icon size={18} /></div>
              <span className="lifecycle-n">0{i + 1}</span>
              <b>{title}</b>
              <p>{text}</p>
            </a>
          ))}
        </div>
      </Card>

      {!wallet.isConnected && (
        <div className="cta-band">
          <div>
            <b>New to Arc Testnet?</b>
            <p className="muted">Connect a MetaMask-compatible wallet and grab free test USDC to pay gas.</p>
          </div>
          <div className="row">
            <a className="btn btn-ghost" href="https://faucet.circle.com/" target="_blank" rel="noreferrer">Circle faucet <ArrowUpRight size={14} /></a>
            <Button onClick={() => wallet.connect().catch(() => {})} loading={wallet.connecting}>Connect wallet</Button>
          </div>
        </div>
      )}
    </>
  );
}
