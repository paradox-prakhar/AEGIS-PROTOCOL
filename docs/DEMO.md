# Aegis Protocol: workflow, algorithm and demo video guide

## 1. What Aegis does (one paragraph)

Aegis is a community registry of risky onchain addresses. People report an address with evidence. The report is stored on two chains, a reviewer judges it, and anyone can check an address (or a pending transaction) before signing.

## 2. The workflow in simple terms

```
REPORTER                         ARKIV (public database)        ARC (source of truth)          REVIEWER / CHALLENGERS
   |                                      |                              |                              |
1. Writes evidence, keeps it            |                              |                              |
   (only its hash is published)          |                              |                              |
2. Signs "create report" ------------->  Entity stored                  |                              |
   (pays tGLM)                          (subject, category, hash)       |                              |
3. Signs "submit report" + stake -------------------------------------> Report stored, linked to        |
   (pays USDC)                                                          the Arkiv entity key            |
4.                                                                      | <---- 2-day review window ---> Challengers add counter-evidence
5.                                                                      | <---------------------------- Reviewer confirms or rejects
6. Confirmed: stake refunded.  Rejected: stake split among challengers (or treasury if none).
7. Authorized issuers may record freeze / recovery requests on CONFIRMED reports.
```

Why two chains: Arkiv holds the readable, searchable record (and expires unless renewed). Arc holds the money and the final judgement. Anyone can write to Arkiv, so Aegis only trusts an Arkiv record if an Arc report points back to it.

## 3. The checking algorithm (what happens when someone scans an address)

1. **Validate** the address (42 characters, hex).
2. **Read Arc**: every report filed against that address, in full.
3. **Read Arkiv**: records for that address on Arc Testnet.
4. **Cross-check**: keep an Arkiv record only if an Arc report has the same entity key, reporter, subject and evidence hash. Everything else is shown as "ignored".
5. **Collect extra signals** (each one is optional, and the result names any that did not run):
   - threat feeds you configured
   - fund tracing: recent token transfers in and out, checked against the registry
   - transaction simulation (Pre-sign check only): unlimited approvals, `setApprovalForAll`, permits, calls that would fail, transfers out of the sender
6. **Score** (each signal counts once, duplicates removed):

   | Signal | Points |
   |---|---|
   | Confirmed by the Arc reviewer | 100 (Critical, immediate) |
   | Dangerous simulation (drain to a flagged address) | 40 |
   | Threat feed (35 if two credible sources agree) | 30 |
   | Unlimited approval / approval-for-all | 25 |
   | Several open reports from different reporters (one reporter: 8) | 15 |
   | Fund-trace hit | 10 (5 if only open reports) |

   Unconfirmed addresses are capped at 99.
7. **Show** the level, the score and every reason. "Unknown" is never shown as "safe".

## 4. What you can truthfully demo today

| Mode | What it shows | What you need |
|---|---|---|
| **A. Live testnet** (best) | Real Arkiv + Arc transactions with explorer links | Deploy v2 first, a funded wallet (test USDC on Arc, tGLM on Arkiv Rabdi), an Arkiv access key |
| **B. Local Arc chain** (safest backup) | Full Arc side: stake, challenge, resolve, withdraw, issuer, scanner. **No real Arkiv writes** | Nothing but this repo |

State plainly which mode the video uses. Do not narrate mode B as "live on Arkiv".

Status as of this guide: the v1 registry is live and verified on Arc Testnet. The v2 (Arkiv link, staking, issuers) is built and tested but **not deployed until you run the deploy step**. It is not audited.

## 5. Preparing the demo, step by step

### 5.1 One day before

1. `npm ci && npm run test:all` (expect 13 + 12 passing) and `npm run build`.
2. Make a **throwaway** wallet. Fund it: test USDC on Arc Testnet (Circle faucet), tGLM on Arkiv Rabdi (https://hub.arkiv.network/faucet). Get an Arkiv access key at https://hub.arkiv.network/access-keys and restrict it to your demo origin.
3. Add the Rabdi and Arc networks to your browser wallet by connecting once through the app.
4. Deploy v2 and run the end-to-end check:
   ```bash
   export PRIVATE_KEY=0x…        # throwaway key only
   npm run deploy:registry -- <reviewer address> --write
   REGISTRY=<printed address> SUBJECT=<any 0x address> npm run e2e
   ```
   Set `VITE_REGISTRY_ADDRESS` and `VITE_ARKIV_ACCESS_KEY` in `.env`, then `npm run dev`.
5. Use a second wallet as the **reviewer** (the address you passed to the deploy) and a third as the **challenger**. Fund all three a little.
6. Pre-record nothing yet. Do one full dry run and note any step that fails or is slow.

### 5.2 Mode B setup (backup or primary if testnet is flaky)

```bash
node scripts/local-chain.mjs        # prints the registry address, leave it running
VITE_ARC_RPC_URL=http://127.0.0.1:8545 VITE_REGISTRY_ADDRESS=<printed address> npm run dev
```
The local chain starts with two seeded reports and one confirmed. Never expose it publicly.

### 5.3 Recording setup

- **Tools**: OBS Studio, Loom or QuickTime (any screen recorder). 1920x1080, 30 fps.
- **Browser**: a clean profile, bookmarks bar hidden, zoom 110 to 125 percent so text is readable. Close notifications.
- **Hide secrets**: never show a seed phrase, private key, `.env`, or the wallet's secret screens. Do not put `PRIVATE_KEY` in the terminal on camera.
- **Audio**: record the voice-over separately if you can. Quiet room, a headset mic, read slowly.
- **Have ready in tabs**: the app, Arc explorer, Arkiv explorer (https://rabdi.explorer.arkiv.network), and `docs/DEMO.md` for your own reference.
- **Pre-fill** the long values (addresses, evidence text) in a notes file so you paste instead of type.
- **Pace**: wallet prompts and confirmations can take 10 to 30 seconds. Cut the waiting in editing; do not pretend they were instant.

### 5.4 After recording

- Trim waiting time. Add captions (many viewers watch muted).
- Put a title card first and a "Testnet, not audited" line at the end.
- Export 1080p MP4, under 3 minutes for a pitch, or about 5 for a full walkthrough.
- Check the final video for any visible secret before uploading.

## 6. Demo video script (about 3 minutes)

Spoken text is in quotes. "SHOW" is what is on screen.

**0:00 to 0:15, Hook**
SHOW: title card, then the Overview page.
"Every day people lose funds by signing a transaction to a wallet they had no reason to distrust. Aegis lets you check before you sign, using evidence the community can verify."

**0:15 to 0:35, The idea**
SHOW: the workflow diagram from section 2 (screenshot it).
"A report lives on two chains. Arkiv holds the readable record. Arc holds the stake and the final judgement. Only the evidence hash is public, never the evidence itself."

**0:35 to 1:15, Submit a report (two wallet approvals)**
SHOW: Onchain platform, connect wallet, fill the form (address, category, short summary, evidence text).
"I enter the suspicious address, a category and a short public summary. I keep the evidence text private. When I submit, my wallet asks twice. First an Arkiv transaction creates the report entity. Then it switches to Arc and submits the report with a stake, linked to that Arkiv entity."
SHOW: both transaction links, then the explorer pages. Click "Download recovery package".
"I get both transaction hashes and a recovery package, because the evidence text exists only on my machine."

**1:15 to 1:45, Trust and challenge**
SHOW: switch to the challenger wallet, challenge the report with counter-evidence. Then the reviewer wallet resolves it (use mode B or a pre-aged report if the two-day window has not passed).
"Anyone can challenge. After the review window the reviewer confirms or rejects. If confirmed, my stake is refunded. If rejected, challengers split it, so false reports cost money."
SHOW: stake balance and the Withdraw button.

**1:45 to 2:20, Scan an address**
SHOW: Transaction scanner, paste the reported address, scan.
"Now anyone can scan. Aegis reads Arc, reads Arkiv, and only trusts an Arkiv record if Arc points back to it. This address is confirmed, so it is Critical."
SHOW: the reasons list. Then scan a clean address.
"For an address with no reports, Aegis says Unknown, never safe, and it lists which checks did not run."

**2:20 to 2:45, Pre-sign check**
SHOW: Pre-sign check form, paste a calldata with an unlimited approval, run it.
"Before signing, I can simulate a transaction. This one grants an unlimited token allowance, so Aegis flags it high risk and explains why."

**2:45 to 3:00, Close**
SHOW: issuer panel briefly, then the end card.
"Authorized issuers can record freeze requests on confirmed reports. Aegis is built and tested on Arc Testnet, not yet audited. Next: an independent audit, a multisig reviewer and mainnet. Aegis: check before you sign."

### Short 90-second cut
Keep: hook (0:15), submit report (0:30), scan the confirmed address (0:25), close (0:20). Skip challenge, pre-sign and issuer.

## 7. Likely questions, with honest answers

- **"Is this live on mainnet?"** No. Arc Testnet and the Arkiv Rabdi testnet. Not audited.
- **"Who decides what is a scam?"** A reviewer, after a two-day window with public challenges. It is a trust assumption, so production should use a multisig.
- **"Can anyone spam Arkiv?"** Yes, which is why Aegis ignores any Arkiv record Arc does not confirm.
- **"Can Aegis freeze funds?"** No. Issuers record requests; any freeze happens at the issuer, offchain.
- **"Does the pre-sign check catch everything?"** No. It catches known patterns and says when a check did not run. A clean result is not a guarantee.
- **"What is not built?"** Independent audit, multisig reviewer, mainnet, and live provider integrations for threat feeds (the feed format is ready).

## 8. Pre-recording checklist

- [ ] Tests and build pass
- [ ] v2 deployed and `npm run e2e` passed (mode A), or local chain running (mode B)
- [ ] Wallets funded: reporter, challenger, reviewer
- [ ] No secrets visible anywhere on screen
- [ ] You say which mode you are demoing
- [ ] "Testnet, not audited" appears in the video
