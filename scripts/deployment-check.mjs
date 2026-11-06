import fs from 'node:fs';
import { ContractFactory, JsonRpcProvider, formatEther, isAddress } from 'ethers';

// Read-only: no private key, signature or transaction submission.
const [deployer, reviewer] = process.argv.slice(2);
if (!isAddress(deployer) || !isAddress(reviewer)) {
  throw new Error('Usage: node scripts/deployment-check.mjs <deployer> <reviewer>');
}
const provider = new JsonRpcProvider(process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.io');
try {
  const network = await provider.getNetwork();
  if (network.chainId !== 5042002n) throw new Error('Expected Arc Testnet (5042002).');
  const artifact = JSON.parse(fs.readFileSync(new URL('../src/registry-artifact.json', import.meta.url)));
  const request = await new ContractFactory(artifact.abi, artifact.bytecode).getDeployTransaction(reviewer);
  const [balance, reviewerBalance, gas, fees, nonce] = await Promise.all([
    provider.getBalance(deployer), provider.getBalance(reviewer),
    provider.estimateGas({ ...request, from: deployer }), provider.getFeeData(),
    provider.getTransactionCount(deployer),
  ]);
  const price = fees.maxFeePerGas ?? fees.gasPrice;
  if (price === null) throw new Error('RPC did not return fee information.');
  const bufferedGas = gas * 120n / 100n;
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(), chainId: Number(network.chainId),
    deployer, reviewer, deployerBalanceUSDC: formatEther(balance),
    reviewerBalanceUSDC: formatEther(reviewerBalance), nonce,
    estimatedGas: gas.toString(), bufferedGasLimit: bufferedGas.toString(),
    estimatedMaxFeeUSDC: formatEther(bufferedGas * price),
    enoughForEstimatedFee: balance >= bufferedGas * price,
    note: 'Estimate only; review the current fee in your wallet before signing.',
  }, null, 2));
} finally {
  provider.destroy();
}
