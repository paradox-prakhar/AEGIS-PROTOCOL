import React, {useState} from 'react';
import {isAddress} from 'ethers';
import {submitArcReport,publishReport,searchReports,arkivChain} from './arkiv';
import {EXPLORER,activeRegistry,evidenceHash} from './chain';
import {TEST_SUBJECT,TEST_REPORTERS,TEST_EVIDENCE_TEXT,isSimulatedEvidence} from './test-report';

function download(name,value){
 const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function ArkivReports(){
 const [subject,setSubject]=useState(''),[evidence,setEvidence]=useState('');
 const [review,setReview]=useState(null),[arcConsent,setArcConsent]=useState(false),[storageConsent,setStorageConsent]=useState(false);
 const [draft,D]=useState(null),[busy,B]=useState(false),[error,E]=useState(''),[message,M]=useState('');
 const [rows,R]=useState([]),[query,Q]=useState(''),[offset,O]=useState(0),[more,N]=useState(false),[stored,S]=useState(null);
 async function run(fn){B(true);E('');try{await fn()}catch(e){E(e.shortMessage||e.message)}finally{B(false)}}
 function invalidate(){setReview(null);setArcConsent(false)}
 function prepare(s,e){
  if(!isAddress(s)||e.length<20||e.length>5000)throw Error('Enter a valid address and 20–5000 characters of evidence.');
  setReview({subject:s,evidence:e,hash:evidenceHash(e),registry:activeRegistry(),simulated:isSimulatedEvidence(e)});
  setArcConsent(false);setStorageConsent(false);E('');M('Review only. No wallet request or transaction has been sent.');
 }
 async function find(reset){
  if(query&&!isAddress(query))throw Error('Enter a valid wallet address.');
  const page=await searchReports(query,reset?0:offset);R(reset?page.rows:[...rows,...page.rows]);O(page.next);N(page.more);
  M('Loaded Arkiv records; decisions checked against Arc.');
 }
 return <section className="panel">
  <h3>Scam reports · Arc + Arkiv</h3>
  <p>Review the exact evidence first. Then sign separately on Arc and Arkiv.</p>
  <div className="info">Arkiv evidence is public and stored for 30 days. Preserve an export and arrange renewal before expiry. Reports remain allegations until reviewed.</div>
  {error&&<div role="alert" className="alert">{error}</div>}
  {message&&<div role="status" className="notice">{message}</div>}
  <button className="secondary" disabled={busy||!!draft} onClick={()=>{setSubject(TEST_SUBJECT);setEvidence(TEST_EVIDENCE_TEXT);prepare(TEST_SUBJECT,TEST_EVIDENCE_TEXT)}}>Prepare TEST / SIMULATED report — no transaction</button>
  <div className="twocol">
   <div>
    <form onSubmit={event=>{event.preventDefault();try{prepare(subject,evidence)}catch(e){E(e.message)}}}>
     <h3 style={{marginTop:24}}>1. Prepare and review</h3>
     <label>Reported wallet<input value={subject} onChange={e=>{setSubject(e.target.value);invalidate()}} required pattern="0x[a-fA-F0-9]{40}" disabled={busy||!!draft}/></label>
     <label>Exact public evidence<textarea value={evidence} onChange={e=>{setEvidence(e.target.value);invalidate()}} required minLength={20} maxLength={5000} disabled={busy||!!draft}/></label>
     <button className="secondary" disabled={busy||!!draft}>Review report — no transaction</button>
    </form>
    {review&&<div className="info" aria-label="Report review">
     <h3>{review.simulated?'TEST / SIMULATED — unsigned review':'Unsigned report review'}</h3>
     {review.simulated&&<p>No real victim or scam allegation. The mock transaction hash is fictional and is not a receipt.</p>}
     <p className="mono">Subject: {review.subject}<br/>Registry: {review.registry}<br/>Evidence hash: {review.hash}</p>
     {review.simulated&&<p className="mono">Expected signing wallet: {TEST_REPORTERS.join(' or ')}</p>}
     <p>Arc Testnet · 5042002. Initial status after confirmation: PENDING REVIEW. No asset transfer; test USDC pays gas.</p>
     <p>Arkiv Rabdi · 7794095. Entity reference: NOT CREATED. After its separate transaction confirms, the Arkiv record will link to the Arc report ID, receipt and this exact evidence hash.</p>
     <p>The current v1 Arc registry stores the evidence hash, not an Arkiv URI or test flag. TEST labels are contained in the evidence.</p>
     <details><summary>Read the exact evidence to be published</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{review.evidence}</pre></details>
     <button className="secondary" onClick={()=>download('aegis-unsigned-review.json',{label:review.simulated?'TEST / SIMULATED':'REPORT',unsigned:true,...review,arkivEntityReference:null,arcTransactionHash:null,proposedStatus:'PENDING REVIEW'})}>Download unsigned review</button>
     <label><input style={{width:'auto',marginRight:8}} type="checkbox" checked={arcConsent} disabled={busy||!!draft} onChange={e=>setArcConsent(e.target.checked)}/>I reviewed this exact report and want to request the Arc transaction.</label>
     <button className="primary" disabled={busy||!!draft||!arcConsent} onClick={()=>run(async()=>{
      if(activeRegistry().toLowerCase()!==review.registry.toLowerCase())throw Error('Registry changed. Review again.');
      const result=await submitArcReport(review.subject,review.evidence);D(result);S(null);setStorageConsent(false);
      M(`${review.simulated?'TEST / SIMULATED: ':''}Arc confirmed. Status: PENDING REVIEW. Export the recovery copy before continuing.`);
     })}>Request Arc signature</button>
    </div>}
   </div>
   <div>
    <h3 style={{marginTop:24}}>2. Store the confirmed report in Arkiv</h3>
    <p>The same wallet needs tGLM on Rabdi. Arkiv publishing requires a second signature.</p>
    <a href="https://hub.arkiv.network/faucet" target="_blank" rel="noreferrer">Get test tGLM ↗</a>
    {draft&&<div className="info">
     <b>{isSimulatedEvidence(draft.evidence)?'TEST / SIMULATED':'Report'} · Arc report #{draft.reportId}</b>
     <p><a href={`${EXPLORER}/tx/${draft.arcTx}`} target="_blank" rel="noreferrer">Confirmed Arc receipt ↗</a></p>
     <button className="secondary" onClick={()=>download('aegis-arkiv-report.json',draft)}>Export / save recovery copy</button>
     <details><summary>Review exact Arkiv payload</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({registry:activeRegistry().toLowerCase(),subject:draft.subject.toLowerCase(),arcTx:draft.arcTx,reportId:draft.reportId,hash:evidenceHash(draft.evidence),evidence:draft.evidence},null,2)}</pre></details>
     <p>Public storage: 30 days. Content is read-only; anyone may pay to extend retention. Entity key is assigned after confirmation.</p>
     <label><input style={{width:'auto',marginRight:8}} type="checkbox" checked={storageConsent} disabled={busy||!!stored} onChange={e=>setStorageConsent(e.target.checked)}/>I reviewed the payload and agree to publish it publicly on Arkiv.</label>
    </div>}
    <label>Resume a confirmed Arc report export<input type="file" accept="application/json" disabled={busy||!!draft} onChange={event=>{const file=event.target.files[0];run(async()=>{
     if(!file||file.size>20000)throw Error('Choose an exported report smaller than 20 KB.');
     const d=JSON.parse(await file.text());
     if(!isAddress(d.subject)||!/^\d+$/.test(d.reportId)||typeof d.evidence!=='string'||d.evidence.length>5000||!/^0x[\da-f]{64}$/i.test(d.arcTx))throw Error('Choose the confirmed Arc recovery export, not the unsigned review file.');
     D(d);S(null);setStorageConsent(false);M('Imported for review. Arc receipt and evidence will be checked before publishing.');
    })}}/></label>
    <button className="primary" disabled={busy||!draft||!!stored||!storageConsent} onClick={()=>run(async()=>{
     const result=await publishReport(draft);S(result);M(`${isSimulatedEvidence(draft.evidence)?'TEST / SIMULATED: ':''}${result.txHash?'Arkiv transaction confirmed.':'Existing Arkiv entity found; no new write.'}`);
    })}>Request Arkiv signature</button>
    {stored&&<div className="info"><b>{isSimulatedEvidence(draft.evidence)?'TEST / SIMULATED · ':''}Arkiv record</b><p className="mono">Entity: {stored.entityKey}<br/>Reference: arkiv://7794095/{stored.entityKey}</p>{stored.txHash&&<a href={`${arkivChain.blockExplorers.default.url}/tx/${stored.txHash}`} target="_blank" rel="noreferrer">Confirmed Arkiv receipt ↗</a>}<button className="secondary" onClick={()=>download('aegis-linked-report.json',{...draft,arkivEntityKey:stored.entityKey,arkivReference:`arkiv://7794095/${stored.entityKey}`,arkivTransactionHash:stored.txHash})}>Export linked report</button></div>}
   </div>
  </div>
  <h3 style={{marginTop:30}}>Search shared Arkiv records</h3>
  <form onSubmit={e=>{e.preventDefault();run(()=>find(true))}}><label>Wallet address (blank shows all)<input value={query} onChange={e=>Q(e.target.value)}/></label><button className="secondary" disabled={busy}>Search Arkiv</button></form>
  {rows.map((r,i)=><article className="record" key={r.key+':'+i}><span className="badge">{isSimulatedEvidence(r.evidence)?'TEST / SIMULATED · ':''}{r.status}</span><p className="mono">{r.address}</p><p>{r.evidence}</p><small>Arc report #{r.reportId||'unknown'}</small></article>)}
  {more&&<button disabled={busy} className="secondary" onClick={()=>run(()=>find(false))}>Load more</button>}
  <p>Challenge and resolution transactions are under Onchain platform. Only the reviewer can resolve after two days.</p>
 </section>;
}
