import {
  BrowserProvider,
  Contract,
  ContractFactory,
  JsonRpcProvider,
  isAddress,
  keccak256,
  toUtf8Bytes,
} from 'ethers';
import artifact from './registry-artifact.json';
import deployment from './deployment.json';

export const CHAIN_ID = 5042002;
export const CHAIN_HEX = '0x4cef52';
export const CHAIN_NAME = 'Arc Testnet';
export const RPC = import.meta.env.VITE_ARC_RPC_URL || 'https://rpc.testnet.arc.io';
export const EXPLORER = 'https://explorer.testnet.arc.io';
export const FAUCET = 'https://faucet.circle.com/';
export const configuredRegistry = import.meta.env.VITE_REGISTRY_ADDRESS || deployment.registryAddress || '';
export const expectedDeployer = import.meta.env.VITE_DEPLOYER_ADDRESS || '';
export const DEFAULT_REVIEWER = deployment.reviewer || '';
export const STATUSES = ['Pending', 'Challenged', 'Confirmed', 'Rejected'];
export const READ_WINDOW = 100;
export { deployment };

const LOCAL_REGISTRY_KEY = 'aegis-registry-5042002';

export function activeRegistry() {
  if (configuredRegistry) return configuredRegistry;
  try {
    return localStorage.getItem(LOCAL_REGISTRY_KEY) || '';
  } catch {
    return '';
  }
}

export function rememberRegistry(address) {
  try {
    localStorage.setItem(LOCAL_REGISTRY_KEY, address);
    return true;
  } catch {
    return false;
  }
}

export const explorerTx = (hash) => `${EXPLORER}/tx/${hash}`;
export const explorerAddress = (address) => `${EXPLORER}/address/${address}`;

let readProvider;
export function getReadProvider() {
  if (!readProvider) readProvider = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
  return readProvider;
}

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

export async function switchToArc() {
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
  } catch (e) {
    if (e.code !== 4902) throw e;
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: CHAIN_HEX,
        chainName: CHAIN_NAME,
        nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
        rpcUrls: [RPC],
        blockExplorerUrls: [EXPLORER],
      }],
    });
  }
}

export async function connectWallet() {
  if (!hasInjectedWallet()) throw Error('Install MetaMask or another injected EVM wallet to continue.');
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  const currentChain = await window.ethereum.request({ method: 'eth_chainId' });
  if (BigInt(currentChain) !== BigInt(CHAIN_ID)) await switchToArc();
  const provider = new BrowserProvider(window.ethereum);
  if ((await provider.getNetwork()).chainId !== BigInt(CHAIN_ID)) throw Error('Switch your wallet to Arc Testnet.');
  return provider.getSigner();
}

export async function registry(address, write = false) {
  if (!isAddress(address)) throw Error('Configure a deployed registry address first.');
  const runner = write ? await connectWallet() : getReadProvider();
  const provider = write ? runner.provider : runner;
  if ((await provider.getNetwork()).chainId !== BigInt(CHAIN_ID)) throw Error('Incorrect network.');
  if ((await provider.getCode(address)) === '0x') throw Error('No contract is deployed at this address.');
  return new Contract(address, artifact.abi, runner);
}

export async function deployRegistry(reviewer, onSubmitted = () => {}) {
  if (!isAddress(reviewer)) throw Error('Enter a valid reviewer address.');
  const signer = await connectWallet();
  const account = await signer.getAddress();
  if (expectedDeployer && account.toLowerCase() !== expectedDeployer.toLowerCase()) {
    throw Error(`Select the funded deployment wallet ${expectedDeployer} in your wallet.`);
  }
  const c = await new ContractFactory(artifact.abi, artifact.bytecode, signer).deploy(reviewer);
  onSubmitted(c.deploymentTransaction().hash);
  await c.waitForDeployment();
  return c.getAddress();
}

export function evidenceHash(text) {
  return keccak256(toUtf8Bytes(text));
}

export function bytesHash(bytes) {
  return keccak256(bytes);
}

function toRow(r, id) {
  return {
    id,
    reporter: r.reporter,
    address: r.subject,
    evidenceHash: r.evidenceHash,
    createdAt: Number(r.createdAt),
    status: STATUSES[Number(r.status)],
  };
}

export async function fetchRegistryMeta(address) {
  const c = await registry(address);
  const [reviewer, reviewDelay, count, blockNumber] = await Promise.all([
    c.reviewer(),
    c.REVIEW_DELAY(),
    c.reportCount(),
    getReadProvider().getBlockNumber(),
  ]);
  return { address, reviewer, reviewDelay: Number(reviewDelay), count: Number(count), blockNumber };
}

/** Latest READ_WINDOW reports, newest first. */
export async function fetchReports(address) {
  const c = await registry(address);
  const count = Number(await c.reportCount());
  const rows = [];
  for (let start = Math.max(0, count - READ_WINDOW); start < count; start += 10) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(10, count - start) }, (_, j) => c.reports(start + j)),
    );
    batch.forEach((r, j) => rows.push(toRow(r, start + j)));
  }
  return rows.reverse();
}

export async function fetchReport(address, id) {
  const c = await registry(address);
  return toRow(await c.reports(id), Number(id));
}

export async function hasChallenged(address, id, account) {
  const c = await registry(address);
  return c.challenged(id, account);
}

const REVERT_MESSAGES = {
  'reviewer only': 'Only the registry reviewer can resolve reports.',
  'review window': 'The two-day review window for this report has not elapsed yet.',
  closed: 'This report is already resolved and can no longer change.',
  'invalid challenge': 'This wallet has already challenged this report, or the evidence is empty.',
  'invalid evidence': 'The subject address or evidence hash is invalid.',
};

export function friendlyError(e) {
  if (!e) return 'Unknown error.';
  if (e.code === 'ACTION_REJECTED' || e.code === 4001 || e.info?.error?.code === 4001) {
    return 'Request rejected in your wallet.';
  }
  const reason = e.reason || e.revert?.args?.[0];
  if (reason && REVERT_MESSAGES[reason]) return REVERT_MESSAGES[reason];
  if (e.code === 'CALL_EXCEPTION' && !reason) return 'The transaction would revert. Check the report ID and its status.';
  if (e.code === 'INSUFFICIENT_FUNDS') return 'Not enough test USDC for gas. Top up from the Circle faucet.';
  return e.shortMessage || e.message || String(e);
}
