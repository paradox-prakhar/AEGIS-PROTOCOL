# Completion audit — 7 November 2026

## Verified

- v2 registry deployed on Arc Testnet at `0x0152aD9b65959069c605BE509a1fbCDc24D54924`. Receipt `0x22fa9adfaa1582c92fc18064f9a7c9dd38da7e6d1c5fa3d557a6bfb45ebbb612`, block 71123871. Constructor bytecode matches this repository; this is not an independent audit or explorer source verification.
- Full tests cover v1 compatibility, v2 permissions/pause/rotation/indexing/disputes, staking payouts/refunds/double claims, evidence binding, and AES-GCM incident restoration/tampering.
- Dependency audit returned zero known vulnerabilities after Ganache replacement with Hardhat and patched tmp/zod overrides. Re-run `npm audit` as advisories change.

## Implemented, with explicit boundaries

- Reports: separate Arc and Arkiv wallet transactions, public evidence hash binding and explicit TEST review gates. The first complete live signed flow still needs confirmation.
- Storage renewal: Recovery center accepts an Arkiv entity key and signs a 30-day extension. Account must own the entity or it must allow permissionless extension.
- Recovery vault: AES-256-GCM encrypted before Arkiv upload; PBKDF2-SHA256 with 310,000 iterations and random salt/IV. Passphrases remain in session memory. Export backups and save the passphrase separately. Arkiv expiry is not guaranteed erasure. UI currently lists up to 50 encrypted records; no automated retention service.
- Live security: GoPlus address-security adapter with explicit unknown/error handling. Arc Testnet support depends on GoPlus; an unsupported network is not safe. Address and selected chain are disclosed to GoPlus only when the user presses the query button.
- Execution simulation: live Arc `eth_call` and `eth_estimateGas`; it does not produce a comprehensive token balance-diff simulation or guarantee safety.
- Fund tracing: real receipt plus one-hop ERC-20 Transfer events across a bounded 1,000-block forward window, five recipient addresses and 100 outgoing events. Not a full forensic graph or attribution service.
- Staking: unaudited testnet-only companion contract `AegisReportStake`, using OpenZeppelin SafeERC20/ReentrancyGuard. Requires v2 and a 6-decimal token. Minimum 1 USDC. Trusted registry resolution determines the winning side. Winners divide the total pool proportionally; rounding dust stays locked. If there is no winning-side stake, every participant may reclaim their own stake. An unresolved report is refundable after 30 days. Once a timeout refund begins it stays in refund mode even if adjudication occurs later. UI uses exact approvals and separate stake/claim transactions. Deploying the companion is a separate wallet action; do not use real funds.
- Issuer coordination: creates a uniquely identified evidence request package labelled DRAFT / NOT SUBMITTED. No issuer credentials or authorized submission endpoint was provided. No freeze request has been submitted and no issuer status is invented. Follow the issuer's official support/legal process: https://www.circle.com/legal/usdc-terms .

## Self-review and remaining release gates

This repository has a developer review and automated checks, not an independent security audit. Before real funds: commission a contract audit and economic review, use a multisig reviewer, validate RPC/GoPlus coverage, run browser/wallet integration tests, add durable retention operations and recovery pagination, monitor RPC failures, and define an authorized issuer handling process. The trusted reviewer, immutable staking registry binding and loss of encryption passphrase are material trust/recovery assumptions. Public hosting is a testnet demonstration, not a production-readiness certification.

## Rapid demo

1. Onchain platform shows the verified v2 address. Connect the funded deployment wallet.
2. Community reports → Prepare TEST / SIMULATED report → review exact data → Request Arc signature. Export the confirmed recovery copy.
3. Review Arkiv payload → Request Arkiv signature on Rabdi. Export the linked report and use Search Arkiv to verify it.
4. Recovery center → encrypt a private test incident → download backup → sign Arkiv storage. Reload records and decrypt with the same passphrase. Use the returned entity key in renewal.
5. Transaction scanner → run a GoPlus query (choose a supported chain), EVM execution check and real transaction tracing. All are read-only.
6. Onchain platform → deploy staking companion only against v2 → save VITE_STAKING_ADDRESS. Approve exactly the intended amount, stake on a report, then claim after its outcome or timeout.
7. Reviewer resolves reports after two days. Synthetic reports must stay visibly labelled TEST / SIMULATED; do not confirm them as actual fraud.
