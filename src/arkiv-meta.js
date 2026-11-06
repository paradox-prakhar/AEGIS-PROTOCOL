// Light constants shared with the UI. The heavy Arkiv SDK lives in arkiv.js and is loaded on demand.
export const ARC_CHAIN_ID = 5042002;
export const CATEGORIES = ['PHISHING', 'RUG_PULL', 'PIG_BUTCHERING', 'DRAINER', 'IMPERSONATION', 'OTHER'];
export const MAX_DESCRIPTION = 280;
export const REPORT_LIFETIME_DAYS = 365;
export const ARKIV_EXPLORER = 'https://rabdi.explorer.arkiv.network';
export const arkivTxUrl = (hash) => `${ARKIV_EXPLORER}/tx/${hash}`;
export const arkivEntityUrl = (entityKey) => `${ARKIV_EXPLORER}/entity/${entityKey}`;
