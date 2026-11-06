// Deploys the v2 registry with a funded testnet key from the environment, then verifies it against this repo.
// Usage:  PRIVATE_KEY=0x… node scripts/deploy.mjs <reviewer> [--write]
// PRIVATE_KEY is read from the environment only and is never printed or written. Use a throwaway testnet key.
// ARC_RPC_URL overrides the default Arc Testnet RPC. --write records the result in src/deployment.json.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { ContractFactory, JsonRpcProvider, Wallet, formatEther, isAddress } from 'ethers';

const args = process.argv.slice(2);
const reviewer = args.find((a) => a.startsWith('0x'));
const key = process.env.PRIVATE_KEY;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('Set PRIVATE_KEY (0x + 64 hex) in the environment. Use a throwaway testnet key.');
if (!isAddress(reviewer)) throw new Error('Usage: PRIVATE_KEY=0x… node scripts/deploy.mjs <reviewer address> [--write]');

const rpc = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.io';
const provider = new JsonRpcProvider(rpc);
try {
  if ((await provider.getNetwork()).chainId !== 5042002n) throw new Error('Wrong network: expected Arc Testnet (5042002).');
  const wallet = new Wallet(key, provider);
  const balance = await provider.getBalance(wallet.address);
  console.error(`Deployer ${wallet.address} holds ${formatEther(balance)} USDC.`);
  if (balance < 10n ** 17n) throw new Error('Deployer needs at least ~0.1 test USDC for gas. Use the Circle faucet.');
  const artifact = JSON.parse(fs.readFileSync(new URL('../src/registry-artifact.json', import.meta.url)));
  const contract = await new ContractFactory(artifact.abi, artifact.bytecode, wallet).deploy(reviewer);
  const hash = contract.deploymentTransaction().hash;
  console.error(`Deployment submitted: ${hash}`);
  await contract.waitForDeployment();
  console.error(`Registry deployed at ${await contract.getAddress()}. Verifying…`);
  const verify = spawnSync(process.execPath, [new URL('./verify-deployment.mjs', import.meta.url).pathname, hash, wallet.address, reviewer, ...(args.includes('--write') ? ['--write'] : [])], { stdio: 'inherit', env: { ...process.env, PRIVATE_KEY: '' } });
  if (verify.status !== 0) throw new Error('Deployed, but verification against the repository artifact failed.');
} finally {
  provider.destroy();
}
