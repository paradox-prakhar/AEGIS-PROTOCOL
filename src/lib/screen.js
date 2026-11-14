import { scan, sampleAddress } from '../risk.js';

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * Combine the deterministic local policy with onchain registry rows and wallet linkage.
 * Never returns a "safe" verdict: absence of reports is reported as "No record".
 *
 * `fullHistory`: rows came from the registry's per-address index (v2), not just the latest window.
 * `linkage`: result of linkedRisk() — { links, connected } — or { error } / null when unavailable.
 *   A wallet that has transacted with a flagged wallet inherits that wallet's status
 *   (confirmed → spam, open report → under review).
 */
export function screenAddress(address, onchainRows, registryAvailable, fullHistory = false, linkage = null) {
  const local = scan(address, []);
  const lower = address.toLowerCase();
  const matches = (onchainRows || []).filter((r) => r.address.toLowerCase() === lower);
  const open = matches.filter((r) => r.status === 'Pending' || r.status === 'Challenged');
  const confirmed = matches.filter((r) => r.status === 'Confirmed');
  const rejected = matches.filter((r) => r.status === 'Rejected');
  const links = linkage?.links || [];
  const connected = linkage?.connected || [];
  const confirmedLinks = links.filter((l) => l.status === 'Confirmed');
  const openLinks = links.filter((l) => l.status !== 'Confirmed');
  const base = { score: null, matches, links, connected: [], linkError: linkage?.error || null };

  const linkReasons = (list) => list.map((l) =>
    `Transacted with ${l.status === 'Confirmed' ? 'confirmed spam' : 'reported'} wallet ${short(l.address)} (${l.txs.length} transaction${l.txs.length === 1 ? '' : 's'}).`);
  const spreadReason = connected.length
    ? [`${connected.length} wallet(s) that transacted with this address are flagged as spam by association.`]
    : [];

  if (lower === sampleAddress) {
    return { ...base, tone: 'danger', level: 'High risk', score: local.score, demo: true, connected, reasons: [...local.reasons, ...spreadReason] };
  }
  if (confirmed.length) {
    return {
      ...base, tone: 'danger', level: 'Confirmed spam wallet', connected,
      reasons: [
        `${confirmed.length} report(s) confirmed by the registry reviewer.`,
        ...spreadReason,
        'Reviewer adjudication is a strong signal, not an absolute guarantee. Do not send funds.',
      ],
    };
  }
  if (confirmedLinks.length) {
    return {
      ...base, tone: 'danger', level: 'Linked to spam wallet',
      reasons: [
        ...linkReasons(confirmedLinks),
        'Wallets that transact with a confirmed spam wallet are treated as spam too. Do not send funds.',
        ...(open.length ? [`${open.length} open onchain allegation(s) against this address as well.`] : []),
      ],
    };
  }
  if (open.length) {
    return {
      ...base, tone: 'warning', level: 'Under review', connected,
      reasons: [
        `${open.length} open onchain allegation(s) awaiting review.`,
        ...spreadReason,
        'Community allegations are not proof. Treat this destination with caution.',
      ],
    };
  }
  if (openLinks.length) {
    return {
      ...base, tone: 'warning', level: 'Linked to reported wallet',
      reasons: [
        ...linkReasons(openLinks),
        'The linked wallet has an open allegation. This address inherits that status until the report is resolved.',
      ],
    };
  }
  if (rejected.length) {
    return {
      ...base, tone: 'info', level: 'Reports rejected',
      reasons: [
        `${rejected.length} report(s) were reviewed and rejected.`,
        'A rejected allegation does not make an address safe.',
      ],
    };
  }
  return {
    ...base, tone: 'neutral', level: 'No record',
    reasons: [
      registryAvailable
        ? (fullHistory ? 'No reports against this address in the full onchain history.' : 'No matching reports in the latest 100 registry records.')
        : 'The onchain registry could not be read, so only local fixtures were checked.',
      linkage?.error
        ? 'Transaction history could not be read, so links to reported wallets were not checked.'
        : 'No transactions with reported wallets found in its recent history.',
      'This is not a safety verdict.',
    ],
  };
}
