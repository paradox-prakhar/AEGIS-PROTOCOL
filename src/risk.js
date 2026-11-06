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

export const WEIGHTS = { confirmed: 100, multipleOpen: 15, singleOpen: 8, drain: 40, approval: 25, permit: 10, feed: 30, feedCorroborated: 35, traceConfirmed: 10, traceOpen: 5, cap: 99 };

const levelFor = (score, onlyReports) => (score >= 100 ? 'Critical' : score >= 70 ? 'High risk' : score >= 40 ? 'Elevated risk' : score > 0 ? (onlyReports ? 'Under review' : 'Caution') : 'Unknown');

/**
 * Risk from every connected signal. Arc adjudication decides; Arkiv, feeds, simulation and tracing only add
 * evidence. Each signal contributes once (the largest applicable weight), reports are de-duplicated by
 * reporter + evidence hash, and an unconfirmed address is capped at 99. A signal that did not run adds nothing
 * and is named in the reasons, so "Unknown" is never presented as "safe".
 */
export function assess({ arcRows = [], arkiv = null, arkivError = '', feeds = null, trace = null, simulation = null } = {}) {
  const seen = new Set();
  const unique = arcRows.filter((r) => {
    const k = `${String(r.reporter).toLowerCase()}:${String(r.evidenceHash).toLowerCase()}`;
    return seen.has(k) ? false : seen.add(k);
  });
  const confirmed = unique.filter((r) => r.status === 'Confirmed');
  const open = unique.filter((r) => r.status === 'Pending' || r.status === 'Challenged');
  const rejected = unique.filter((r) => r.status === 'Rejected');
  const reasons = [];
  const parts = [];
  if (open.length) {
    const reporters = new Set(open.map((r) => String(r.reporter).toLowerCase()));
    parts.push({ kind: 'reports', points: reporters.size > 1 ? WEIGHTS.multipleOpen : WEIGHTS.singleOpen });
    reasons.push(`${open.length} unadjudicated report(s) from ${reporters.size} reporter(s). Allegations are not proof.`);
  }
  if (feeds?.hits?.length) {
    const credible = feeds.hits.filter((h) => h.confidence >= 0.7);
    const sources = new Set(credible.map((h) => h.source));
    parts.push({ kind: 'feeds', points: sources.size > 1 ? WEIGHTS.feedCorroborated : credible.length ? WEIGHTS.feed : 10 });
    reasons.push(`Flagged by ${feeds.hits.map((h) => h.source + (h.category ? ` (${h.category})` : '')).join(', ')}.`);
  }
  if (simulation) {
    const codes = new Set(simulation.findings.map((f) => f.code));
    if (codes.has('DRAIN_TO_FLAGGED')) parts.push({ kind: 'simulation', points: WEIGHTS.drain });
    if (codes.has('UNLIMITED_APPROVAL') || codes.has('APPROVAL_FOR_ALL')) parts.push({ kind: 'approval', points: WEIGHTS.approval });
    else if (codes.has('PERMIT')) parts.push({ kind: 'approval', points: WEIGHTS.permit });
    for (const f of simulation.findings) if (f.severity !== 'info') reasons.push(f.text);
  }
  if (trace?.hits?.length) {
    parts.push({ kind: 'trace', points: trace.hits.some((h) => h.confirmed) ? WEIGHTS.traceConfirmed : WEIGHTS.traceOpen });
    reasons.push(`${trace.hits.length} counterpart${trace.hits.length > 1 ? 'ies' : 'y'} in recent transfers appear in the registry.`);
  }
  let score = Math.min(WEIGHTS.cap, parts.reduce((n, p) => n + p.points, 0));
  if (confirmed.length) {
    score = WEIGHTS.confirmed;
    reasons.unshift(`${confirmed.length} report(s) confirmed by the Arc registry reviewer.`);
  }
  if (rejected.length) reasons.push(`${rejected.length} report(s) were rejected after review.`);
  if (arkiv) {
    if (arkiv.linked.length) reasons.push(`${arkiv.linked.length} Arkiv record(s) verified against Arc.`);
    if (arkiv.unlinked.length) reasons.push(`${arkiv.unlinked.length} Arkiv record(s) have no matching Arc report. They are ignored: anyone can write to Arkiv.`);
  } else if (arkivError) reasons.push(`Arkiv could not be read (${arkivError}). Arc results are still shown.`);
  if (!confirmed.length && !parts.length) reasons.push(unique.length ? 'No active reports.' : 'No Arc reports found. This is not a safety verdict.');
  const notRun = [!feeds && 'threat feeds', !trace && 'fund tracing', !simulation && 'transaction simulation'].filter(Boolean);
  if (notRun.length) reasons.push(`Did not run: ${notRun.join(', ')}.`);
  if (feeds?.errors?.length) reasons.push(`Feed unavailable: ${feeds.errors.map((e) => `${e.source} (${e.error})`).join(', ')}.`);
  if (trace?.truncated) reasons.push('Fund tracing covered only part of the history (time or size limit).');
  const onlyReports = parts.every((p) => p.kind === 'reports');
  return { level: confirmed.length ? 'Critical' : levelFor(score, onlyReports), score: score === 0 && !confirmed.length ? null : score, danger: confirmed.length > 0 || score >= 70, reasons };
}
