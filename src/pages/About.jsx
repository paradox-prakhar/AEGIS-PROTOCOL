import React from 'react';
import { Boxes, Cpu, FileLock2, Gavel, HardDrive, Network, Scale, ShieldAlert } from 'lucide-react';
import { CHAIN_ID, EXPLORER, RPC, deployment } from '../chain';
import { Address, Callout, Card, PageHeader } from '../components/ui';

const LAYERS = [
  [Cpu, 'Interface', 'React workspace with wallet-aware forms, simulation-before-sign and explicit demo states.'],
  [Network, 'Wallet & RPC', 'Injected EIP-1193 wallet for signatures; public Arc RPC for reads and receipt polling.'],
  [Boxes, 'AegisRegistry contract', 'Stores reporter, subject, evidence hash, timestamp and status. Emits Submitted, Challenge and Resolved events.'],
  [FileLock2, 'Evidence commitments', 'Only a Keccak-256 hash is published. The full evidence package stays with the reporter and can be verified against the hash.'],
  [HardDrive, 'Local workspace', 'Recovery incidents and submitted packages persist only in this browser and export as JSON.'],
];

const TRUST = [
  [Scale, 'Reports are allegations', 'Anyone can submit a report. It is a public claim, not proof of fraud.'],
  [Gavel, 'Trusted reviewer', 'A single immutable reviewer confirms or rejects after a two-day window. This is not decentralized governance.'],
  [ShieldAlert, 'No safety verdicts', 'Absence of reports never means an address is safe. Read failures surface as errors, never as clean results.'],
];

const LIMITS = [
  'Reads cover the latest 100 reports — no paginated indexer yet.',
  'Challenges carry no economic stake.',
  'No token-transfer simulation or external threat-intel feeds.',
  'No IPFS or durable encrypted evidence storage.',
  'Contract has not been independently audited. Testnet only.',
];

export default function About() {
  return (
    <>
      <PageHeader eyebrow="Transparency" title="Trust & architecture" description="What Aegis does, what it trusts, and what it deliberately does not claim." />
      <div className="grid-2">
        <Card title="System layers">
          <ul className="feature-list">
            {LAYERS.map(([Icon, t, d]) => <li key={t}><span className="feature-icon"><Icon size={17} /></span><div><b>{t}</b><p className="muted">{d}</p></div></li>)}
          </ul>
        </Card>
        <div className="stack">
          <Card title="Trust model">
            <ul className="feature-list">
              {TRUST.map(([Icon, t, d]) => <li key={t}><span className="feature-icon"><Icon size={17} /></span><div><b>{t}</b><p className="muted">{d}</p></div></li>)}
            </ul>
          </Card>
          <Card title="Known limitations">
            <ul className="bullets">{LIMITS.map((l) => <li key={l}>{l}</li>)}</ul>
          </Card>
        </div>
      </div>
      <Card title="Network & deployment">
        <dl className="kv kv-cols">
          <dt>Chain ID</dt><dd><code>{CHAIN_ID}</code></dd>
          <dt>RPC</dt><dd><code>{RPC}</code></dd>
          <dt>Explorer</dt><dd><a className="link-btn" href={EXPLORER} target="_blank" rel="noreferrer">{EXPLORER}</a></dd>
          <dt>Registry</dt><dd><Address value={deployment.registryAddress} full /></dd>
          <dt>Deploy tx</dt><dd><Address value={deployment.transactionHash} tx /></dd>
          <dt>Deployer</dt><dd><Address value={deployment.deployer} /></dd>
          <dt>Reviewer</dt><dd><Address value={deployment.reviewer} /></dd>
          <dt>Block</dt><dd><code>#{deployment.blockNumber.toLocaleString()}</code></dd>
          <dt>Deploy fee</dt><dd>{deployment.feeUSDC} USDC</dd>
          <dt>Bytecode check</dt><dd>{deployment.bytecodeAndConstructorVerified ? 'Creation bytecode & constructor verified against this repo' : 'Not verified'}</dd>
        </dl>
      </Card>
      <Callout tone="warning" title="Not a production security service">
        Before mainnet: independent audit, adversarial testing, reviewer key rotation, abuse controls, encrypted evidence storage and monitoring are all required.
      </Callout>
    </>
  );
}
