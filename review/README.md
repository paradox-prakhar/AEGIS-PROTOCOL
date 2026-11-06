# TEST / SIMULATED — review before signing

This package is an unsigned draft. No report transaction or Arkiv entity has been created by preparing these files.

- Reported address: `0x1111111111111111111111111111111111111111`
- Signing wallet: `0x2Df43B66A31cd93792E4a32Af494b5a18c614148`
- Category: **PHISHING (SIMULATED)**
- Target network: Arc Testnet, chain 5042002
- Registry: `0x5eD536a9a2856109E4a02016ad2a99B3865e91F0` (deployed v1)
- Initial status if signed and confirmed: PENDING REVIEW
- Actual state now: UNSIGNED / NOT SUBMITTED
- No real victim or scam allegation. The `.invalid` URL and mock hash are fictional.

## Review files

`test-evidence.json` contains the exact UTF-8 evidence bytes, with no trailing newline. Its Keccak-256 is `0xb034d7ec48a1bddf84b4c57a14f10c0966304c1f091757894a13cec984c8f3eb`.

`test-report-review.json` describes both proposed transactions. Real receipt hashes, Arc report ID and Arkiv entity key are null because they do not exist yet. The mock hash inside the evidence is deliberately labelled synthetic and must never be used as a real receipt.

## After you finish reviewing

1. Open Community reports and click **Prepare TEST / SIMULATED report — no transaction**. This only fills the draft and opens the preview.
2. Expand the exact evidence. Check the address, hash, reporter and registry. Download the unsigned review if desired.
3. Only when ready, check the review box and click **Request Arc signature**. MetaMask will present a real testnet transaction. The v1 contract call is `submit(subject, evidenceHash)` with zero transferred value; gas is paid in test USDC. The v1 contract has no test-label or URI field, so the TEST label is in the hashed evidence.
4. After confirmation, export the recovery copy containing the actual Arc report ID and receipt. These are distinct from the fictional transaction hash in the evidence.
5. Review the exact Arkiv payload, check the publication box and click **Request Arkiv signature**. MetaMask switches to Rabdi (7794095). Storage gas is paid in tGLM. The evidence becomes public, read-only and retained for 30 days. Anyone may pay to extend retention; expiry is not guaranteed historical erasure.
6. Only after Arkiv confirmation, the app displays the real entity key and `arkiv://7794095/<entityKey>` application reference. Export the linked report. The Arkiv record points to the Arc report and receipt; Arc v1 anchors the matching evidence hash, not the Arkiv URI.

No signing request should be approved until its displayed content has been reviewed. The two transactions are separate and are not atomic. If the second fails, resume from the exported Arc recovery copy instead of submitting a duplicate report.
