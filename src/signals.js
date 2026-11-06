// Transaction simulation, fund tracing and threat-feed signals. Everything takes its I/O as arguments
// (a provider, a fetch function, a status lookup) so it is testable offline and swappable per deployment.
import { Interface, MaxUint256, getAddress, id as topicId, isAddress, zeroPadValue } from 'ethers';

const HALF_MAX = MaxUint256 / 2n; // an allowance this large is "unlimited" in practice
const erc20 = new Interface([
  'function approve(address spender, uint256 amount)',
  'function increaseAllowance(address spender, uint256 added)',
  'function setApprovalForAll(address operator, bool approved)',
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function transfer(address to, uint256 amount)',
  'function transferFrom(address from, address to, uint256 amount)',
]);
export const TRANSFER_TOPIC = topicId('Transfer(address,address,uint256)');

/** Static analysis of calldata. Returns findings with a stable `code`, so scoring never double counts. */
export function analyzeCalldata(data = '0x', { to, value = 0n } = {}) {
  const findings = [];
  if (data && data !== '0x') {
    let parsed;
    try { parsed = erc20.parseTransaction({ data }); } catch { parsed = null; }
    if (parsed) {
      const a = parsed.args;
      if (parsed.name === 'approve' || parsed.name === 'increaseAllowance') {
        if (a[1] >= HALF_MAX) findings.push({ code: 'UNLIMITED_APPROVAL', severity: 'high', spender: a[0], text: `Grants ${getAddress(a[0])} an unlimited token allowance.` });
        else if (a[1] > 0n) findings.push({ code: 'TOKEN_APPROVAL', severity: 'info', spender: a[0], text: `Approves ${getAddress(a[0])} to spend tokens.` });
      } else if (parsed.name === 'setApprovalForAll' && a[1]) {
        findings.push({ code: 'APPROVAL_FOR_ALL', severity: 'high', spender: a[0], text: `Gives ${getAddress(a[0])} control of every token in this collection.` });
      } else if (parsed.name === 'permit') {
        findings.push({ code: 'PERMIT', severity: 'medium', spender: a[1], text: `Signed permit lets ${getAddress(a[1])} spend tokens without another transaction.` });
      }
    }
  }
  if (value > 0n && (!data || data === '0x')) findings.push({ code: 'NATIVE_TRANSFER', severity: 'info', text: 'Sends native USDC directly to the destination.', to });
  return findings;
}

/** ERC-20 Transfer logs (from a simulation or a receipt) that move tokens out of `account`. */
export function outgoingTransfers(logs = [], account) {
  const me = account.toLowerCase();
  const out = [];
  for (const l of logs) {
    if (l.topics?.[0] !== TRANSFER_TOPIC || l.topics.length !== 3) continue;
    const from = '0x' + l.topics[1].slice(26).toLowerCase();
    if (from !== me) continue;
    out.push({ token: l.address, to: getAddress('0x' + l.topics[2].slice(26)), amount: BigInt(l.data) });
  }
  return out;
}

/**
 * Simulates a transaction before signing. Always runs calldata analysis, eth_call and gas estimation.
 * If the RPC supports eth_simulateV1 it also lists token transfers out of the sender; otherwise it says so.
 * `isFlagged(address)` decides whether a recipient is known-bad (registry or feed).
 */
export async function simulateTransaction(provider, tx, { isFlagged = async () => false } = {}) {
  if (!isAddress(tx.to) || !isAddress(tx.from)) throw new Error('Enter valid sender and destination addresses.');
  const value = BigInt(tx.value ?? 0);
  const data = tx.data || '0x';
  const result = { willRevert: false, revertReason: null, gas: null, destinationIsContract: false, assetChangesChecked: false, transfers: [], findings: analyzeCalldata(data, { to: tx.to, value }), notes: [] };
  result.destinationIsContract = (await provider.getCode(tx.to)) !== '0x';
  if (data !== '0x' && !result.destinationIsContract) result.findings.push({ code: 'CALLDATA_TO_EOA', severity: 'medium', text: 'Calldata is being sent to an address with no contract code.' });
  try {
    await provider.call({ from: tx.from, to: tx.to, data, value });
    result.gas = await provider.estimateGas({ from: tx.from, to: tx.to, data, value });
  } catch (e) {
    result.willRevert = true;
    result.revertReason = e?.reason || e?.shortMessage || 'Execution reverted';
    result.findings.push({ code: 'WILL_REVERT', severity: 'medium', text: `This transaction is expected to fail: ${result.revertReason}.` });
  }
  if (!result.willRevert) {
    try {
      const sim = await provider.send('eth_simulateV1', [{ blockStateCalls: [{ calls: [{ from: tx.from, to: tx.to, data, value: '0x' + value.toString(16) }] }], traceTransfers: true }, 'latest']);
      const logs = sim?.[0]?.calls?.[0]?.logs ?? [];
      result.assetChangesChecked = true;
      result.transfers = outgoingTransfers(logs, tx.from);
      for (const t of result.transfers) {
        if (await isFlagged(t.to)) result.findings.push({ code: 'DRAIN_TO_FLAGGED', severity: 'critical', text: `Moves tokens from you to ${t.to}, a flagged address.` });
      }
    } catch { result.notes.push('Asset-change simulation is not supported by this RPC. Only calldata and call checks ran.'); }
  }
  return result;
}

/**
 * One-hop fund tracing over ERC-20 Transfer logs in the most recent `blocks`. `statusOf(address)` returns
 * { confirmed, open } from the registry. Scans in chunks; stops at `maxCounterparties` lookups or `deadline`.
 */
export async function traceFunds(provider, address, statusOf, { blocks = 20000, chunk = 5000, maxCounterparties = 10, deadline = Date.now() + 8000 } = {}) {
  const head = await provider.getBlockNumber();
  const start = Math.max(0, head - blocks);
  const padded = zeroPadValue(address, 32);
  const seen = new Map();
  let truncated = false;
  for (let from = start; from <= head && !truncated; from += chunk) {
    const to = Math.min(head, from + chunk - 1);
    for (const [direction, topics] of [['in', [TRANSFER_TOPIC, null, padded]], ['out', [TRANSFER_TOPIC, padded]]]) {
      if (Date.now() > deadline) { truncated = true; break; }
      let logs = [];
      try { logs = await provider.getLogs({ fromBlock: from, toBlock: to, topics }); } catch { truncated = true; break; }
      for (const l of logs) {
        const other = '0x' + l.topics[direction === 'in' ? 1 : 2].slice(26).toLowerCase();
        if (other !== address.toLowerCase() && !seen.has(other)) seen.set(other, direction);
      }
    }
  }
  const hits = [];
  const targets = [...seen.entries()].slice(0, maxCounterparties);
  if (seen.size > maxCounterparties) truncated = true;
  for (const [counterparty, direction] of targets) {
    const s = await statusOf(getAddress(counterparty));
    if (s.confirmed || s.open) hits.push({ counterparty: getAddress(counterparty), direction, confirmed: s.confirmed > 0 });
  }
  return { hits, counterparties: seen.size, scanned: { fromBlock: start, toBlock: head }, truncated };
}

// ---------------------------------------------------------------------------
// Threat feeds. A feed is { name, url }. A url containing {address} is queried per address; otherwise it is a list.
// Aegis feed format:  per-address  { "address": "0x…", "flagged": true, "category"?: "…", "confidence"?: 0..1, "reference"?: "https://…" }
//                     list         { "flags": [ same objects ] }
// Put any provider behind a small adapter that returns this shape. Origins must be allowed in the CSP connect-src.
// ---------------------------------------------------------------------------

export function parseFeeds(raw) {
  if (!raw) return [];
  let list;
  try { list = JSON.parse(raw); } catch { throw new Error('VITE_THREAT_FEEDS must be valid JSON.'); }
  if (!Array.isArray(list)) throw new Error('VITE_THREAT_FEEDS must be a JSON array.');
  return list.filter((f) => f && typeof f.name === 'string' && /^https:\/\//.test(f.url ?? ''));
}

const validFlag = (f, address) => f && typeof f === 'object' && typeof f.address === 'string' && f.address.toLowerCase() === address.toLowerCase() && f.flagged === true;

export async function queryFeeds(address, feeds, { fetchFn = globalThis.fetch, timeoutMs = 5000 } = {}) {
  if (!isAddress(address)) throw new Error('Enter a valid address.');
  const hits = [];
  const errors = [];
  await Promise.all(feeds.map(async (feed) => {
    const url = feed.url.includes('{address}') ? feed.url.replace('{address}', address) : feed.url;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const flags = Array.isArray(body?.flags) ? body.flags : [body];
      const flag = flags.find((f) => validFlag(f, address));
      if (flag) hits.push({ source: feed.name, category: typeof flag.category === 'string' ? flag.category.slice(0, 60) : null, confidence: Math.min(1, Math.max(0, Number(flag.confidence ?? 0.5))), reference: typeof flag.reference === 'string' && /^https:\/\//.test(flag.reference) ? flag.reference : null });
    } catch (e) {
      errors.push({ source: feed.name, error: e?.name === 'AbortError' ? 'timeout' : e?.message || 'failed' });
    } finally { clearTimeout(timer); }
  }));
  return { hits, errors, checked: feeds.length };
}
