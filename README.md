# Aegis Protocol

Wallet-security workspace and onchain evidence registry on **Arc Testnet** (chain ID 5042002). Users screen addresses, publish wallet-signed allegations backed by evidence hashes, dispute them, and receive delayed adjudication from a trusted reviewer.

> Testnet software. The registry contract has not been independently audited. See [SECURITY.md](SECURITY.md) before any mainnet use.

## Contracts

| Version | Source | Status |
| --- | --- | --- |
| **v2** (current) | [`contracts/AegisRegistry.sol`](contracts/AegisRegistry.sol) | Ready to deploy. The frontend deploys and reads it. |
| v1 (legacy) | [`contracts/legacy/AegisRegistryV1.sol`](contracts/legacy/AegisRegistryV1.sol) | Live at `0x5eD536a9a2856109E4a02016ad2a99B3865e91F0`; bytecode verified against the frozen artifact `src/registry-v1-artifact.json`. |

The frontend detects the version of the configured registry at runtime (`VERSION()`), so the live v1 deployment keeps working until you switch to a v2 address.

### v2 hardening over v1

- **Complete per-address history**: onchain `reportIdsOf` index and O(1) `subjectSummary` counters. The scanner covers every report, not just the latest 100.
- **Paginated reads**: `getReports(offset, limit)` (max 100 per page) replaces one RPC call per report.
- **Two-step reviewer rotation** (`transferReviewer` → `acceptReviewer`), so the reviewer can migrate to a multisig without risking a typo.
- **Emergency pause**: blocks submissions and challenges. Adjudication continues while paused.
- **Abuse controls**: one open report per (reporter, subject); no self-reports; reporters cannot challenge their own report; bounds-checked IDs.
- **Custom errors**, decoded in the UI into readable messages.
- **Richer events**: indexed reporter, optional `evidenceURI` (≤256 bytes), resolver address. Reports record `resolvedAt` and `challengeCount`.
- Exact compiler pin (`0.8.38`, `paris` EVM, optimizer 200 runs) and a size check (EIP-170).

## Quick start

Node.js 22+.

```sh
npm ci
npm run dev
```

Open **Onchain platform**. The configured registry loads automatically. Connect a MetaMask-compatible wallet to submit, challenge or resolve reports. No private key is ever handled by this app.

### Local chain (no wallet funds needed)

```sh
node scripts/local-chain.mjs
```

This starts a Ganache chain on `127.0.0.1:8545` with Arc's chain ID, deploys v2 and seeds sample reports. Run the app against it with `VITE_ARC_RPC_URL=http://127.0.0.1:8545` and `VITE_REGISTRY_ADDRESS=<printed address>`. Never expose it publicly.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm test` | Risk-engine unit tests |
| `npm run test:contracts` | v1 + v2 contract lifecycle, access control, pause, rotation and pagination tests on an ephemeral EVM |
| `npm run contracts:compile` | Compile v2 → `src/registry-artifact.json` and `artifacts/AegisRegistry.v2.standard-input.json`; prove v1 source still matches the frozen artifact |
| `npm run build` | Compile + production bundle in `dist/` (React/ethers split into separate chunks) |
| `npm run deploy:check -- <deployer> <reviewer>` | Read-only balance and gas estimate for a v2 deployment |
| `npm run deploy:verify -- <txHash> <deployer> <reviewer> [--write]` | Verify a deployment against the repository artifacts; `--write` records it in `src/deployment.json` |

CI (`.github/workflows/ci.yml`) runs compilation with an artifact-drift check, all tests, the build and `npm audit --omit=dev`.

## Architecture

```mermaid
flowchart LR
  UI[React workspace] --> Wallet[Injected wallet / ethers]
  Wallet --> Registry[AegisRegistry on Arc]
  UI --> RPC[Arc JSON-RPC]
  RPC --> Registry
  UI --> Local[Browser-local incidents]
  Local --> Export[JSON evidence export]
```

- `src/chain.js`: chain config, wallet connection, version detection, paginated reads, subject lookup, error decoding, transaction simulation and sending.
- `src/Onchain.jsx`: registry dashboard, report/challenge/resolve forms, reviewer administration, deployment.
- `src/main.jsx`: workspace shell, scanner, local incident tooling.
- `src/risk.js`: local screening policy.
- `scripts/`: compile, tests, deployment check/verify, local chain.

## Deploying to production hosting

See [SETUP.md](SETUP.md). Summary: build with `npm run build` and serve `dist/` over HTTPS. Security headers (CSP, HSTS, framing protection) ship in `public/_headers` (Netlify/Cloudflare Pages) and `vercel.json`. If you change `VITE_ARC_RPC_URL`, add its origin to `connect-src`.

## Known limitations

- Reports are allegations. The reviewer is a single trusted role; use a multisig. There is no decentralized governance or staking.
- Evidence text stays offchain. Only hashes and optional URIs are published, so reporters must preserve exact copies.
- Recovery incidents are browser-local. IPFS pinning, transaction simulation, fund tracing and issuer coordination are not implemented.
- The local EVM tooling (Ganache) is a dev dependency with known advisories. It is not shipped in the browser bundle.

## Arkiv + Arc reports

A v2 report is written to two networks:

1. **Arkiv (Rabdi testnet, gas in tGLM):** a public, queryable entity (`aegis-protocol.scam-reports`) holding the subject, category, reporter, evidence hash and a short public summary. Evidence text never leaves the reporter's machine.
2. **Arc (gas in USDC):** `submit(subject, evidenceHash, uri, arkivEntityKey)` stores the Arkiv entity key. The reviewer adjudicates on Arc.

**Trust rule:** anyone can write to Arkiv, so an Arkiv record counts only if an Arc report links back to it with the same entity key, reporter, subject and evidence hash (`crossCheck` in `src/risk.js`). Unlinked records are shown as ignored. If the Arc step fails, the Arkiv entity is kept and a retry reuses it.

Setup: get an access key and tGLM at https://hub.arkiv.network, set `VITE_ARKIV_ACCESS_KEY` (public by design; restrict it to your origins), then deploy the v2 registry. The live v1 registry has no Arkiv link and keeps working for reads. Not yet implemented: transaction simulation, approval and interaction-history scoring.

## Staking, issuers and risk signals

**Staking (v2 contract).** Each report locks a native-USDC stake (reviewer-set minimum, default 0.1, max 10). Confirmed: the reporter withdraws it. Rejected: challengers of that report split it; with no challengers it goes to the treasury (defaults to the reviewer, so use a multisig). All payouts are pull-based (`withdraw`, `claimChallengerShare`), work while paused, and are covered by a reentrancy test.

**Authorized issuers.** The reviewer maintains an allowlist. Issuers record `Acknowledged / FreezeRequested / FundsFrozen / Declined` against *confirmed* reports with a hashed case reference. This is a public coordination record only: the contract cannot freeze funds, and an issuer's real-world action happens offchain.

**Risk signals** (`src/risk.js`, `src/signals.js`). Registry adjudication decides. Other signals add capped evidence, each counted once: dangerous simulation 40, unlimited approval / approval-for-all 25, threat feed 30 (35 if two credible sources agree), multiple open reports 15, fund-trace hit 10. Unconfirmed addresses cap at 99; confirmed is 100. Any signal that did not run is named in the result, and "Unknown" is never shown as safe.
- *Pre-sign check* (Transaction scanner page): calldata analysis, `eth_call` and gas checks, and token transfers out of the sender when the RPC supports `eth_simulateV1` (otherwise it says so).
- *Fund tracing*: one hop over recent ERC-20 `Transfer` logs, checked against the registry. Time- and size-limited; it reports when it is partial.
- *Threat feeds*: set `VITE_THREAT_FEEDS` (see `.env.example`). Feeds must return the Aegis format; front any provider with a small adapter. Add each origin to the CSP.

## Deploy and first end-to-end run (needs your funded testnet key)

```bash
export PRIVATE_KEY=0x…   # throwaway testnet key; read from the environment only, never printed
npm run deploy:registry -- <reviewer address> --write      # deploys v2, verifies bytecode, writes src/deployment.json
REGISTRY=<address> SUBJECT=<any 0x address> npm run e2e     # Arkiv entity -> Arc submit -> read back -> cross-check
```
`npm run e2e -- --arc-only` skips Arkiv writes. Hosting: `.github/workflows/deploy-pages.yml` (manual, no custom headers) or deploy `dist/` to Vercel/Netlify/Cloudflare, which apply the headers in `public/_headers` / `vercel.json`.
