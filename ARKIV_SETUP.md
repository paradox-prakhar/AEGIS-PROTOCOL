# Arkiv reporting: transaction walkthrough

No PostgreSQL server or DATABASE_URL is used. Arkiv Rabdi stores public reported wallet addresses and evidence; the existing Arc registry stores allegations and decisions. This is a two-chain testnet integration, not an audited mainnet service.

1. Use the funded wallet `0x2Df43B66A31cd93792E4a32Af494b5a18c614148` in MetaMask.
2. Keep test USDC on Arc for report, challenge and review gas. Get it at https://faucet.circle.com/ .
3. Get test tGLM on **Rabdi** for that same wallet at https://hub.arkiv.network/faucet . Chain ID: 7794095. These tokens are different from Arc USDC.
4. Optionally create an RPC access key at https://hub.arkiv.network/access-keys . Put a browser-public, origin-restricted key in `.env.local` as `VITE_ARKIV_ACCESS_KEY=...`. Never put private keys in VITE variables. The public endpoint works with strict rate limits.
5. Run `npm ci` and `npm run dev`. Open the printed URL and select **Community reports**.
6. Enter the suspected wallet and public supporting evidence. Click **Sign Arc report**. MetaMask switches to Arc; review and confirm. Wait for the report ID and receipt link. If the wait is interrupted, inspect your wallet receipt before resubmitting.
7. Click **Export / save recovery copy**. Preserve this file: it lets you retry Arkiv without creating another Arc report. Do not navigate away before exporting.
8. Click **Sign Arkiv storage transaction**. Approve adding/switching to Rabdi, then review the tGLM fee and sign. This publishes the evidence publicly for 30 days. The UI only shows success when the SDK confirms the transaction. Copy the entity key and receipt link.
9. Search that address in **Threat registry**. Arkiv returns the entity; Aegis checks the creator, address and evidence hash against the Arc report and obtains the decision from Arc. Unverified entities never become confirmed reputation signals. Pagination loads ten records at a time.
10. If the Arkiv step fails, keep the exported file. Return later, import it with **Resume an exported report**, and retry only Arkiv. The code checks for an existing entity from the same creator and Arc transaction before publishing again; simultaneous duplicate requests still need operational handling.
11. To challenge: open **Onchain platform**, enter the report ID and challenge evidence, sign on Arc. To resolve: use the designated reviewer wallet, fund it with Arc test USDC, wait two days from creation, then sign Confirm or Reject. Arkiv search re-reads the authoritative Arc status; no separate database status update is required.
12. Arkiv data expires after 30 days. Entities are created read-only with permissionless extension enabled. Use Arkiv's supported `extendEntity` action before expiry to pay for more retention. An in-app renewal control and retention monitoring are not implemented yet. Arc report hashes remain even when Arkiv evidence expires.

Official SDK/browser setup: https://docs.arkiv.network/start-here/clients/ . Current implementation is pinned by package-lock.json to SDK 1.0.1 and uses its Rabdi schema API.

## Current verification and remaining production work

The frontend builds, existing risk/contract tests pass, and the public Rabdi chain ID and wallet balance were checked. The wallet had zero tGLM at verification; an actual wallet-signed Arkiv create/read flow is not yet confirmed. A build alone does not prove the live write workflow.

Recovery incidents remain browser-local because they can contain sensitive victim details. Issuer requests, staking, comprehensive threat simulation, complete-history scanning, retention automation and independent security review remain unfinished. Do not represent all application data as onchain: this release moves public scam report storage to Arkiv and retains Arc adjudication. Dependency advisories in development tooling also remain unresolved.
