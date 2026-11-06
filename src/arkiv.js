// Arkiv (Rabdi testnet) layer: public, queryable report records that point at the Arc registry.
//
// Trust model: Arkiv is writable by anyone, so an entity is only an allegation record. Arc is the
// source of truth. Use crossCheck() (src/risk.js) to accept an Arkiv entity only when an Arc report
// links back to it with the same reporter, subject and evidence hash.
import { createPublicClient, createWalletClient, ExpirationTime } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { and, asc, eq, gt } from '@arkiv-network/sdk/query';
import { addr, defineSchema, key, str, u256 } from '@arkiv-network/sdk/schema';
import { ARC_CHAIN_ID, expiryInfo, ARKIV_EXPLORER as META_EXPLORER, CATEGORIES, MAX_DESCRIPTION, REPORT_LIFETIME_DAYS } from './arkiv-meta.js';
import { custom, http, isAddress, isHex, numberToHex } from 'viem';

const env = import.meta.env || {};

// The access key is public by design (it ships with the app). Restrict it to your origins in Arkiv Hub.
export const arkivChain = rabdi({ accessKey: env.VITE_ARKIV_ACCESS_KEY ?? '' });
// What gets added to the user's wallet: never include the app's access key in a user's wallet RPC.
export const arkivWalletChain = rabdi({ accessKey: '' });
export const ARKIV_CHAIN_ID = arkivChain.id;
const ARKIV_EXPLORER = arkivChain.blockExplorers.default.url.replace(/\/$/, '');
if (ARKIV_EXPLORER !== META_EXPLORER) console.warn(`Arkiv explorer changed to ${ARKIV_EXPLORER}; update src/arkiv-meta.js.`);

export const AegisReports = defineSchema('aegis-protocol.scam-reports', {
  subject: addr().indexed(),
  chainId: u256().indexed(),
  category: str().indexed(),
  reporter: addr().indexed(),
  evidenceHash: key().indexed(),
  description: str(),
  arcReportId: str().optional(),
  arcTxHash: str().optional(),
});

let publicClient;
const reader = () => (publicClient ??= createPublicClient({ chain: arkivChain, transport: http() }));

export async function connectArkivWallet() {
  const eth = window.ethereum;
  if (!eth) throw new Error('Install MetaMask or another injected EVM wallet.');
  const [account] = await eth.request({ method: 'eth_requestAccounts' });
  const hex = numberToHex(arkivWalletChain.id);
  const current = await eth.request({ method: 'eth_chainId' });
  if (BigInt(current) !== BigInt(arkivWalletChain.id)) {
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    } catch (e) {
      if (e.code !== 4902 && e?.data?.originalError?.code !== 4902) throw e;
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: hex,
          chainName: arkivWalletChain.name,
          nativeCurrency: arkivWalletChain.nativeCurrency,
          rpcUrls: arkivWalletChain.rpcUrls.default.http,
          blockExplorerUrls: [ARKIV_EXPLORER],
        }],
      });
    }
  }
  if (BigInt(await eth.request({ method: 'eth_chainId' })) !== BigInt(arkivWalletChain.id)) {
    throw new Error('Switch your wallet to the Arkiv Rabdi testnet.');
  }
  return createWalletClient({ chain: arkivWalletChain, transport: custom(eth), account });
}

/** Transaction 1 of 2: writes the report entity to Arkiv. Resolves once it is in a block. */
export async function createArkivReport({ subject, category, evidenceHash, description }) {
  if (!isAddress(subject)) throw new Error('Enter a valid 42-character EVM address.');
  if (!CATEGORIES.includes(category)) throw new Error('Choose a valid category.');
  if (!isHex(evidenceHash, { strict: true }) || evidenceHash.length !== 66) throw new Error('Evidence hash must be 32 bytes.');
  if (description.length > MAX_DESCRIPTION) throw new Error(`Public summary is limited to ${MAX_DESCRIPTION} characters.`);
  const wallet = await connectArkivWallet();
  const { entityKey, txHash, expiresAt } = await wallet.createEntity(
    AegisReports,
    {
      subject: addr(subject),
      chainId: u256(BigInt(ARC_CHAIN_ID)),
      category,
      reporter: addr(wallet.account.address),
      evidenceHash: key(evidenceHash),
      description,
    },
    { expiration: ExpirationTime.fromDays(REPORT_LIFETIME_DAYS) },
  );
  return { entityKey, txHash, expiresAt, reporter: wallet.account.address };
}

/** Optional transaction 3: records the Arc report id on the Arkiv entity. Only the entity owner can patch it. */
export async function linkArcReport(entityKey, { arcReportId, arcTxHash }) {
  const wallet = await connectArkivWallet();
  const { txHash } = await wallet.patchEntity(AegisReports, entityKey, {
    set: { arcReportId: String(arcReportId), arcTxHash },
  });
  return { txHash };
}

const normalize = (e) => ({
  entityKey: e.$key,
  subject: e.subject.value,
  chainId: e.chainId.value,
  category: e.category.value,
  reporter: e.reporter.value,
  evidenceHash: e.evidenceHash.value,
  description: e.description.value,
  arcReportId: e.arcReportId?.value ?? null,
});

/** Every Arkiv record for `subject` on Arc Testnet, paged by key so each record is read once. */
export async function fetchArkivReports(subject) {
  if (!isAddress(subject)) throw new Error('Enter a valid 42-character EVM address.');
  const out = [];
  let after;
  for (let page = 0; page < 20; page += 1) {
    const filter = and(eq('subject', addr(subject)), eq('chainId', u256(BigInt(ARC_CHAIN_ID))), ...(after ? [gt('$key', key(after))] : []));
    // Default onMismatch skips malformed entities, so a hostile writer cannot break the read for everyone.
    const { entities, skipped = 0 } = await reader()
      .select({ $key: true, subject: true, chainId: true, category: true, reporter: true, evidenceHash: true, description: true, arcReportId: true })
      .from(AegisReports)
      .where(filter)
      .orderBy(asc('$key'))
      .limit(100)
      .fetch();
    out.push(...entities.map(normalize));
    if (entities.length + skipped < 100 || !entities.length) break;
    after = entities[entities.length - 1].$key;
  }
  return out;
}

/** The connected wallet's own Arkiv reports with remaining life, so they can be renewed before they expire. */
export async function fetchMyArkivReports(owner) {
  if (!isAddress(owner)) throw new Error('Connect a wallet first.');
  const client = reader();
  const [timing, { entities }] = await Promise.all([
    client.getBlockTiming(),
    client
      .select({ $key: true, $expiresAt: true, subject: true, category: true, evidenceHash: true, description: true, arcReportId: true })
      .from(AegisReports)
      .ownedBy(owner)
      .orderBy(asc('$key'))
      .limit(100)
      .fetch(),
  ]);
  return entities.map((e) => ({
    entityKey: e.$key,
    subject: e.subject.value,
    category: e.category.value,
    evidenceHash: e.evidenceHash.value,
    description: e.description.value,
    arcReportId: e.arcReportId?.value ?? null,
    expiresAt: e.$expiresAt,
    ...expiryInfo(e.$expiresAt, timing),
  }));
}

/** Sets a new expiry `days` from now. The engine rejects an extension shorter than the remaining life. */
export async function extendArkivReport(entityKey, days = REPORT_LIFETIME_DAYS) {
  const wallet = await connectArkivWallet();
  return wallet.extendEntity({ entityKey, expiration: ExpirationTime.fromDays(days) });
}
