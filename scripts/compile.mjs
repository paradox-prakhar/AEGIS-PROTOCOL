// Compiles the Solidity sources and writes frontend artifacts plus explorer verification inputs.
// v1 is deployed and its artifact (src/registry-v1-artifact.json) is frozen. The v1 source is only
// recompiled to prove its executable code still matches the frozen artifact (metadata hash excluded).
import fs from 'node:fs';
import solc from 'solc';

const SETTINGS = {
  optimizer: { enabled: true, runs: 200 },
  evmVersion: 'paris',
  outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
};

const targets = [
  { name: 'AegisRegistry', file: 'contracts/AegisRegistry.sol', unit: 'AegisRegistry.sol', out: 'src/registry-artifact.json', version: 2 },
  { name: 'AegisRegistry', file: 'contracts/legacy/AegisRegistryV1.sol', unit: 'AegisRegistry.sol', out: 'src/registry-v1-artifact.json', version: 1, frozen: true },
];

fs.mkdirSync('artifacts', { recursive: true });
for (const t of targets) {
  const input = { language: 'Solidity', sources: { [t.unit]: { content: fs.readFileSync(t.file, 'utf8') } }, settings: SETTINGS };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((e) => e.severity === 'error');
  if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join('\n'));
  for (const w of output.errors || []) if (w.severity === 'warning') console.warn(w.formattedMessage);
  const c = output.contracts[t.unit][t.name];
  const runtimeSize = c.evm.deployedBytecode.object.length / 2;
  if (runtimeSize > 24576) throw new Error(`${t.file} exceeds the EIP-170 size limit (${runtimeSize} bytes).`);
  if (t.frozen) {
    const frozen = JSON.parse(fs.readFileSync(t.out, 'utf8'));
    const strip = (hex) => hex.slice(0, hex.lastIndexOf('a264697066735822'));
    if (strip(frozen.bytecode) !== strip('0x' + c.evm.bytecode.object)) throw new Error(`${t.file} no longer matches the frozen deployed artifact.`);
    console.log(`Verified ${t.file} matches the frozen v1 artifact (executable code).`);
    continue;
  }
  fs.writeFileSync(t.out, JSON.stringify({ version: t.version, compiler: solc.version(), abi: c.abi, bytecode: '0x' + c.evm.bytecode.object }, null, 2) + '\n');
  // Standard JSON input: upload to the block explorer for source verification.
  const verifyInput = { ...input, settings: { ...SETTINGS, outputSelection: { '*': { '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'metadata'] } } } };
  fs.writeFileSync(`artifacts/AegisRegistry.v${t.version}.standard-input.json`, JSON.stringify(verifyInput, null, 2) + '\n');
  console.log(`Compiled ${t.file} (v${t.version}, ${runtimeSize} runtime bytes) with solc ${solc.version()}`);
}
