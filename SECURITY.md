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
