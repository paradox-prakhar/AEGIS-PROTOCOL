import test from 'node:test';import assert from 'node:assert/strict';import {scan,sampleAddress} from './risk.js';
test('reject malformed addresses',()=>assert.throws(()=>scan('0x123')));
test('demo threat flagged',()=>assert.equal(scan(sampleAddress).score,94));
test('unknown is never safe',()=>assert.equal(scan('0x'+'2'.repeat(40)).level,'Unknown'));
test('reports are allegations',()=>assert.equal(scan('0x'+'a'.repeat(40),[{address:'0x'+'A'.repeat(40)}]).level,'Under review'));

import { crossCheck, assess } from './risk.js';
const A = '0x1111111111111111111111111111111111111111', R1 = '0x2222222222222222222222222222222222222222', R2 = '0x3333333333333333333333333333333333333333';
const K1 = '0x' + 'aa'.repeat(32), K2 = '0x' + 'bb'.repeat(32), H1 = '0x' + '01'.repeat(32);
const arc = (o) => ({ reporter: R1, address: A, evidenceHash: H1, arkivEntityKey: K1, status: 'Pending', ...o });
const ark = (o) => ({ entityKey: K1, subject: A, reporter: R1, evidenceHash: H1, ...o });

test('crossCheck trusts only Arkiv entities that Arc links back to, matching reporter and evidence', () => {
  const r = crossCheck([ark({}), ark({ entityKey: K2 }), ark({ reporter: R2 })], [arc({})]);
  assert.equal(r.linked.length, 1);
  assert.equal(r.unlinked.length, 2);
  assert.equal(crossCheck([ark({ evidenceHash: '0x' + '02'.repeat(32) })], [arc({})]).linked.length, 0);
});

test('assess: confirmed is critical, open is capped, duplicates are not double counted', () => {
  assert.deepEqual([assess({ arcRows: [arc({ status: 'Confirmed' })] }).level, assess({ arcRows: [arc({ status: 'Confirmed' })] }).score], ['Critical', 100]);
  assert.equal(assess({ arcRows: [arc({}), arc({})] }).score, 8);
  assert.equal(assess({ arcRows: [arc({}), arc({ reporter: R2, arkivEntityKey: K2 })] }).score, 15);
  assert.ok(assess({ arcRows: [arc({}), arc({ reporter: R2, arkivEntityKey: K2 })] }).score <= 99);
  const none = assess({ arcRows: [] });
  assert.equal(none.score, null);
  assert.equal(none.level, 'Unknown');
});

test('assess: unlinked Arkiv records never raise the score and Arkiv failure is non-fatal', () => {
  const r = assess({ arcRows: [], arkiv: { linked: [], unlinked: [ark({})] } });
  assert.equal(r.score, null);
  assert.ok(r.reasons.some((x) => x.includes('ignored')));
  assert.ok(assess({ arcRows: [arc({ status: 'Rejected' })], arkivError: 'timeout' }).reasons.some((x) => x.includes('Arkiv could not be read')));
});

import { expiryInfo, recoveryPackage } from './arkiv-meta.js';
test('expiryInfo converts blocks to days and flags renewal', () => {
  const t = { currentBlock: 1000n, blockDuration: 2 };
  assert.equal(expiryInfo(1000n + 43200n, t).daysLeft, 1);
  assert.equal(expiryInfo(1000n + 43200n, t).needsRenewal, true);
  assert.equal(expiryInfo(1000n + 43200n * 90n, t).needsRenewal, false);
  const gone = expiryInfo(900n, t);
  assert.deepEqual([gone.expired, gone.secondsLeft], [true, 0]);
  assert.equal(recoveryPackage({ reporter: '0x1' }).kind, 'recovery-package');
});

import { analyzeCalldata, outgoingTransfers, parseFeeds, queryFeeds, simulateTransaction, traceFunds, TRANSFER_TOPIC } from './signals.js';
import { Interface, MaxUint256, zeroPadValue } from 'ethers';
const I = new Interface(['function approve(address,uint256)', 'function setApprovalForAll(address,bool)', 'function transfer(address,uint256)']);
const SP = '0x4444444444444444444444444444444444444444';

test('analyzeCalldata flags unlimited approvals and setApprovalForAll but not ordinary calls', () => {
  assert.equal(analyzeCalldata(I.encodeFunctionData('approve', [SP, MaxUint256]))[0].code, 'UNLIMITED_APPROVAL');
  assert.equal(analyzeCalldata(I.encodeFunctionData('approve', [SP, 5n]))[0].code, 'TOKEN_APPROVAL');
  assert.equal(analyzeCalldata(I.encodeFunctionData('setApprovalForAll', [SP, true]))[0].code, 'APPROVAL_FOR_ALL');
  assert.equal(analyzeCalldata(I.encodeFunctionData('setApprovalForAll', [SP, false])).length, 0);
  assert.equal(analyzeCalldata(I.encodeFunctionData('transfer', [SP, 1n])).length, 0);
  assert.equal(analyzeCalldata('0x', { value: 1n })[0].code, 'NATIVE_TRANSFER');
  assert.equal(analyzeCalldata('0xdeadbeef').length, 0);
});

test('simulateTransaction: revert, drain to flagged address, and unsupported asset simulation', async () => {
  const from = '0x5555555555555555555555555555555555555555';
  const log = { address: '0x6666666666666666666666666666666666666666', topics: [TRANSFER_TOPIC, zeroPadValue(from, 32), zeroPadValue(SP, 32)], data: '0x' + (10n).toString(16).padStart(64, '0') };
  assert.equal(outgoingTransfers([log], from).length, 1);
  const base = { getCode: async () => '0x1234', call: async () => '0x', estimateGas: async () => 21000n };
  const drain = await simulateTransaction({ ...base, send: async () => [{ calls: [{ logs: [log] }] }] }, { from, to: SP, data: '0x' }, { isFlagged: async (a) => a === SP });
  assert.ok(drain.findings.some((f) => f.code === 'DRAIN_TO_FLAGGED'));
  assert.equal(drain.assetChangesChecked, true);
  const reverts = await simulateTransaction({ ...base, call: async () => { throw Object.assign(new Error('x'), { reason: 'nope' }); } }, { from, to: SP });
  assert.equal(reverts.willRevert, true);
  const plain = await simulateTransaction({ ...base, send: async () => { throw new Error('method not found'); } }, { from, to: SP });
  assert.equal(plain.assetChangesChecked, false);
  assert.ok(plain.notes[0].includes('not supported'));
  await assert.rejects(simulateTransaction(base, { from: 'bad', to: SP }));
});

test('traceFunds finds registry-flagged counterparties and reports truncation', async () => {
  const bad = '0x7777777777777777777777777777777777777777', me = '0x8888888888888888888888888888888888888888';
  const log = { topics: [TRANSFER_TOPIC, zeroPadValue(bad, 32), zeroPadValue(me, 32)] };
  const provider = { getBlockNumber: async () => 100, getLogs: async ({ topics }) => (topics.length === 3 ? [log] : []) };
  const r = await traceFunds(provider, me, async (a) => (a.toLowerCase() === bad ? { confirmed: 1, open: 0 } : { confirmed: 0, open: 0 }), { blocks: 100, chunk: 50 });
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].direction, 'in');
  const failing = await traceFunds({ getBlockNumber: async () => 10, getLogs: async () => { throw new Error('range'); } }, me, async () => ({}), { blocks: 10 });
  assert.equal(failing.truncated, true);
});

test('threat feeds: strict format, https only, errors isolated, timeouts handled', async () => {
  assert.deepEqual(parseFeeds(''), []);
  assert.equal(parseFeeds('[{"name":"a","url":"http://x"},{"name":"b","url":"https://x/{address}"}]').length, 1);
  assert.throws(() => parseFeeds('nope'));
  const a = '0x9999999999999999999999999999999999999999';
  const ok = async () => ({ ok: true, json: async () => ({ address: a, flagged: true, category: 'drainer', confidence: 0.9, reference: 'javascript:alert(1)' }) });
  const bad = async () => ({ ok: false, status: 500 });
  const wrong = async () => ({ ok: true, json: async () => ({ address: SP, flagged: true }) });
  const feeds = [{ name: 'good', url: 'https://g/{address}' }, { name: 'down', url: 'https://d/{address}' }, { name: 'mismatch', url: 'https://m/{address}' }];
  const byHost = { g: ok, d: bad, m: wrong };
  const r = await queryFeeds(a, feeds, { fetchFn: (url, o) => byHost[url[8]](url, o) });
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].reference, null, 'non-https reference dropped');
  assert.equal(r.errors.length, 1);
});

test('assess combines signals once each, caps unconfirmed at 99, and names what did not run', () => {
  const sim = { findings: [{ code: 'DRAIN_TO_FLAGGED', severity: 'critical', text: 'drain' }, { code: 'UNLIMITED_APPROVAL', severity: 'high', text: 'approve' }] };
  const feeds = { hits: [{ source: 'f1', confidence: 0.9 }, { source: 'f2', confidence: 0.8 }], errors: [] };
  const trace = { hits: [{ confirmed: true }], truncated: false };
  const r = assess({ arcRows: [arc({}), arc({ reporter: R2, arkivEntityKey: K2 })], feeds, trace, simulation: sim });
  assert.equal(r.score, 99);
  assert.equal(r.level, 'High risk');
  assert.equal(assess({ arcRows: [arc({ status: 'Confirmed' })], feeds, trace, simulation: sim }).score, 100);
  const only = assess({ feeds: { hits: [{ source: 'f1', confidence: 0.3 }], errors: [] } });
  assert.equal(only.score, 10);
  assert.ok(assess({}).reasons.some((x) => x.startsWith('Did not run')));
  assert.equal(assess({}).score, null);
  assert.equal(assess({ simulation: { findings: [{ code: 'UNLIMITED_APPROVAL', severity: 'high', text: 'a' }] } }).score, 25);
});
