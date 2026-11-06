// Chain access layer. Supports the deployed v1 registry and the hardened v2 registry.
import { BrowserProvider, Contract, ContractFactory, Interface, JsonRpcProvider, formatEther, isAddress, keccak256, toUtf8Bytes } from 'ethers';
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

let readProvider;
function reader() {
  readProvider ??= new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true, batchMaxCount: 20 });
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
  try { version = Number(await new Contract(address, artifact.abi, provider).VERSION()); } catch { version = 1; }
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
  stake: r.stake !== undefined ? formatEther(r.stake) : null,
  arkivEntityKey: r.arkivEntityKey && !/^0x0{64}$/i.test(r.arkivEntityKey) ? r.arkivEntityKey : null,
});

export async function registryInfo(address) {
  const { contract, version } = await registry(address);
  const [reviewer, count, delay] = await Promise.all([contract.reviewer(), contract.reportCount(), contract.REVIEW_DELAY()]);
  const info = { address, version, reviewer, reportCount: Number(count), reviewDelay: Number(delay), paused: false, pendingReviewer: null };
  if (version >= 2) {
    const [paused, pending, minStake, treasury] = await Promise.all([contract.paused(), contract.pendingReviewer(), contract.minStake(), contract.treasury()]);
    info.minStake = minStake;
    info.treasury = treasury;
    info.paused = paused;
    info.pendingReviewer = /^0x0{40}$/i.test(pending) ? null : pending;
  }
  return info;
}

export const rpcProvider = () => reader();

/** Registry standing of an address: counts of confirmed and open reports (v2 aggregate; v1 has no index). */
export async function subjectStatus(address, subject) {
  const { contract, version } = await registry(address);
  if (version < 2) return { confirmed: 0, open: 0 };
  const st = await contract.subjectSummary(subject);
  return { confirmed: Number(st.confirmed), open: Number(st.open) };
}

/** Roles and withdrawable stake for a wallet (v2 only). */
export async function accountRoles(address, account) {
  const { contract, version } = await registry(address);
  if (version < 2 || !isAddress(account)) return { isIssuer: false, credits: 0n };
  const [isIssuer, credits] = await Promise.all([contract.isIssuer(account), contract.credits(account)]);
  return { isIssuer, credits };
}

export const ISSUER_ACTIONS = ['Acknowledged', 'FreezeRequested', 'FundsFrozen', 'Declined'];

export async function issuerNotes(address, id) {
  const { contract, version } = await registry(address);
  if (version < 2) return [];
  return (await contract.issuerNotes(id)).map((n) => ({ issuer: n.issuer, action: ISSUER_ACTIONS[Number(n.action)], at: Number(n.recordedAt), ref: n.ref }));
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
  InvalidArkivKey: 'The Arkiv entity key is missing.',
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
  StakeTooLow: 'The attached stake is below the registry minimum.',
  InvalidStake: 'That minimum stake is above the allowed maximum (10 USDC).',
  NotIssuer: 'Only an authorized issuer can record issuer actions.',
  ReportNotConfirmed: 'Issuer actions can only be recorded on confirmed reports.',
  NotRejected: 'Challenger shares exist only for rejected reports.',
  NoShare: 'You have no unclaimed challenger share on that report.',
  NothingToWithdraw: 'You have no stake to withdraw.',
  TransferFailed: 'The payout transfer failed.',
};

export function describeError(e) {
  if (e?.code === 'ACTION_REJECTED' || e?.code === 4001 || e?.info?.error?.code === 4001) return 'Request rejected in wallet.';
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

/**
 * Simulates then sends a registry transaction. v1 does not accept evidence URIs; they are dropped.
 * Calls `onSubmitted(hash)` once the wallet broadcasts it. Resolves with the confirmed receipt.
 */
export async function sendRegistryTx(address, method, args, onSubmitted = () => {}, overrides = {}) {
  const { contract, version } = await registry(address, true);
  const finalArgs = version < 2 && (method === 'submit' || method === 'challenge') ? args.slice(0, 2) : args;
  if (version < 2 && !['submit', 'challenge', 'resolve'].includes(method)) throw new Error('This action requires a v2 registry.');
  const extra = Object.keys(overrides).length ? [overrides] : [];
  await contract[method].staticCall(...finalArgs, ...extra);
  const tx = await contract[method](...finalArgs, ...extra);
  onSubmitted(tx.hash);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error('Transaction reverted.');
  return receipt;
}

/** Report id from the Submitted event of a confirmed v2 submit transaction, or null. */
export function reportIdFromReceipt(receipt, registryAddress) {
  for (const log of receipt?.logs ?? []) {
    if (registryAddress && log.address.toLowerCase() !== registryAddress.toLowerCase()) continue;
    try {
      const parsed = errorInterface.parseLog(log);
      if (parsed?.name === 'Submitted') return Number(parsed.args.id);
    } catch { /* not a registry event */ }
  }
  return null;
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
