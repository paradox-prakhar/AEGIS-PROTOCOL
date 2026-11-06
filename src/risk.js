export const sampleAddress='0x1111111111111111111111111111111111111111';
export function scan(address,reports=[]){
 if(!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error('Enter a valid 42-character EVM address.');
 const matches=reports.filter(r=>r.address.toLowerCase()===address.toLowerCase());
 if(address.toLowerCase()===sampleAddress) return {level:'High risk',score:94,reasons:['Matches the seeded demonstration threat registry.','Demo indicator: malicious token approval campaign.']};
 if(matches.length) return {level:'Under review',score:45,reasons:[`${matches.length} unverified local report(s). Community allegations are not proof.`]};
 return {level:'Unknown',score:null,reasons:['No matches in this local registry. This is not a safety verdict.','Live threat feeds and transaction simulation are not configured.']};
}
