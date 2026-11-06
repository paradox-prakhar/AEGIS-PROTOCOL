import test from 'node:test';import assert from 'node:assert/strict';import {scan,sampleAddress} from './risk.js';
test('reject malformed addresses',()=>assert.throws(()=>scan('0x123')));
test('demo threat flagged',()=>assert.equal(scan(sampleAddress).score,94));
test('unknown is never safe',()=>assert.equal(scan('0x'+'2'.repeat(40)).level,'Unknown'));
test('reports are allegations',()=>assert.equal(scan('0x'+'a'.repeat(40),[{address:'0x'+'A'.repeat(40)}]).level,'Under review'));
