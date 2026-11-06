// Local development chain that mimics Arc Testnet's chain ID, seeded with a v2 registry and sample reports.
// Usage: node scripts/local-chain.mjs   then run the app with
//   VITE_ARC_RPC_URL=http://127.0.0.1:8545 VITE_REGISTRY_ADDRESS=<printed address> npm run dev
// Never expose this server publicly.
import fs from 'node:fs';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory, keccak256, parseEther, toUtf8Bytes } from 'ethers';

const PORT = Number(process.env.PORT || 8545);
const server = ganache.server({ logging: { quiet: true }, chain: { chainId: 5042002, hardfork: 'merge' }, wallet: { deterministic: true } });
await server.listen(PORT, '127.0.0.1');
const provider = new BrowserProvider(server.provider);
const [reviewer, reporter, other, subject] = await Promise.all([0, 1, 2, 3].map((i) => provider.getSigner(i)));
const artifact = JSON.parse(fs.readFileSync(new URL('../src/registry-artifact.json', import.meta.url)));
const c = await new ContractFactory(artifact.abi, artifact.bytecode, reviewer).deploy(await reviewer.getAddress());
await c.waitForDeployment();
const s = await subject.getAddress();
await (await c.connect(reporter).submit(s, keccak256(toUtf8Bytes('sample evidence A')), 'ipfs://example', keccak256(toUtf8Bytes('arkiv-key-A')), { value: parseEther('0.1') })).wait();
await (await c.connect(other).submit(s, keccak256(toUtf8Bytes('sample evidence B')), '', keccak256(toUtf8Bytes('arkiv-key-B')), { value: parseEther('0.1') })).wait();
await server.provider.request({ method: 'evm_increaseTime', params: [2 * 86400 + 1] });
await server.provider.request({ method: 'evm_mine', params: [] });
await (await c.resolve(0, true)).wait();
console.log(JSON.stringify({ rpc: `http://127.0.0.1:${PORT}`, registry: await c.getAddress(), reviewer: await reviewer.getAddress(), reportedSubject: s }, null, 2));
