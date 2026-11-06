# Security policy

## Status

Aegis Protocol runs on **Arc Testnet** only. The `AegisRegistry` contracts have automated tests but **no independent audit**. Do not deploy to mainnet or rely on registry results for financial decisions until the checklist below is complete.

## Reporting a vulnerability

Do not open public issues for vulnerabilities. Contact the maintainers privately through GitHub's "Report a vulnerability" (Security Advisories) on this repository. Include reproduction steps, affected versions/addresses and impact. We aim to acknowledge reports within 3 business days.

## Trust model

- **Reviewer**: a single privileged address that resolves reports after a 2-day delay, pauses submissions/challenges and nominates its successor. It cannot alter evidence, delete reports, move funds or resolve a closed report. Use a multisig with hardware-wallet signers.
- **Reporters/challengers**: any wallet. Reports are public allegations, not proof. Abuse controls are limited: one open report per reporter per subject, no self-reports, one challenge per wallet per report. Sybil spam remains possible without staking.
- **Frontend**: a static site that never handles private keys. It simulates every write with `eth_call` before asking the wallet to sign.
- **Evidence**: only hashes and optional URIs go onchain. Never publish private keys, seed phrases or victims' personal data.

## Mainnet readiness checklist

- [ ] Independent smart-contract audit and remediation
- [ ] Invariant/fuzz testing (e.g. Foundry) of report accounting and access control
- [ ] Reviewer held by a multisig, with documented key-rotation and incident runbooks
- [ ] Economic abuse controls (stake/bond for reports and challenges)
- [ ] Event indexer with reorg handling for analytics beyond direct contract reads
- [ ] Durable, encrypted, consented evidence storage (e.g. IPFS pinning service)
- [ ] Dedicated, origin-restricted RPC endpoint and uptime monitoring
- [ ] Replace Ganache dev tooling (known upstream advisories) with maintained tooling
- [ ] Explorer source verification of the deployed bytecode

## Arkiv integration notes

- Arkiv is public and writable by anyone. An Arkiv record is never trusted on its own: it counts only when an Arc report links back with the same entity key, reporter, subject and evidence hash.
- Only a hash and a short public summary are stored on Arkiv. Evidence text stays with the reporter; the recovery package downloaded after submission is the only copy the app can produce.
- Arkiv entities expire (365 days by default). Renew from the Onchain workspace. Expired entities cannot be renewed; the Arc report and hash remain.
- The Arkiv access key is public by design. Restrict it to your site origins in Arkiv Hub. Never place a private key in any `VITE_` variable.
- The production dependency tree audits clean (`npm audit --omit=dev`). Dev-only tooling (ganache) bundles old packages that never ship to the browser.
- Not independently audited. Do not use with real funds until an external audit is complete.

## Staking, issuers and signals

- The contract now holds user funds (stakes). Payouts are pull-based with the balance zeroed before the transfer, and a reentrancy attacker contract is part of the test suite. The reviewer and treasury are trusted roles: use a multisig, because a single reviewer who is also the treasury profits from rejections.
- Issuer actions are records, not enforcement. Treat a `FundsFrozen` note as a claim by the issuer, not proof.
- Threat feeds are untrusted input: https only, strict schema, timeouts, references limited to https, one failing feed never blocks the others.
- A clean simulation, trace or feed result is not a safety guarantee, and the UI says so.
- Still required before real funds: independent audit of the staking logic, a multisig reviewer, and a decision on slashing policy.
