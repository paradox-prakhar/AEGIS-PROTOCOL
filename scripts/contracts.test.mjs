import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory, ZeroAddress, ZeroHash, keccak256, toUtf8Bytes } from 'ethers';

const v2 = JSON.parse(fs.readFileSync('src/registry-artifact.json', 'utf8'));
const v1 = JSON.parse(fs.readFileSync('src/registry-v1-artifact.json', 'utf8'));
const H = (s) => keccak256(toUtf8Bytes(s));
const DAY = 86400;
const Status = { Pending: 0n, Challenged: 1n, Confirmed: 2n, Rejected: 3n };

async function setup(artifact = v2) {
  const rpc = ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'merge' } });
  const provider = new BrowserProvider(rpc);
  const [reviewer, reporter, challenger, subject, other] = await Promise.all([0, 1, 2, 3, 4].map((i) => provider.getSigner(i)));
  const c = await new ContractFactory(artifact.abi, artifact.bytecode, reviewer).deploy(await reviewer.getAddress());
  await c.waitForDeployment();
  const advance = async (seconds) => {
    await rpc.request({ method: 'evm_increaseTime', params: [seconds] });
    await rpc.request({ method: 'evm_mine', params: [] });
  };
  return { rpc, c, reviewer, reporter, challenger, subject, other, advance, addr: (s) => s.getAddress() };
}

async function revertsWith(promise, name) {
  await assert.rejects(promise, (e) => {
    const got = e.revert?.name || e.info?.error?.message || e.message;
    assert.ok(String(got).includes(name), `expected ${name}, got ${got}`);
    return true;
  });
}

test('v1 frozen artifact still deploys and runs the original lifecycle', async () => {
  const { rpc, c, reporter, challenger, advance } = await setup(v1);
  try {
    await (await c.connect(reporter).submit(await challenger.getAddress(), H('evidence'))).wait();
    await (await c.connect(challenger).challenge(0, H('counter'))).wait();
    await advance(2 * DAY + 1);
    await (await c.resolve(0, true)).wait();
    assert.equal((await c.reports(0)).status, Status.Confirmed);
  } finally { await rpc.disconnect(); }
});

test('v2 constructor and metadata', async () => {
  const { rpc, c, reviewer } = await setup();
  try {
    assert.equal(await c.VERSION(), 2n);
    assert.equal(await c.reviewer(), await reviewer.getAddress());
    assert.equal(await c.paused(), false);
    const factory = new ContractFactory(v2.abi, v2.bytecode, reviewer);
    await assert.rejects(factory.deploy(ZeroAddress));
  } finally { await rpc.disconnect(); }
});

test('v2 submission validation, indexing and duplicate protection', async () => {
  const { rpc, c, reporter, subject, other, addr } = await setup();
  try {
    const s = await addr(subject);
    const r = c.connect(reporter);
    await revertsWith(r.submit.staticCall(ZeroAddress, H('x'), ''), 'ZeroAddress');
    await revertsWith(r.submit.staticCall(s, ZeroHash, ''), 'InvalidEvidence');
    await revertsWith(r.submit.staticCall(s, H('x'), 'x'.repeat(257)), 'UriTooLong');
    await revertsWith(r.submit.staticCall(await addr(reporter), H('x'), ''), 'SelfReport');

    const receipt = await (await r.submit(s, H('evidence'), 'ipfs://cid')).wait();
    const log = c.interface.parseLog(receipt.logs[0]);
    assert.equal(log.name, 'Submitted');
    assert.equal(log.args.reporter, await addr(reporter));
    assert.equal(log.args.evidenceURI, 'ipfs://cid');

    await revertsWith(r.submit.staticCall(s, H('again'), ''), 'DuplicateOpenReport');
    await (await c.connect(other).submit(s, H('second'), '')).wait();

    assert.equal(await c.reportCount(), 2n);
    assert.equal(await c.subjectReportCount(s), 2n);
    assert.deepEqual([...(await c.reportIdsOf(s, 0, 10))], [0n, 1n]);
    assert.deepEqual([...(await c.reportIdsOf(s, 1, 10))], [1n]);
    assert.equal((await c.reportIdsOf(s, 5, 10)).length, 0);
    const summary = await c.subjectSummary(s);
    assert.equal(summary.total, 2n);
    assert.equal(summary.open, 2n);
    const page = await c.getReports(0, 100);
    assert.equal(page.length, 2);
    assert.equal(page[1].reporter, await addr(other));
    await revertsWith(c.getReports(0, 0), 'InvalidPage');
    await revertsWith(c.getReports(0, 101), 'InvalidPage');
    await revertsWith(c.reports(9), 'ReportNotFound');
  } finally { await rpc.disconnect(); }
});

test('v2 challenge rules', async () => {
  const { rpc, c, reporter, challenger, subject, addr } = await setup();
  try {
    await (await c.connect(reporter).submit(await addr(subject), H('e'), '')).wait();
    await revertsWith(c.connect(challenger).challenge.staticCall(7, H('c'), ''), 'ReportNotFound');
    await revertsWith(c.connect(reporter).challenge.staticCall(0, H('c'), ''), 'ReporterCannotChallenge');
    await revertsWith(c.connect(challenger).challenge.staticCall(0, ZeroHash, ''), 'InvalidEvidence');
    await (await c.connect(challenger).challenge(0, H('c'), '')).wait();
    await (await c.connect(subject).challenge(0, H('d'), '')).wait();
    const r = await c.reports(0);
    assert.equal(r.status, Status.Challenged);
    assert.equal(r.challengeCount, 2n);
    await revertsWith(c.connect(challenger).challenge.staticCall(0, H('c2'), ''), 'AlreadyChallenged');
  } finally { await rpc.disconnect(); }
});

test('v2 resolution: access, review window, accounting and closed reports', async () => {
  const { rpc, c, reporter, challenger, subject, other, advance, addr } = await setup();
  try {
    const s = await addr(subject);
    await (await c.connect(reporter).submit(s, H('a'), '')).wait();
    await (await c.connect(other).submit(s, H('b'), '')).wait();
    await revertsWith(c.connect(reporter).resolve.staticCall(0, true), 'NotReviewer');
    await revertsWith(c.resolve.staticCall(0, true), 'ReviewWindowActive');
    await revertsWith(c.resolve.staticCall(9, true), 'ReportNotFound');
    await advance(2 * DAY + 1);
    await (await c.resolve(0, true)).wait();
    await (await c.resolve(1, false)).wait();
    const r0 = await c.reports(0);
    assert.equal(r0.status, Status.Confirmed);
    assert.ok(r0.resolvedAt > 0n);
    assert.equal((await c.reports(1)).status, Status.Rejected);
    const summary = await c.subjectSummary(s);
    assert.deepEqual([summary.total, summary.open, summary.confirmed, summary.rejected], [2n, 0n, 1n, 1n]);
    await revertsWith(c.resolve.staticCall(0, false), 'ReportClosed');
    await revertsWith(c.connect(challenger).challenge.staticCall(0, H('late'), ''), 'ReportClosed');
    // A reporter may file a fresh report once the previous one is closed.
    await (await c.connect(reporter).submit(s, H('new evidence'), '')).wait();
    assert.equal(await c.hasOpenReport(s, await addr(reporter)), true);
  } finally { await rpc.disconnect(); }
});

test('v2 pause blocks public writes but not adjudication', async () => {
  const { rpc, c, reporter, challenger, subject, advance, addr } = await setup();
  try {
    await (await c.connect(reporter).submit(await addr(subject), H('a'), '')).wait();
    await revertsWith(c.connect(reporter).pause.staticCall(), 'NotReviewer');
    await (await c.pause()).wait();
    assert.equal(await c.paused(), true);
    await revertsWith(c.connect(challenger).submit.staticCall(await addr(subject), H('b'), ''), 'IsPaused');
    await revertsWith(c.connect(challenger).challenge.staticCall(0, H('b'), ''), 'IsPaused');
    await advance(2 * DAY + 1);
    await (await c.resolve(0, false)).wait();
    await (await c.unpause()).wait();
    await (await c.connect(challenger).submit(await addr(subject), H('b'), '')).wait();
  } finally { await rpc.disconnect(); }
});

test('v2 two-step reviewer rotation', async () => {
  const { rpc, c, reviewer, reporter, other, addr } = await setup();
  try {
    await revertsWith(c.connect(reporter).transferReviewer.staticCall(await addr(other)), 'NotReviewer');
    await (await c.transferReviewer(await addr(other))).wait();
    assert.equal(await c.pendingReviewer(), await addr(other));
    assert.equal(await c.reviewer(), await addr(reviewer));
    await revertsWith(c.connect(reporter).acceptReviewer.staticCall(), 'NotPendingReviewer');
    await (await c.connect(other).acceptReviewer()).wait();
    assert.equal(await c.reviewer(), await addr(other));
    assert.equal(await c.pendingReviewer(), ZeroAddress);
    await revertsWith(c.pause.staticCall(), 'NotReviewer');
    // Cancelling a nomination.
    await (await c.connect(other).transferReviewer(await addr(reporter))).wait();
    await (await c.connect(other).transferReviewer(ZeroAddress)).wait();
    await revertsWith(c.connect(reporter).acceptReviewer.staticCall(), 'NotPendingReviewer');
  } finally { await rpc.disconnect(); }
});
