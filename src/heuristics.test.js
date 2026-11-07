import test from 'node:test';
import assert from 'node:assert/strict';
import { checkContact, checkLink, checkMessage, extractUrls } from './lib/heuristics.js';

test('OTP request is dangerous', () => {
  const r = checkMessage('Dear customer, your KYC expires today. Share the OTP sent to you to continue.');
  assert.equal(r.verdict, 'dangerous');
});

test('digital arrest impersonation is dangerous', () => {
  assert.equal(checkMessage('This is CBI. You are under digital arrest, stay on the video call.').verdict, 'dangerous');
});

test('ordinary message is safe', () => {
  const r = checkMessage('Hi, are we still meeting for lunch tomorrow at 1pm?');
  assert.equal(r.verdict, 'safe');
  assert.equal(r.findings.length, 0);
});

test('brand look-alike link is dangerous, official link is not', () => {
  assert.equal(checkLink('http://sbi-kyc-update.xyz/login').verdict, 'dangerous');
  assert.equal(checkLink('https://www.onlinesbi.sbi').verdict, 'safe');
  assert.equal(checkLink('https://hdfcbank.com/personal').verdict, 'safe');
});

test('shortener is suspicious, apk is dangerous', () => {
  assert.equal(checkLink('bit.ly/3abcd').verdict, 'suspicious');
  assert.equal(checkLink('https://example.com/app.apk').verdict, 'dangerous');
});

test('links inside messages are extracted and checked', () => {
  assert.deepEqual(extractUrls('open www.paytm-reward.top now.'), ['www.paytm-reward.top']);
  assert.equal(checkMessage('Claim reward at www.paytm-reward.top now').verdict, 'dangerous');
});

test('contacts', () => {
  assert.equal(checkContact('+92 300 1234567').verdict, 'suspicious');
  assert.equal(checkContact('98765 43210').verdict, 'safe');
  assert.equal(checkContact('refund.support@ybl').verdict, 'suspicious');
  assert.equal(checkContact('asha.k@okhdfcbank').verdict, 'safe');
});
