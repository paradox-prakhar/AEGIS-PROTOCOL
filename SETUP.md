# Arc Testnet setup and deployment

## Existing shared deployment — use this first

The registry is already deployed at `0x5eD536a9a2856109E4a02016ad2a99B3865e91F0`. The app uses this address by default. Open **Onchain platform**, click **Connect & switch to Arc Testnet**, then **Load shared registry**. You do not need to deploy again. To submit a report, fill in the suspected address and evidence, then sign the report transaction in MetaMask. The deployment steps below are for creating a separate registry.

Deployment transaction: https://explorer.testnet.arc.io/tx/0x412009386d92830e4ecc3bf173531f8f1e8ad15b02ef0c5a84ec6259ca429047 . Actual deployment fee: 0.014171725 test USDC.

## 1. Wallet and free test tokens

1. Install MetaMask from https://metamask.io/download/ and create a dedicated test wallet. Keep its recovery phrase offline. Do not send a private key to this chat.
2. Open https://faucet.circle.com/ , select Arc Testnet and USDC, and enter the public wallet address. Follow any faucet verification or cooldown displayed by Circle. Test tokens have no cash value.
3. In Aegis, select Onchain platform, then Connect & switch to Arc Testnet. Approve account access and the network prompt.
4. Confirm the wallet shows a nonzero USDC balance before deployment. Arc uses native USDC for gas; no ETH is needed on Arc. Do not assume a fixed gas amount: the wallet shows an estimate before you sign. Request more test tokens if required.

Verified network configuration: chain ID 5042002; RPC https://rpc.testnet.arc.io ; explorer https://explorer.testnet.arc.io . See https://docs.arc.io/arc/references/connect-to-arc . Native gas uses 18 decimals. Any future ERC-20 USDC staking must use that interface's decimals rather than native units.

## 2. Deploy through your wallet

1. Run `npm ci` and `npm run dev` in this folder.
2. Open Onchain platform and connect your funded test wallet.
3. Verify the reviewer field is `0xe558716de7B4af56A5cD472Ce323Ad5cb5F445Af`. This address will control report adjudication; the deployer may be a different wallet.
4. Click Deploy registry with wallet. Review the chain, deployment and gas fee in MetaMask, then sign if correct.
5. Wait for confirmation. Copy the deployed registry address shown in the app and verify it on the explorer. Deployment does not transfer ownership of your wallet.
6. Copy `.env.example` to `.env.local`. Set `VITE_REGISTRY_ADDRESS` to the deployed address. Restart the development server or rebuild the frontend. These are public frontend settings, never secrets.
7. Use this one contract address across all clients. Do not deploy a new registry for every user.

## 3. Exercise the onchain workflow

1. Load the shared registry.
2. Paste a synthetic suspected address and at least 20 characters of evidence. Save an exact copy of that evidence independently: the contract stores only its Keccak-256 hash.
3. Sign & submit report; open the transaction link and wait for confirmation.
4. From a second wallet, submit a challenge with the report ID and evidence. Reload to verify Challenged status.
5. After two days from report creation, connect the reviewer wallet and confirm or reject the allegation. No other wallet can resolve it.
6. Open another browser session configured with the same contract address; load the registry and verify the shared result.
7. Create a local recovery incident and export the evidence JSON. This does not send an issuer request.

## 4. APIs and accounts

| Service | Needed now? | Where / purpose |
| --- | --- | --- |
| Injected wallet | Yes | https://metamask.io/download/ ; user signs transactions, no API key |
| Arc RPC | Yes, public default included | https://docs.arc.io/arc/references/connect-to-arc ; contract reads and receipt polling |
| Circle faucet | Yes, for test funds | https://faucet.circle.com/ ; test USDC for gas |
| Dedicated RPC provider | Before public scale | Choose a provider from Arc's official network page; provision an endpoint and use `VITE_ARC_RPC_URL` only if it is intended to be browser-public and origin-restricted |
| IPFS pinning | Future integration | https://docs.pinata.cloud/ ; evidence availability, requires server-side credentials and explicit publication consent |
| Transaction simulation | Future integration | https://docs.tenderly.co/ ; verify Arc support and coverage before purchasing or configuring. No Tenderly integration exists in this code |
| Indexer and durable database | Before production | Provision an indexer and managed PostgreSQL service to support complete registry history and authenticated incident storage; backend implementation still required |
| Issuer coordination | External authorization required | Contact the relevant issuer through its official incident/legal process. No generic public API lets this app freeze third-party funds |

The implemented wallet/contract path requires no Circle API key, WalletConnect project ID, IPFS key or hosted backend. Additional services above are integration requirements, not features activated merely by adding a key.

## 5. Publish frontend

1. Deploy the repository to a static Vite-capable host.
2. Set the public `VITE_ARC_RPC_URL` and `VITE_REGISTRY_ADDRESS` environment values.
3. Build command: `npm run build`. Output directory: `dist`.
4. Enable HTTPS, an appropriate Content Security Policy and RPC origin restrictions. Rebuild whenever public configuration changes.
5. Smoke-test connection, rejection handling, submission receipts, shared reads and wrong-network behavior with dedicated test wallets.

## Deployment status

The shared Arc Testnet registry is live. Its receipt, creation bytecode, constructor reviewer and deployed reviewer were verified against this repository. Deployment metadata is in `src/deployment.json`. This verification is not a security audit or a production-readiness certification.

## Funded deployment wallet

The selected deployer is `0x2Df43B66A31cd93792E4a32Af494b5a18c614148`; the reviewer remains `0xe558716de7B4af56A5cD472Ce323Ad5cb5F445Af`. These roles may use different wallets. The reviewer also needs test USDC for the gas on adjudication transactions.

Set `VITE_DEPLOYER_ADDRESS` in `.env.local` to restrict the deployment button to the intended funded wallet. The app immediately displays a deployment transaction link and saves a confirmed registry address in this browser. The local scanner uses that address until `VITE_REGISTRY_ADDRESS` is configured. For all other users and hosted environments, configure the shared registry address explicitly.

Run a read-only gas/balance check before deploying:

```sh
node scripts/deployment-check.mjs 0x2Df43B66A31cd93792E4a32Af494b5a18c614148 0xe558716de7B4af56A5cD472Ce323Ad5cb5F445Af
```

The script requires no key and sends no transaction. If a deployment is submitted but confirmation is interrupted, check the transaction link on the explorer before attempting another deployment.
