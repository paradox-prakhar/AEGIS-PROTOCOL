import {BrowserProvider,Contract,ContractFactory,JsonRpcProvider,isAddress,keccak256,toUtf8Bytes} from 'ethers';
import artifact from './registry-artifact.json';
export const CHAIN_ID=5042002;
export const RPC=import.meta.env.VITE_ARC_RPC_URL||'https://rpc.testnet.arc.io';
export const EXPLORER='https://explorer.testnet.arc.io';
export const configuredRegistry=import.meta.env.VITE_REGISTRY_ADDRESS||'';
export async function connectWallet(){
 if(!window.ethereum)throw Error('Install MetaMask or an injected EVM wallet.');
 await window.ethereum.request({method:'eth_requestAccounts'});
 try{await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x4cef52'}]})}catch(e){if(e.code!==4902)throw e;await window.ethereum.request({method:'wallet_addEthereumChain',params:[{chainId:'0x4cef52',chainName:'Arc Testnet',nativeCurrency:{name:'USDC',symbol:'USDC',decimals:18},rpcUrls:[RPC],blockExplorerUrls:[EXPLORER]}]});}
 const provider=new BrowserProvider(window.ethereum);if((await provider.getNetwork()).chainId!==BigInt(CHAIN_ID))throw Error('Switch wallet to Arc Testnet.');return provider.getSigner();
}
export async function registry(address,write=false){
 if(!isAddress(address))throw Error('Configure a deployed registry address first.');
 const runner=write?await connectWallet():new JsonRpcProvider(RPC,CHAIN_ID);
 const provider=write?runner.provider:runner;
 if((await provider.getNetwork()).chainId!==BigInt(CHAIN_ID))throw Error('Incorrect network.');
 if(await provider.getCode(address)==='0x')throw Error('No contract deployed at this address.');
 return new Contract(address,artifact.abi,runner);
}
export async function deployRegistry(reviewer){if(!isAddress(reviewer))throw Error('Enter a valid reviewer address.');const signer=await connectWallet();const c=await new ContractFactory(artifact.abi,artifact.bytecode,signer).deploy(reviewer);await c.waitForDeployment();return c.getAddress()}
export function evidenceHash(text){return keccak256(toUtf8Bytes(text))}
export async function fetchReports(address){const c=await registry(address);const count=Number(await c.reportCount());const rows=[];for(let start=Math.max(0,count-100);start<count;start+=10){const batch=await Promise.all(Array.from({length:Math.min(10,count-start)},(_,j)=>c.reports(start+j)));batch.forEach((r,j)=>rows.push({id:start+j,reporter:r.reporter,address:r.subject,evidenceHash:r.evidenceHash,createdAt:Number(r.createdAt),status:['Pending','Challenged','Confirmed','Rejected'][Number(r.status)]}));}return rows.reverse()}
