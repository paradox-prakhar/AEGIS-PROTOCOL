// Chain access layer. Supports the deployed v1 registry and the hardened v2 registry.
import { BrowserProvider, Contract, ContractFactory, Interface, JsonRpcProvider, isAddress, keccak256, toUtf8Bytes } from 'ethers';
import artifact from './registry-artifact.json';
import v1Artifact from './registry-v1-artifact.json';
import deployment from './deployment.json';

const env = import.meta.env || {};
export const CHAIN_ID = 5042002;
const CHAIN_HEX = '0x' + CHAIN_ID.toString(16);
export const RPC = env.VITE_ARC_RPC_URL || 'https://rpc.testnet.arc.io';
export const EXPLORER = (env.VITE_ARC_EXPLORER_URL || 'https://explorer.testnet.arc.io').replace(/\/$/, '');
export const configuredRegistry = env.VITE_REGISTRY_ADDRESS || deployment.registryAddress || '';
export const expectedDeployer = env.VITE_DEPLOYER_ADDRESS || '';
export const defaultReviewer = env.VITE_DEFAULT_REVIEWER || deployment.reviewer || '';
export const STATUS = ['Pending', 'Challenged', 'Confirmed', 'Rejected'];
export const PAGE_SIZE = 25;
const STORAGE_KEY = `aegis-registry-${CHAIN_ID}`;

if (configuredRegistry && !isAddress(configuredRegistry)) console.error('VITE_REGISTRY_ADDRESS is not a valid address.');

export const txUrl = (hash) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (a) => `${EXPLORER}/address/${a}`;
export const evidenceHash = (text) => keccak256(toUtf8Bytes(text));

export function activeRegistry() {
  if (configuredRegistry) return configuredRegistry;
  try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
}

export function rememberRegistry(address) {
  try { localStorage.setItem(STORAGE_KEY, address); return true; } catch { return false; }
}

// The public Arc RPC rate-limits bursts (JSON-RPC -32005 / HTTP 429). ethers surfaces a rate-limited
// eth_call as CALL_EXCEPTION "missing revert data", which is indistinguishable from a real revert
// unless we inspect the raw RPC error, so detect it explicitly and retry with backoff.
const RATE_LIMIT_CODES = new Set([-32005, 429]);
const rateLimitedRpcError = (err) => !!err && (RATE_LIMIT_CODES.has(Number(err.code)) || /rate limit|too many requests/i.test(String(err.message || '')));
export function isRateLimited(e) {
  return rateLimitedRpcError(e?.info?.error) || rateLimitedRpcError(e?.error) || /429/.test(String(e?.info?.responseStatus || ''));
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ArcReadProvider extends JsonRpcProvider {
  async _send(payload) {
    for (let attempt = 0; ; attempt += 1) {
      let results;
      let failure;
      try { results = await super._send(payload); } catch (e) { failure = e; }
      const limited = failure ? isRateLimited(failure) : results.some((r) => rateLimitedRpcError(r?.error));
      if (!limited || attempt >= 5) {
        if (failure) throw failure;
        return results;
      }
      await sleep(250 * 2 ** attempt + Math.random() * 250); // reads are idempotent, so retrying the batch is safe
    }
  }
}

let readProvider;
function reader() {
  readProvider ??= new ArcReadProvider(RPC, CHAIN_ID, { batchMaxCount: 20 });
  return readProvider;
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export async function connectWallet() {
  const eth = window.ethereum;
  if (!eth) throw new Error('Install MetaMask or another injected EVM wallet.');
  await eth.request({ method: 'eth_requestAccounts' });
  const current = await eth.request({ method: 'eth_chainId' });
  if (BigInt(current) !== BigInt(CHAIN_ID)) {
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
    } catch (e) {
      if (e.code !== 4902 && e?.data?.originalError?.code !== 4902) throw e;
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{ chainId: CHAIN_HEX, chainName: 'Arc Testnet', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: [RPC], blockExplorerUrls: [EXPLORER] }],
      });
    }
  }
  const provider = new BrowserProvider(eth);
  if ((await provider.getNetwork()).chainId !== BigInt(CHAIN_ID)) throw new Error('Switch your wallet to Arc Testnet.');
  return provider.getSigner();
}

// ---------------------------------------------------------------------------
// Registry access
// ---------------------------------------------------------------------------

const versionCache = new Map();

/** Detects the registry version once per address. v1 has no VERSION() getter. */
export async function registryVersion(address) {
  const key = address.toLowerCase();
  if (versionCache.has(key)) return versionCache.get(key);
  const provider = reader();
  if ((await provider.getCode(address)) === '0x') throw new Error('No contract is deployed at this registry address on Arc Testnet.');
  let version = 1;
  try {
    version = Number(await new Contract(address, artifact.abi, provider).VERSION());
  } catch (error) {
    // Only a genuine revert means "no VERSION() getter" (v1). Never cache a guess made from a rate-limit.
    if (error.code !== 'CALL_EXCEPTION' || isRateLimited(error)) throw error;
    version = 1;
  }
  versionCache.set(key, version);
  return version;
}

async function registry(address, write = false) {
  if (!isAddress(address)) throw new Error('Configure a deployed registry address first.');
  const version = await registryVersion(address);
  const abi = version >= 2 ? artifact.abi : v1Artifact.abi;
  const runner = write ? await connectWallet() : reader();
  return { contract: new Contract(address, abi, runner), version };
}

const toRow = (r, id) => ({
  id,
  reporter: r.reporter,
  address: r.subject,
  evidenceHash: r.evidenceHash,
  createdAt: Number(r.createdAt),
  resolvedAt: r.resolvedAt !== undefined ? Number(r.resolvedAt) : null,
  challengeCount: r.challengeCount !== undefined ? Number(r.challengeCount) : null,
  status: STATUS[Number(r.status)],
});

export async function registryInfo(address) {
  const { contract, version } = await registry(address);
  const [reviewer, count, delay] = await Promise.all([contract.reviewer(), contract.reportCount(), contract.REVIEW_DELAY()]);
  const info = { address, version, reviewer, reportCount: Number(count), reviewDelay: Number(delay), paused: false, pendingReviewer: null };
  if (version >= 2) {
    const [paused, pending] = await Promise.all([contract.paused(), contract.pendingReviewer()]);
    info.paused = paused;
    info.pendingReviewer = /^0x0{40}$/i.test(pending) ? null : pending;
  }
  return info;
}

/** Newest-first page of reports. `before` is an exclusive upper id bound (defaults to the newest). */
export async function fetchReports(address, { before, limit = PAGE_SIZE } = {}) {
  const { contract, version } = await registry(address);
  const total = Number(await contract.reportCount());
  const end = Math.min(before ?? total, total);
  const start = Math.max(0, end - limit);
  let rows = [];
  if (end > start) {
    if (version >= 2) {
      const page = await contract.getReports(start, end - start);
      rows = page.map((r, i) => toRow(r, start + i));
    } else {
      const ids = Array.from({ length: end - start }, (_, i) => start + i);
      rows = (await Promise.all(ids.map((id) => contract.reports(id)))).map((r, i) => toRow(r, ids[i]));
    }
  }
  return { rows: rows.reverse(), total, nextBefore: start > 0 ? start : null };
}

/**
 * All reports filed against `subject`. v2 returns the complete history via the onchain index.
 * v1 has no index, so only the latest 100 reports are scanned and `complete` is false.
 */
export async function lookupSubject(address, subject) {
  if (!isAddress(subject)) throw new Error('Enter a valid 42-character EVM address.');
  const { contract, version } = await registry(address);
  if (version >= 2) {
    const total = Number(await contract.subjectReportCount(subject));
    const ids = [];
    for (let offset = 0; offset < total; offset += 100) ids.push(...(await contract.reportIdsOf(subject, offset, 100)));
    const rows = await Promise.all(ids.map(async (id) => toRow(await contract.reports(id), Number(id))));
    return { rows, complete: true, version };
  }
  const { rows } = await fetchReports(address, { limit: 100 });
  return { rows: rows.filter((r) => r.address.toLowerCase() === subject.toLowerCase()), complete: false, version };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const errorInterface = new Interface(artifact.abi);
const FRIENDLY = {
  ZeroAddress: 'The address cannot be the zero address.',
  InvalidEvidence: 'Evidence hash is empty.',
  UriTooLong: 'Evidence URI is longer than 256 characters.',
  SelfReport: 'You cannot report your own connected address.',
  DuplicateOpenReport: 'You already have an open report against this address.',
  ReportNotFound: 'No report exists with that ID.',
  ReportClosed: 'This report is already resolved.',
  AlreadyChallenged: 'This wallet has already challenged that report.',
  ReporterCannotChallenge: 'The original reporter cannot challenge their own report.',
  ReviewWindowActive: 'The two-day review window has not elapsed yet.',
  NotReviewer: 'Only the registry reviewer can do this.',
  NotPendingReviewer: 'Only the nominated reviewer can accept the role.',
  IsPaused: 'The registry is paused by the reviewer. Submissions and challenges are disabled.',
  InvalidPage: 'Invalid page request.',
};

export function describeError(e) {
  if (e?.code === 'ACTION_REJECTED' || e?.code === 4001 || e?.info?.error?.code === 4001) return 'Request rejected in wallet.';
  if (isRateLimited(e)) return 'The Arc RPC is busy (rate limited). Wait a few seconds and try again.';
  const data = e?.data ?? e?.info?.error?.data ?? e?.error?.data;
  let name = e?.revert?.name;
  if (!name && typeof data === 'string' && data.length >= 10) {
    try { name = errorInterface.parseError(data)?.name; } catch { /* not a known custom error */ }
  }
  if (name && FRIENDLY[name]) return FRIENDLY[name];
  if (e?.reason) return e.reason;
  if (e?.code === 'INSUFFICIENT_FUNDS') return 'Insufficient test USDC for gas. Use the Circle faucet.';
  if (e?.code === 'NETWORK_ERROR' || e?.code === 'TIMEOUT') return 'Arc RPC is unreachable. Try again shortly.';
  return e?.shortMessage || e?.message || 'Unexpected error.';
}

async function withRateLimitRetry(fn, attempts = 5) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (!isRateLimited(e) || i >= attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

/**
 * Simulates then sends a registry transaction. v1 does not accept evidence URIs; they are dropped.
 * Calls `onSubmitted(hash)` once the wallet broadcasts it. Resolves with the confirmed receipt.
 */
export async function sendRegistryTx(address, method, args, onSubmitted = () => {}) {
  const { contract, version } = await registry(address, true);
  const finalArgs = version < 2 && (method === 'submit' || method === 'challenge') ? args.slice(0, 2) : args;
  if (version < 2 && !['submit', 'challenge', 'resolve'].includes(method)) throw new Error('This action requires a v2 registry.');
  // Read-only calls retry when a public RPC rate-limits; the signed send itself is never retried.
  await withRateLimitRetry(() => contract[method].staticCall(...finalArgs));
  const gas = await withRateLimitRetry(() => contract[method].estimateGas(...finalArgs));
  const tx = await contract[method](...finalArgs, { gasLimit: (gas * 12n) / 10n });
  onSubmitted(tx.hash);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error('Transaction reverted.');
  return receipt;
}

export async function deployRegistry(reviewer, onSubmitted = () => {}) {
  if (!isAddress(reviewer)) throw new Error('Enter a valid reviewer address.');
  const signer = await connectWallet();
  const account = await signer.getAddress();
  if (expectedDeployer && account.toLowerCase() !== expectedDeployer.toLowerCase()) throw new Error(`Select the funded deployment wallet ${expectedDeployer} in your wallet.`);
  const contract = await new ContractFactory(artifact.abi, artifact.bytecode, signer).deploy(reviewer);
  onSubmitted(contract.deploymentTransaction().hash);
  await contract.waitForDeployment();
  return contract.getAddress();
}

// Exposes the version-aware contract for cross-chain evidence verification.
export async function arkivRegistry(address,write=false){return (await registry(address,write)).contract;}

// ---------------------------------------------------------------------------
// Interface helpers used by the redesigned pages (src/pages, src/state).
// Thin wrappers over the version-aware layer above; no new contract logic.
// ---------------------------------------------------------------------------

export const CHAIN_NAME = 'Arc Testnet';
export const FAUCET = 'https://faucet.circle.com/';
export const DEFAULT_REVIEWER = defaultReviewer;
export const STATUSES = STATUS;
/** How many of the newest reports the dashboard keeps in memory. */
export const READ_WINDOW = 100;
export { deployment, CHAIN_HEX };
export const explorerTx = txUrl;
export const explorerAddress = addressUrl;
export const getReadProvider = reader;
export const bytesHash = (bytes) => keccak256(bytes);

export function hasInjectedWallet() {
  return typeof window !== 'undefined' && Boolean(window.ethereum);
}

/** Read wallet state without prompting the user. */
export async function peekWallet() {
  if (!hasInjectedWallet()) return { account: '', chainId: null };
  const [accounts, chainId] = await Promise.all([
    window.ethereum.request({ method: 'eth_accounts' }),
    window.ethereum.request({ method: 'eth_chainId' }),
  ]);
  return { account: accounts?.[0] || '', chainId: Number(BigInt(chainId)) };
}

/** Switch (or add) Arc Testnet; connectWallet() does the same as part of connecting. */
export async function switchToArc() {
  const eth = window.ethereum;
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
  } catch (e) {
    if (e.code !== 4902 && e?.data?.originalError?.code !== 4902) throw e;
    await eth.request({
      method: 'wallet_addEthereumChain',
      params: [{ chainId: CHAIN_HEX, chainName: CHAIN_NAME, nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: [RPC], blockExplorerUrls: [EXPLORER] }],
    });
  }
}

/** registryInfo() plus the current block, in the shape the dashboard expects (`count`). */
export async function fetchRegistryMeta(address) {
  const [info, blockNumber] = await Promise.all([registryInfo(address), reader().getBlockNumber()]);
  return { ...info, count: info.reportCount, blockNumber };
}

export async function fetchReport(address, id) {
  const { contract } = await registry(address);
  return toRow(await contract.reports(id), Number(id));
}

export async function hasChallenged(address, id, account) {
  const { contract } = await registry(address);
  return contract.challenged(id, account);
}

/** v1 registries revert with reason strings; v2 uses custom errors handled by describeError(). */
const V1_REASONS = {
  'reviewer only': 'Only the registry reviewer can resolve reports.',
  'review window': 'The two-day review window for this report has not elapsed yet.',
  closed: 'This report is already resolved and can no longer change.',
  'invalid challenge': 'This wallet has already challenged this report, or the evidence is empty.',
  'invalid evidence': 'The subject address or evidence hash is invalid.',
};

export function friendlyError(e) {
  if (!e) return 'Unknown error.';
  if (isRateLimited(e)) return 'The Arc network is busy right now. Nothing was sent; please try again in a minute.';
  const reason = e.reason || e.revert?.args?.[0];
  if (reason && V1_REASONS[reason]) return V1_REASONS[reason];
  return describeError(e);
}
