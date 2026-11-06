import { keccak256, toUtf8Bytes } from 'ethers';

export const TEST_SUBJECT = '0x1111111111111111111111111111111111111111';
export const TEST_REPORTER = '0x2Df43B66A31cd93792E4a32Af494b5a18c614148';
export const SYNTHETIC_TX_SEED = 'AEGIS PROTOCOL / TEST ONLY / SIMULATED PHISHING / 2026-11-06 / 001';

export const TEST_EVIDENCE = {
  schema: 'aegis.test-evidence.v1',
  classification: 'TEST / SIMULATED',
  isTest: true,
  title: 'Aegis Protocol synthetic phishing workflow test',
  subject: TEST_SUBJECT,
  network: 'Arc Testnet',
  chainId: 5042002,
  category: 'PHISHING (SIMULATED)',
  publicEvidence: 'Synthetic transaction hash and mock phishing evidence generated specifically for testing. No real victim or scam allegation is involved.',
  mockTransaction: {
    label: 'TEST / SIMULATED — not a real transaction',
    hash: keccak256(toUtf8Bytes(SYNTHETIC_TX_SEED)),
    existsOnchain: false,
    derivation: 'Keccak-256 of a fixed synthetic test seed; not a blockchain receipt',
  },
  mockPhishingEvidence: {
    label: 'TEST / SIMULATED — fictional scenario',
    url: 'https://aegis-phishing-demo.invalid/claim',
    description: 'Fictional claim page requesting a token approval. No site was visited, no approval was requested, and no funds were stolen.',
  },
  realVictim: false,
  realScamAllegation: false,
};

export const TEST_EVIDENCE_TEXT = JSON.stringify(TEST_EVIDENCE, null, 2);
export const TEST_EVIDENCE_HASH = keccak256(toUtf8Bytes(TEST_EVIDENCE_TEXT));

export function isSimulatedEvidence(text) {
  try {
    const data = JSON.parse(text);
    return data.isTest === true && data.classification === 'TEST / SIMULATED';
  } catch { return false; }
}
