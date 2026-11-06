import fs from 'node:fs';
import { Contract, ContractFactory, JsonRpcProvider, formatEther } from 'ethers';

const [hash, deployer, reviewer] = process.argv.slice(2);
if (!/^0x[0-9a-f]{64}$/i.test(hash || '')) throw new Error('Pass the deployment transaction hash, deployer and reviewer.');
const provider = new JsonRpcProvider(process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.io');
try {
  if ((await provider.getNetwork()).chainId !== 5042002n) throw new Error('Wrong network.');
  const artifact = JSON.parse(fs.readFileSync(new URL('../src/registry-artifact.json', import.meta.url)));
  const [transaction, receipt] = await Promise.all([provider.getTransaction(hash), provider.getTransactionReceipt(hash)]);
  if (!transaction || !receipt || receipt.status !== 1 || !receipt.contractAddress) throw new Error('No successful deployment receipt.');
  if (transaction.to !== null || transaction.from.toLowerCase() !== deployer.toLowerCase()) throw new Error('Unexpected deployer or transaction destination.');
  const expected = await new ContractFactory(artifact.abi, artifact.bytecode).getDeployTransaction(reviewer);
  if (transaction.data.toLowerCase() !== expected.data.toLowerCase()) throw new Error('Deployment bytecode or constructor arguments do not match this repository.');
  const contract = new Contract(receipt.contractAddress, artifact.abi, provider);
  const [actualReviewer, count, code] = await Promise.all([contract.reviewer(), contract.reportCount(), provider.getCode(receipt.contractAddress)]);
  if (code === '0x' || actualReviewer.toLowerCase() !== reviewer.toLowerCase()) throw new Error('Deployed contract verification failed.');
  console.log(JSON.stringify({chainId:5042002, registryAddress:receipt.contractAddress,
    transactionHash:hash, deployer:transaction.from, reviewer:actualReviewer,
    blockNumber:receipt.blockNumber, blockHash:receipt.blockHash,
    gasUsed:receipt.gasUsed.toString(), feeUSDC:formatEther(receipt.fee),
    reportCount:count.toString(), bytecodeAndConstructorVerified:true,
    verifiedAt:new Date().toISOString()}, null, 2));
} finally { provider.destroy(); }
