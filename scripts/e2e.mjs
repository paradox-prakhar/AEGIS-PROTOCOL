// First complete report flow: Arkiv entity -> Arc submit (with stake) -> read both back -> cross-check.
// Usage:  PRIVATE_KEY=0x… REGISTRY=0x… SUBJECT=0x… node scripts/e2e.mjs
//   needs: tGLM on Arkiv Rabdi, test USDC on Arc, optional ARKIV_ACCESS_KEY and ARC_RPC_URL.
//   --arc-only runs just the Arc half (used against the local chain; no Arkiv writes).
// Uses a throwaway testnet key from the environment; it is never printed.
import fs from 'node:fs';
import { Contract, JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from 'ethers';
import { crossCheck } from '../src/risk.js';

const arcOnly = process.argv.includes('--arc-only');
const { PRIVATE_KEY, REGISTRY, SUBJECT } = process.env;
if (!/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY || '')) throw new Error('Set PRIVATE_KEY to a throwaway testnet key.');
if (!/^0x[0-9a-fA-F]{40}$/.test(REGISTRY || '') || !/^0x[0-9a-fA-F]{40}$/.test(SUBJECT || '')) throw new Error('Set REGISTRY and SUBJECT to 0x addresses.');

const artifact = JSON.parse(fs.readFileSync(new URL('../src/registry-artifact.json', import.meta.url)));
const provider = new JsonRpcProvider(process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.io');
const wallet = new Wallet(PRIVATE_KEY, provider);
const step = (n, msg) => console.log(`[${n}] ${msg}`);
const evidence = `Aegis e2e evidence ${new Date().toISOString()} ${Math.random()}`;
const evidenceHash = keccak256(toUtf8Bytes(evidence));
let failed = false;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failed = true; };

try {
  const registry = new Contract(REGISTRY, artifact.abi, wallet);
  if (Number(await registry.VERSION()) !== 2) throw new Error('REGISTRY is not a v2 registry.');
  let entityKey, arkiv;
  if (arcOnly) {
    entityKey = keccak256(toUtf8Bytes(`local-entity-${evidenceHash}`));
    step(1, `Arkiv skipped (--arc-only); using placeholder entity key ${entityKey.slice(0, 12)}…`);
  } else {
    arkiv = await import('../src/arkiv.js');
    const { createWalletClient } = await import('@arkiv-network/sdk');
    const { ExpirationTime } = await import('@arkiv-network/sdk');
    const { addr, key, u256 } = await import('@arkiv-network/sdk/schema');
    const { http } = await import('viem');
    const { privateKeyToAccount } = await import('viem/accounts');
    const client = createWalletClient({ chain: arkiv.arkivChain, transport: http(), account: privateKeyToAccount(PRIVATE_KEY) });
    step(1, 'Writing report entity to Arkiv (Rabdi)…');
    const made = await client.createEntity(arkiv.AegisReports, { subject: addr(SUBJECT), chainId: u256(5042002n), category: 'OTHER', reporter: addr(wallet.address), evidenceHash: key(evidenceHash), description: 'Aegis end-to-end test report' }, { expiration: ExpirationTime.fromDays(1) });
    entityKey = made.entityKey;
    step(1, `Arkiv entity ${entityKey} (tx ${made.txHash})`);
  }

  step(2, 'Submitting to Arc with stake…');
  const stake = await registry.minStake();
  const tx = await registry.submit(SUBJECT, evidenceHash, '', entityKey, { value: stake });
  const receipt = await tx.wait(1);
  const id = Number(registry.interface.parseLog(receipt.logs.find((l) => l.address.toLowerCase() === REGISTRY.toLowerCase())).args.id);
  step(2, `Arc report #${id} (tx ${tx.hash})`);

  step(3, 'Reading both networks back and cross-checking…');
  const row = await registry.reports(id);
  const arcRow = { reporter: row.reporter, address: row.subject, evidenceHash: row.evidenceHash, arkivEntityKey: row.arkivEntityKey, status: 'Pending' };
  check(row.stake === stake, 'stake locked on Arc');
  check(row.arkivEntityKey === entityKey, 'Arc stores the Arkiv entity key');
  const entities = arcOnly ? [{ entityKey, subject: SUBJECT, reporter: wallet.address, evidenceHash }] : await arkiv.fetchArkivReports(SUBJECT);
  const { linked } = crossCheck(entities, [arcRow]);
  check(linked.some((e) => e.entityKey.toLowerCase() === entityKey.toLowerCase()), 'Arkiv entity is verified by the Arc report');
  console.log(failed ? 'E2E FAILED' : 'E2E PASSED');
  process.exitCode = failed ? 1 : 0;
} finally {
  provider.destroy();
}
