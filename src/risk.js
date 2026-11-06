export const sampleAddress='0x1111111111111111111111111111111111111111';
export function scan(address,reports=[]){
 if(!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error('Enter a valid 42-character EVM address.');
 const matches=reports.filter(r=>r.address.toLowerCase()===address.toLowerCase());
 if(address.toLowerCase()===sampleAddress) return {level:'High risk',score:94,reasons:['Matches the seeded demonstration threat registry.','Demo indicator: malicious token approval campaign.']};
 if(matches.length) return {level:'Under review',score:45,reasons:[`${matches.length} unverified local report(s). Community allegations are not proof.`]};
 return {level:'Unknown',score:null,reasons:['No matches in this local registry. This is not a safety verdict.','Live threat feeds and transaction simulation are not configured.']};
}

const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

/**
 * Arkiv is writable by anyone, so an Arkiv entity is trusted only when an Arc report links back to it:
 * same entity key, reporter, subject and evidence hash. Everything else is an unlinked allegation.
 */
export function crossCheck(arkivEntities = [], arcRows = []) {
  const linked = [];
  const unlinked = [];
  for (const e of arkivEntities) {
    const arc = arcRows.find((r) => same(r.arkivEntityKey, e.entityKey) && same(r.reporter, e.reporter) && same(r.address, e.subject) && same(r.evidenceHash, e.evidenceHash));
    if (arc) linked.push({ ...e, arc });
    else unlinked.push(e);
  }
  return { linked, unlinked };
}

export const WEIGHTS = { confirmed: 100, multipleOpen: 15, singleOpen: 8, cap: 99 };

/**
 * Registry-derived risk. Arc adjudication decides; Arkiv only corroborates. Rejected reports add nothing.
 * Reports are de-duplicated by reporter + evidence hash so one incident is never counted twice.
 * Transaction simulation, approval and interaction-history checks are not connected, so they are absent
 * from the score and the result says so.
 */
export function assess({ arcRows = [], arkiv = null, arkivError = '' } = {}) {
  const seen = new Set();
  const unique = arcRows.filter((r) => {
    const k = `${String(r.reporter).toLowerCase()}:${String(r.evidenceHash).toLowerCase()}`;
    return seen.has(k) ? false : seen.add(k);
  });
  const confirmed = unique.filter((r) => r.status === 'Confirmed');
  const open = unique.filter((r) => r.status === 'Pending' || r.status === 'Challenged');
  const rejected = unique.filter((r) => r.status === 'Rejected');
  const reasons = [];
  let score = 0;
  let level = 'Unknown';
  if (confirmed.length) {
    score = WEIGHTS.confirmed;
    level = 'Critical';
    reasons.push(`${confirmed.length} report(s) confirmed by the Arc registry reviewer.`);
  } else if (open.length) {
    const reporters = new Set(open.map((r) => String(r.reporter).toLowerCase()));
    score = Math.min(WEIGHTS.cap, reporters.size > 1 ? WEIGHTS.multipleOpen : WEIGHTS.singleOpen);
    level = 'Under review';
    reasons.push(`${open.length} unadjudicated report(s) from ${reporters.size} reporter(s). Allegations are not proof.`);
  }
  if (rejected.length) reasons.push(`${rejected.length} report(s) were rejected after review.`);
  if (arkiv) {
    if (arkiv.linked.length) reasons.push(`${arkiv.linked.length} Arkiv record(s) verified against Arc.`);
    if (arkiv.unlinked.length) reasons.push(`${arkiv.unlinked.length} Arkiv record(s) have no matching Arc report. They are ignored: anyone can write to Arkiv.`);
  } else if (arkivError) reasons.push(`Arkiv could not be read (${arkivError}). Arc results are still shown.`);
  if (!confirmed.length && !open.length) reasons.push(unique.length ? 'No active reports.' : 'No Arc reports found. This is not a safety verdict.');
  reasons.push('Transaction simulation, approval and interaction-history checks are not connected.');
  return { level, score: level === 'Unknown' ? null : score, danger: confirmed.length > 0, reasons };
}
