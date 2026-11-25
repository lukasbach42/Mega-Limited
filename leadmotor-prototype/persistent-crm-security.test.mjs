// Synthetic-only security regressions for the CRM persistence boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPersistentCRM } from './persistent-crm.mjs';

const key = 'ab'.repeat(32);
const input = {
  name: 'Test Storage Sentinel',
  phone: '00001234',
  postcode: '0000',
  preferred_contact: 'formiddag',
  consent: true,
  consent_text_version: 'demo-v1',
  source: 'test'
};
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'mega-storage-boundary-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, 'crm.enc');
}

test('second writer is denied and cannot replace first writer state', t => {
  const file = fixture(t);
  const owner = createPersistentCRM({ file, key });
  try {
    assert.throws(() => createPersistentCRM({ file, key }), error => error?.code === 'EEXIST');
    const id = owner.submit(input).leadId;
    assert.equal(owner.getLead(id).name, input.name);
  } finally {
    owner.close();
  }
  const reopened = createPersistentCRM({ file, key });
  try { assert.equal(reopened.listLeads().total, 1); }
  finally { reopened.close(); }
});

test('encrypted store does not contain synthetic contact details in plaintext', t => {
  const file = fixture(t);
  const crm = createPersistentCRM({ file, key });
  try { crm.submit(input); }
  finally { crm.close(); }
  const bytes = readFileSync(file, 'utf8');
  assert.equal(bytes.includes(input.name), false);
  assert.equal(bytes.includes(input.phone), false);
  assert.equal(bytes.includes(input.consent_text_version), false);
});

test('tampered encrypted store fails closed and releases its writer lock', t => {
  const file = fixture(t);
  const crm = createPersistentCRM({ file, key });
  try { crm.submit(input); }
  finally { crm.close(); }
  const envelope = JSON.parse(readFileSync(file, 'utf8'));
  envelope.tag = (envelope.tag[0] === 'a' ? 'b' : 'a') + envelope.tag.slice(1);
  writeFileSync(file, JSON.stringify(envelope));
  assert.throws(() => createPersistentCRM({ file, key }), /STORE_OPEN_FAILED/);
  assert.equal(existsSync(file + '.lock'), false);
  assert.throws(() => createPersistentCRM({ file, key }), /STORE_OPEN_FAILED/);
});
