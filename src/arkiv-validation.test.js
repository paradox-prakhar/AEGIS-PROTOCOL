import test from 'node:test';import assert from 'node:assert/strict';import {keccak256,toUtf8Bytes}from'ethers';import{verifyReportBinding}from'./arkiv-validation.js';
const reporter='0x'+'1'.repeat(40),subject='0x'+'2'.repeat(40),evidence='Public supporting transaction evidence';const hash=keccak256(toUtf8Bytes(evidence));const report={reporter,subject,evidenceHash:hash};const stored={creator:reporter,subject,hash,evidence};
test('accept matching evidence and onchain creator',()=>assert.equal(verifyReportBinding(report,stored),true));
test('reject impersonated reporter',()=>assert.throws(()=>verifyReportBinding(report,{...stored,creator:subject})));
test('reject copied evidence against a different address',()=>assert.throws(()=>verifyReportBinding(report,{...stored,subject:reporter})));
test('reject modified evidence even when stored hash is unchanged',()=>assert.throws(()=>verifyReportBinding(report,{...stored,evidence:evidence+'!'})));
