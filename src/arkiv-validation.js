import {keccak256,toUtf8Bytes,isAddress} from 'ethers';
export function verifyReportBinding(report,stored){
 if(!isAddress(stored.creator)||!isAddress(stored.subject)||typeof stored.evidence!=='string')throw Error('Invalid Arkiv record');
 if(report.reporter.toLowerCase()!==stored.creator.toLowerCase())throw Error('Creator does not match the Arc reporter');
 if(report.subject.toLowerCase()!==stored.subject.toLowerCase())throw Error('Subject does not match the Arc report');
 if(report.evidenceHash!==stored.hash||keccak256(toUtf8Bytes(stored.evidence))!==report.evidenceHash)throw Error('Evidence does not match the Arc commitment');
 return true;
}
