// Wallet linkage: finds the addresses a wallet has transacted with, using the Arc explorer
// (Blockscout v2 API, CORS-enabled), so risk can propagate from a reported wallet to the
// wallets connected to it.
import { EXPLORER } from '../chain';

const PAGE_TIMEOUT = 15000;

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(PAGE_TIMEOUT), headers: { accept: 'application/json' } });
  if (res.status === 404) return { items: [] }; // address never seen onchain
  if (!res.ok) throw new Error(`Explorer unavailable (HTTP ${res.status})`);
  return res.json();
}

/**
 * Counterparties of `address` from its most recent transactions and token transfers.
 * Returns Map<lowercaseAddress, { address, txs: Set<hash>, isContract }>.
 */
export async function fetchCounterparties(address) {
  const self = address.toLowerCase();
  const base = `${EXPLORER}/api/v2/addresses/${address}`;
  const [txs, transfers] = await Promise.all([
    getJson(`${base}/transactions`),
    getJson(`${base}/token-transfers`).catch(() => ({ items: [] })),
  ]);
  const out = new Map();
  const add = (party, hash) => {
    const a = party?.hash;
    if (!a || a.toLowerCase() === self) return;
    const key = a.toLowerCase();
    if (!out.has(key)) out.set(key, { address: a, txs: new Set(), isContract: Boolean(party.is_contract) });
    if (hash) out.get(key).txs.add(hash);
  };
  for (const t of txs.items || []) { add(t.from, t.hash); add(t.to, t.hash); }
  for (const t of transfers.items || []) { add(t.from, t.transaction_hash); add(t.to, t.transaction_hash); }
  return out;
}

/**
 * Builds the set of flagged wallets from registry rows: every subject with a confirmed or
 * still-open report. Rejected-only subjects are not flagged.
 * Returns Map<lowercaseAddress, 'Confirmed' | 'Open'>.
 */
export function flaggedWallets(rows, extra = []) {
  const flagged = new Map();
  for (const r of rows || []) {
    const key = r.address.toLowerCase();
    if (r.status === 'Confirmed') flagged.set(key, 'Confirmed');
    else if ((r.status === 'Pending' || r.status === 'Challenged') && flagged.get(key) !== 'Confirmed') flagged.set(key, 'Open');
  }
  for (const a of extra) flagged.set(a.toLowerCase(), 'Confirmed');
  return flagged;
}

// Counterparties of flagged wallets, cached for the session (they are re-read at most every 5 minutes).
const partyCache = new Map();
const CACHE_MS = 5 * 60 * 1000;
const MAX_REVERSE = 30;

async function cachedCounterparties(address) {
  const key = address.toLowerCase();
  const hit = partyCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
  const promise = fetchCounterparties(address);
  partyCache.set(key, { at: Date.now(), promise });
  promise.catch(() => partyCache.delete(key));
  return promise;
}

/**
 * Links between `address` and flagged wallets, checked in both directions so a busy
 * wallet whose own recent history no longer shows the link is still caught.
 * - `links`: flagged wallets this address has transacted with (it inherits their spam status).
 * - `connected`: when `address` itself is flagged, the wallets it has transacted with
 *   (they are marked spam by association).
 */
export async function linkedRisk(address, flagged) {
  const self = address.toLowerCase();
  const parties = await cachedCounterparties(address);
  const links = new Map();
  const connected = [];
  for (const [key, p] of parties) {
    if (flagged.has(key)) links.set(key, { ...p, txs: [...p.txs], status: flagged.get(key) });
    else if (!p.isContract) connected.push({ ...p, txs: [...p.txs] });
  }
  // Reverse direction: does any flagged wallet's history contain this address?
  const others = [...flagged.keys()].filter((k) => k !== self && !links.has(k)).slice(0, MAX_REVERSE);
  const histories = await Promise.allSettled(others.map((k) => cachedCounterparties(k)));
  histories.forEach((h, i) => {
    const hit = h.status === 'fulfilled' && h.value.get(self);
    if (!hit) return;
    const key = others[i];
    links.set(key, { address: key, txs: [...hit.txs], isContract: false, status: flagged.get(key) });
  });
  return { links: [...links.values()], connected };
}
