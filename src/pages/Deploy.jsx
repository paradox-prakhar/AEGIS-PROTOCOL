import React, { useState } from 'react';
import { isAddress } from 'ethers';
import { Rocket, Link2, Wallet } from 'lucide-react';
import { DEFAULT_REVIEWER, configuredRegistry, deployRegistry, expectedDeployer, friendlyError, rememberRegistry } from '../chain';
import { useWallet } from '../state/wallet';
import { useRegistry } from '../state/registry';
import { useToast } from '../state/toast';
import { Address, Button, Callout, Card, Field, PageHeader, TxStatus } from '../components/ui';

export default function Deploy() {
  const wallet = useWallet();
  const reg = useRegistry();
  const toast = useToast();
  const [reviewer, setReviewer] = useState(DEFAULT_REVIEWER);
  const [custom, setCustom] = useState(reg.address);
  const [tx, setTx] = useState({ stage: 'idle', hash: '', error: '' });
  const busy = ['simulating', 'pending'].includes(tx.stage);

  async function deploy() {
    setTx({ stage: 'simulating', hash: '', error: '' });
    try {
      const addr = await deployRegistry(reviewer, (hash) => setTx({ stage: 'pending', hash, error: '' }));
      setTx((t) => ({ ...t, stage: 'confirmed' }));
      const saved = rememberRegistry(addr);
      toast(`Registry deployed at ${addr}. ${saved ? 'Saved in this browser.' : 'Copy this address now.'}`, 'success');
      setCustom(addr);
      reg.setAddress(addr);
    } catch (e) {
      setTx((t) => ({ ...t, stage: 'failed', error: friendlyError(e) }));
    }
  }

  return (
    <>
      <PageHeader eyebrow="Operate" title="Registry deployment"
        description="Aegis works best with one shared registry for all users. You almost never need to deploy a new one." />
      <div className="grid-2">
        <Card title="Active registry" subtitle={configuredRegistry ? 'Configured via deployment metadata / VITE_REGISTRY_ADDRESS' : 'Loaded from this browser'}>
          <dl className="kv">
            <dt>Contract</dt><dd><Address value={reg.address} full /></dd>
            <dt>Reviewer</dt><dd><Address value={reg.meta?.reviewer} full /></dd>
            <dt>Reports</dt><dd>{reg.meta?.count ?? '—'}</dd>
            <dt>Review delay</dt><dd>{reg.meta ? `${reg.meta.reviewDelay / 86400} days` : '—'}</dd>
          </dl>
          <form className="lookup" onSubmit={(e) => { e.preventDefault(); if (isAddress(custom)) reg.setAddress(custom); }}>
            <Field label="Use a different registry (this session)">
              <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="0x…" spellCheck={false} />
            </Field>
            <Button type="submit" variant="secondary" icon={Link2} disabled={!isAddress(custom)}>Load</Button>
          </form>
        </Card>

        <Card title="Deploy a new registry" subtitle="Creates a separate contract with its own immutable reviewer.">
          <Field label="Reviewer address" hint="This key adjudicates every report. Use a reviewed multisig for anything beyond testing.">
            <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="0x…" spellCheck={false} />
          </Field>
          {expectedDeployer && <p className="muted small">Restricted to deployer <Address value={expectedDeployer} /></p>}
          <Callout tone="warning">A new deployment does not share data with the existing registry. To make it the default for everyone, set <code>VITE_REGISTRY_ADDRESS</code> and rebuild.</Callout>
          <div className="form-actions">
            {wallet.isConnected
              ? <Button icon={Rocket} loading={busy} disabled={!isAddress(reviewer)} onClick={deploy}>Deploy with wallet</Button>
              : <Button icon={Wallet} onClick={() => wallet.connect().catch(() => {})}>Connect wallet</Button>}
          </div>
          <TxStatus tx={tx} />
        </Card>
      </div>
    </>
  );
}
