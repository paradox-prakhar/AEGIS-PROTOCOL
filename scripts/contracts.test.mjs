import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ganache from 'ganache';
import solc from 'solc';
import { BrowserProvider, ContractFactory, ZeroAddress, ZeroHash, keccak256, parseEther, toUtf8Bytes } from 'ethers';

const v2 = JSON.parse(fs.readFileSync('src/registry-artifact.json', 'utf8'));
const v1 = JSON.parse(fs.readFileSync('src/registry-v1-artifact.json', 'utf8'));
const H = (s) => keccak256(toUtf8Bytes(s));
const DAY = 86400;
const K = H('arkiv-entity-key');
const S = { value: parseEther('0.1') };
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
    await revertsWith(r.submit.staticCall(ZeroAddress, H('x'), '', K, S), 'ZeroAddress');
    await revertsWith(r.submit.staticCall(s, ZeroHash, '', K, S), 'InvalidEvidence');
    await revertsWith(r.submit.staticCall(s, H('x'), '', ZeroHash), 'InvalidArkivKey');
    await revertsWith(r.submit.staticCall(s, H('x'), 'x'.repeat(257), K, S), 'UriTooLong');
    await revertsWith(r.submit.staticCall(await addr(reporter), H('x'), '', K, S), 'SelfReport');

    const receipt = await (await r.submit(s, H('evidence'), 'ipfs://cid', K, S)).wait();
    const log = c.interface.parseLog(receipt.logs[0]);
    assert.equal(log.name, 'Submitted');
    assert.equal(log.args.reporter, await addr(reporter));
    assert.equal(log.args.evidenceURI, 'ipfs://cid');
    assert.equal(log.args.arkivEntityKey, K, S);
    assert.equal((await c.reports(0)).arkivEntityKey, K, S);

    await revertsWith(r.submit.staticCall(s, H('again'), '', K, S), 'DuplicateOpenReport');
    await (await c.connect(other).submit(s, H('second'), '', K, S)).wait();

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
    await (await c.connect(reporter).submit(await addr(subject), H('e'), '', K, S)).wait();
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
    await (await c.connect(reporter).submit(s, H('a'), '', K, S)).wait();
    await (await c.connect(other).submit(s, H('b'), '', K, S)).wait();
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
    await (await c.connect(reporter).submit(s, H('new evidence'), '', K, S)).wait();
    assert.equal(await c.hasOpenReport(s, await addr(reporter)), true);
  } finally { await rpc.disconnect(); }
});

test('v2 pause blocks public writes but not adjudication', async () => {
  const { rpc, c, reporter, challenger, subject, advance, addr } = await setup();
  try {
    await (await c.connect(reporter).submit(await addr(subject), H('a'), '', K, S)).wait();
    await revertsWith(c.connect(reporter).pause.staticCall(), 'NotReviewer');
    await (await c.pause()).wait();
    assert.equal(await c.paused(), true);
    await revertsWith(c.connect(challenger).submit.staticCall(await addr(subject), H('b'), '', K, S), 'IsPaused');
    await revertsWith(c.connect(challenger).challenge.staticCall(0, H('b'), ''), 'IsPaused');
    await advance(2 * DAY + 1);
    await (await c.resolve(0, false)).wait();
    await (await c.unpause()).wait();
    await (await c.connect(challenger).submit(await addr(subject), H('b'), '', K, S)).wait();
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

const ATTACKER = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;
interface IReg { function submit(address,bytes32,string calldata,bytes32) external payable returns (uint256); function withdraw() external; }
contract Attacker {
    IReg r; uint256 public hits;
    constructor(address a) { r = IReg(a); }
    function file(address subject) external payable { r.submit{value: msg.value}(subject, bytes32(uint256(1)), "", bytes32(uint256(2))); }
    function pull() external { r.withdraw(); }
    receive() external payable { hits++; if (address(r).balance > 0 && hits < 5) { try r.withdraw() {} catch {} } }
}`;

async function staked() {
  const ctx = await setup();
  const { c, reporter, challenger, other, subject, advance, addr } = ctx;
  const s = await addr(subject);
  return { ...ctx, s, file: async (who = reporter, h = 'e') => (await c.connect(who).submit(s, H(h), '', K, S)).wait() };
}
// ethers caches provider.getBalance briefly; read straight from the node to see the latest state.
const bal = async (x, a) => BigInt(await x.rpc.request({ method: 'eth_getBalance', params: [a, 'latest'] }));

test('v2 stake: below minimum reverts, confirmed refunds reporter, contract balance tracks stakes', async () => {
  const x = await staked();
  try {
    await revertsWith(x.c.connect(x.reporter).submit.staticCall(x.s, H('e'), '', K, { value: parseEther('0.01') }), 'StakeTooLow');
    await x.file();
    assert.equal(await bal(x, await x.c.getAddress()), parseEther('0.1'));
    assert.equal((await x.c.reports(0)).stake, parseEther('0.1'));
    await x.advance(2 * DAY + 1);
    await (await x.c.resolve(0, true)).wait();
    const me = await x.addr(x.reporter);
    assert.equal(await x.c.credits(me), parseEther('0.1'));
    await (await x.c.connect(x.reporter).withdraw()).wait();
    assert.equal(await x.c.credits(me), 0n);
    assert.equal(await bal(x, await x.c.getAddress()), 0n);
    await revertsWith(x.c.connect(x.reporter).withdraw.staticCall(), 'NothingToWithdraw');
  } finally { await x.rpc.disconnect?.(); }
});

test('v2 stake: rejected with no challengers goes to treasury; with challengers they split it once each', async () => {
  const x = await staked();
  try {
    await x.file(x.reporter, 'a');
    await x.advance(2 * DAY + 1);
    await (await x.c.resolve(0, false)).wait();
    assert.equal(await x.c.credits(await x.c.treasury()), parseEther('0.1'));

    await x.file(x.other, 'b');
    await (await x.c.connect(x.challenger).challenge(1, H('c1'), '')).wait();
    await (await x.c.connect(x.reporter).challenge(1, H('c2'), '')).wait();
    await x.advance(2 * DAY + 1);
    await (await x.c.resolve(1, false)).wait();
    assert.equal(await x.c.credits(await x.addr(x.challenger)), 0n);
    await (await x.c.connect(x.challenger).claimChallengerShare(1)).wait();
    assert.equal(await x.c.credits(await x.addr(x.challenger)), parseEther('0.05'));
    await revertsWith(x.c.connect(x.challenger).claimChallengerShare.staticCall(1), 'NoShare');
    await revertsWith(x.c.connect(x.other).claimChallengerShare.staticCall(1), 'NoShare');
    await revertsWith(x.c.connect(x.challenger).claimChallengerShare.staticCall(0), 'NoShare');
  } finally { await x.rpc.disconnect?.(); }
});

test('v2 reviewer settings: min stake bounds, treasury, only reviewer', async () => {
  const x = await staked();
  try {
    await revertsWith(x.c.connect(x.reporter).setMinStake.staticCall(0), 'NotReviewer');
    await revertsWith(x.c.setMinStake.staticCall(parseEther('11')), 'InvalidStake');
    await (await x.c.setMinStake(parseEther('1'))).wait();
    await revertsWith(x.c.connect(x.reporter).submit.staticCall(x.s, H('e'), '', K, S), 'StakeTooLow');
    await revertsWith(x.c.setTreasury.staticCall(ZeroAddress), 'ZeroAddress');
    await (await x.c.setTreasury(await x.addr(x.other))).wait();
    assert.equal(await x.c.treasury(), await x.addr(x.other));
  } finally { await x.rpc.disconnect?.(); }
});

test('v2 issuer coordination: only allowlisted issuers, only on confirmed reports', async () => {
  const x = await staked();
  try {
    const issuer = x.challenger;
    const ref = H('case-1');
    await x.file();
    await revertsWith(x.c.connect(issuer).recordIssuerAction.staticCall(0, 1, ref), 'NotIssuer');
    await revertsWith(x.c.connect(x.reporter).setIssuer.staticCall(await x.addr(issuer), true), 'NotReviewer');
    await (await x.c.setIssuer(await x.addr(issuer), true)).wait();
    await revertsWith(x.c.connect(issuer).recordIssuerAction.staticCall(0, 1, ref), 'ReportNotConfirmed');
    await x.advance(2 * DAY + 1);
    await (await x.c.resolve(0, true)).wait();
    await (await x.c.connect(issuer).recordIssuerAction(0, 1, ref)).wait();
    const notes = await x.c.issuerNotes(0);
    assert.equal(notes.length, 1);
    assert.equal(notes[0].issuer, await x.addr(issuer));
    assert.equal(notes[0].ref, ref);
    await (await x.c.setIssuer(await x.addr(issuer), false)).wait();
    await revertsWith(x.c.connect(issuer).recordIssuerAction.staticCall(0, 2, ref), 'NotIssuer');
  } finally { await x.rpc.disconnect?.(); }
});

test('v2 withdraw is reentrancy-safe', async () => {
  const x = await staked();
  try {
    const out = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'A.sol': { content: ATTACKER } }, settings: { evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } })));
    const art = out.contracts['A.sol'].Attacker;
    const atk = await new ContractFactory(art.abi, '0x' + art.evm.bytecode.object, x.reporter).deploy(await x.c.getAddress());
    await atk.waitForDeployment();
    await (await atk.file(x.s, { value: parseEther('0.1') })).wait();
    await (await x.c.connect(x.other).submit(x.s, H('victim'), '', K, S)).wait();
    await x.advance(2 * DAY + 1);
    await (await x.c.resolve(0, true)).wait();
    const registry = await x.c.getAddress();
    await (await atk.pull()).wait();
    assert.equal(await bal(x, registry), parseEther('0.1'), 'only the attacker\'s own 0.1 left; victim stake intact');
    assert.equal(await x.c.credits(await atk.getAddress()), 0n);
  } finally { await x.rpc.disconnect?.(); }
});
