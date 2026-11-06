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
