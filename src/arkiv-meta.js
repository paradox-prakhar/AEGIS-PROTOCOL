// Light constants shared with the UI. The heavy Arkiv SDK lives in arkiv.js and is loaded on demand.
export const ARC_CHAIN_ID = 5042002;
export const CATEGORIES = ['PHISHING', 'RUG_PULL', 'PIG_BUTCHERING', 'DRAINER', 'IMPERSONATION', 'OTHER'];
export const MAX_DESCRIPTION = 280;
export const REPORT_LIFETIME_DAYS = 365;
export const ARKIV_EXPLORER = 'https://rabdi.explorer.arkiv.network';
export const arkivTxUrl = (hash) => `${ARKIV_EXPLORER}/tx/${hash}`;
export const arkivEntityUrl = (entityKey) => `${ARKIV_EXPLORER}/entity/${entityKey}`;

export const RENEWAL_WARNING_DAYS = 30;

/** Remaining life of an Arkiv entity. Expiry is a block number; timing comes from arkiv_getBlockTiming. */
export function expiryInfo(expiresAtBlock, { currentBlock, blockDuration }) {
  const blocksLeft = BigInt(expiresAtBlock) - BigInt(currentBlock);
  const secondsLeft = blocksLeft <= 0n ? 0 : Number(blocksLeft) * Number(blockDuration);
  const daysLeft = secondsLeft / 86400;
  return { secondsLeft, daysLeft, expired: blocksLeft <= 0n, needsRenewal: daysLeft < RENEWAL_WARNING_DAYS };
}

/** Portable recovery file. It holds the evidence text only if the reporter still has it in this session. */
export function recoveryPackage({ reporter, records = [], evidence = null }) {
  return {
    protocol: 'AEGIS',
    kind: 'recovery-package',
    createdAt: new Date().toISOString(),
    note: 'Keep the exact evidence text: the public hash can only be re-verified against the original bytes. Arkiv records expire unless renewed.',
    reporter,
    records,
    evidence,
  };
}
