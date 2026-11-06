import fs from 'node:fs';import solc from 'solc';
const file='contracts/AegisRegistry.sol';const input={language:'Solidity',sources:{'AegisRegistry.sol':{content:fs.readFileSync(file,'utf8')}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input)));for(const error of output.errors||[])if(error.severity==='error')throw Error(error.formattedMessage);
const c=output.contracts['AegisRegistry.sol'].AegisRegistry;fs.writeFileSync('src/registry-artifact.json',JSON.stringify({abi:c.abi,bytecode:'0x'+c.evm.bytecode.object},null,2));console.log('Registry compiled:',solc.version());
