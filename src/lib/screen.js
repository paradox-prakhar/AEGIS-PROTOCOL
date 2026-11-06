import { scan, sampleAddress } from '../risk.js';

/**
 * Combine the deterministic local policy with onchain registry rows.
 * Never returns a "safe" verdict: absence of reports is reported as "No record".
 */
export function screenAddress(address, onchainRows, registryAvailable) {
  const local = scan(address, []);
  const lower = address.toLowerCase();
  const matches = (onchainRows || []).filter((r) => r.address.toLowerCase() === lower);
  const open = matches.filter((r) => r.status === 'Pending' || r.status === 'Challenged');
  const confirmed = matches.filter((r) => r.status === 'Confirmed');
  const rejected = matches.filter((r) => r.status === 'Rejected');

  if (lower === sampleAddress) {
    return { tone: 'danger', level: 'High risk', score: local.score, demo: true, matches, reasons: local.reasons };
  }
  if (confirmed.length) {
    return {
      tone: 'danger', level: 'Confirmed report', score: null, matches,
      reasons: [
        `${confirmed.length} report(s) confirmed by the registry reviewer.`,
        'Reviewer adjudication is a strong signal, not an absolute guarantee. Do not send funds.',
      ],
    };
  }
  if (open.length) {
    return {
      tone: 'warning', level: 'Under review', score: null, matches,
      reasons: [
        `${open.length} open onchain allegation(s) awaiting review.`,
        'Community allegations are not proof. Treat this destination with caution.',
      ],
    };
  }
  if (rejected.length) {
    return {
      tone: 'info', level: 'Reports rejected', score: null, matches,
      reasons: [
        `${rejected.length} report(s) were reviewed and rejected.`,
        'A rejected allegation does not make an address safe.',
      ],
    };
  }
  return {
    tone: 'neutral', level: 'No record', score: null, matches,
    reasons: [
      registryAvailable
        ? 'No matching reports in the latest 100 registry records.'
        : 'The onchain registry could not be read, so only local fixtures were checked.',
      'This is not a safety verdict. Live threat feeds and transfer simulation are not connected.',
    ],
  };
}
