import {createPublicClient,createWalletClient,ExpirationTime} from '@arkiv-network/sdk';
import {rabdi} from '@arkiv-network/sdk/chains';
import {defineSchema,str,bytes} from '@arkiv-network/sdk/schema';
import {eq,and,asc} from '@arkiv-network/sdk/query';
import {http,custom,stringToBytes,hexToString} from 'viem';
import {verifyReportBinding} from './arkiv-validation';
import {isSimulatedEvidence,TEST_REPORTERS,isTestReporter} from './test-report';
import {activeRegistry,arkivRegistry as registry,sendRegistryTx,evidenceHash} from './chain';
export const arkivChain=rabdi({accessKey:import.meta.env.VITE_ARKIV_ACCESS_KEY||''});
export const Reports=defineSchema('aegis.arc.scam-reports.v1',{registry:str().indexed(),subject:str().indexed(),arcTx:str().indexed(),reportId:str(),hash:str(),evidence:bytes()});
const client=createPublicClient({chain:arkivChain,transport:http(undefined,{timeout:15000,retryCount:1})});
export async function publishReport(draft){
 const c=await registry(activeRegistry());const report=await c.reports(BigInt(draft.reportId));
 const receipt=await c.runner.getTransactionReceipt(draft.arcTx);
 if(!receipt||receipt.status!==1||!receipt.logs.some(log=>{try{const event=c.interface.parseLog(log);return log.address.toLowerCase()===activeRegistry().toLowerCase()&&event?.name==='Submitted'&&event.args.id===BigInt(draft.reportId)}catch{return false}}))throw Error('The Arc receipt does not contain this report.');
 if(report.subject.toLowerCase()!==draft.subject.toLowerCase()||report.evidenceHash!==evidenceHash(draft.evidence))throw Error('Evidence does not match the Arc report.');
 const wallet=await getArkivWallet();const account=wallet.account.address;
 if(account.toLowerCase()!==report.reporter.toLowerCase())throw Error('Use the wallet that submitted this Arc report.');
 const existing=await client.select({$key:true,arcTx:true}).from(Reports).where(and(eq('registry',activeRegistry().toLowerCase()),eq('arcTx',draft.arcTx))).createdBy(account).limit(1).fetch();
 if(existing.entities.length)return {entityKey:existing.entities[0].$key,txHash:null};
 return wallet.createEntity(Reports,{registry:activeRegistry().toLowerCase(),subject:draft.subject.toLowerCase(),arcTx:draft.arcTx,reportId:String(draft.reportId),hash:evidenceHash(draft.evidence),evidence:stringToBytes(draft.evidence)},{expiration:ExpirationTime.fromDays(30),flags:{readonly:true,permissionlessExtension:true}});
}
export async function searchReports(subject='',offset=0){
 const conditions=[eq('registry',activeRegistry().toLowerCase())];if(subject)conditions.push(eq('subject',subject.toLowerCase()));
 const page=await client.select().from(Reports).where(and(...conditions)).orderBy(asc('$key')).limit(10).offset(offset).fetch();
 const c=await registry(activeRegistry());
 const rows=await Promise.all(page.entities.map(async row=>{
  try{const r=await c.reports(BigInt(row.reportId.value));const evidence=hexToString(row.evidence.value);
   verifyReportBinding(r,{creator:row.$creator,subject:row.subject.value,hash:row.hash.value,evidence});
   return {key:row.$key,address:r.subject,reportId:row.reportId.value,evidence,status:['Pending','Challenged','Confirmed','Rejected'][Number(r.status)]};
  }catch{return {key:row.$key,status:'Unverified — excluded from reputation',address:row.subject.value,evidence:''}}}));
 return {rows,next:offset+page.entities.length+page.skipped,more:page.entities.length+page.skipped===10};
}
export async function submitArcReport(subject,evidence){
 const c=await registry(activeRegistry(),true);const hash=evidenceHash(evidence);
 if(isSimulatedEvidence(evidence)&&!isTestReporter(await c.runner.getAddress()))throw Error('Select a reviewed TEST reporting wallet: '+TEST_REPORTERS.join(' or '));
 const receipt=await sendRegistryTx(activeRegistry(),'submit',[subject,hash,'']);if(receipt.status!==1)throw Error('Arc transaction reverted.');
 for(const log of receipt.logs){if(log.address.toLowerCase()!==activeRegistry().toLowerCase())continue;try{const event=c.interface.parseLog(log);if(event?.name==='Submitted')return {subject,evidence,reportId:event.args.id.toString(),arcTx:receipt.hash}}catch{}}
 throw Error('No report event found. Check your wallet transaction before retrying.');
}

export const arkivPublicClient=client;
export async function getArkivWallet(){
 if(!window.ethereum)throw Error('Install MetaMask.');
 const [account]=await window.ethereum.request({method:'eth_requestAccounts'});
 const wallet=createWalletClient({chain:arkivChain,transport:custom(window.ethereum),account});
 try{await wallet.switchChain({id:arkivChain.id})}catch(e){if(e.code!==4902&&e.cause?.code!==4902)throw e;await wallet.addChain({chain:rabdi({accessKey:''})});await wallet.switchChain({id:arkivChain.id});}
 if(await wallet.getChainId()!==arkivChain.id)throw Error('Switch to Rabdi.');
 return wallet;
}
export async function renewArkivEntity(entityKey){if(!/^0x[0-9a-f]{64}$/i.test(entityKey))throw Error("Enter a valid Arkiv entity key.");const wallet=await getArkivWallet();return wallet.extendEntity({entityKey,expiration:ExpirationTime.fromDays(30)});}
