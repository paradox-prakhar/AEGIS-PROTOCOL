// Read-only verification of a registry deployment against this repository's artifacts.
// Usage: node scripts/verify-deployment.mjs <txHash> <deployer> <reviewer> [--write]
// --write records the verified result in src/deployment.json (the frontend default).
import fs from 'node:fs';
import { Contract, ContractFactory, JsonRpcProvider, formatEther, isAddress } from 'ethers';

const args = process.argv.slice(2);
const write = args.includes('--write');
const [hash, deployer, reviewer] = args.filter((a) => a !== '--write');
if (!/^0x[0-9a-f]{64}$/i.test(hash || '') || !isAddress(deployer) || !isAddress(reviewer)) {
  throw new Error('Usage: node scripts/verify-deployment.mjs <txHash> <deployer> <reviewer> [--write]');
}
const load = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const artifacts = [load('../src/registry-artifact.json'), load('../src/registry-v1-artifact.json')];
const provider = new JsonRpcProvider(process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.io');
try {
  if ((await provider.getNetwork()).chainId !== 5042002n) throw new Error('Wrong network: expected Arc Testnet (5042002).');
  const [transaction, receipt] = await Promise.all([provider.getTransaction(hash), provider.getTransactionReceipt(hash)]);
  if (!transaction || !receipt || receipt.status !== 1 || !receipt.contractAddress) throw new Error('No successful deployment receipt.');
  if (transaction.to !== null || transaction.from.toLowerCase() !== deployer.toLowerCase()) throw new Error('Unexpected deployer or transaction destination.');
  let artifact;
  for (const a of artifacts) {
    const expected = await new ContractFactory(a.abi, a.bytecode).getDeployTransaction(reviewer);
    if (transaction.data.toLowerCase() === expected.data.toLowerCase()) { artifact = a; break; }
  }
  if (!artifact) throw new Error('Deployment bytecode or constructor arguments do not match any artifact in this repository.');
  const contract = new Contract(receipt.contractAddress, artifact.abi, provider);
  const [actualReviewer, count, code] = await Promise.all([contract.reviewer(), contract.reportCount(), provider.getCode(receipt.contractAddress)]);
  if (code === '0x') throw new Error('No code at the deployed address.');
  // v2 reviewers can rotate; report the current one rather than failing.
  if (artifact.version < 2 && actualReviewer.toLowerCase() !== reviewer.toLowerCase()) throw new Error('Deployed reviewer mismatch.');
  const result = {
    chainId: 5042002, version: artifact.version, registryAddress: receipt.contractAddress,
    transactionHash: hash, deployer: transaction.from, reviewer: actualReviewer,
    blockNumber: receipt.blockNumber, blockHash: receipt.blockHash,
    gasUsed: receipt.gasUsed.toString(), feeUSDC: formatEther(receipt.fee),
    reportCount: count.toString(), bytecodeAndConstructorVerified: true, verifiedAt: new Date().toISOString(),
  };
  console.log(JSON.stringify(result, null, 2));
  if (write) {
    const { reportCount, ...record } = result;
    fs.writeFileSync(new URL('../src/deployment.json', import.meta.url), JSON.stringify(record, null, 2) + '\n');
    console.error('Wrote src/deployment.json. Commit it and rebuild the frontend.');
  }
} finally {
  provider.destroy();
}
