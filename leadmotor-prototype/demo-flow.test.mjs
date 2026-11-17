import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { buildSyntheticLead, runSyntheticJourney } from './demo-flow.mjs';
import { createDemoServer } from './demo-server.mjs';

const token = 'synthetic-only-test-token-very-long';

test('partner-neutral form builder emits only fake contact data and UTM', () => {
  const lead = buildSyntheticLead({
    testNumber: 42, contactWindow: 'formiddag', consent: true,
    search: '?utm_source=linkedin&utm_medium=organic&utm_campaign=mega_test'
  });
  assert.equal(lead.name, 'Test Kunde42');
  assert.equal(lead.phone, '00000042');
  assert.equal(lead.postcode, '0000');
  assert.equal(lead.consent_text_version, 'demo-v1');
  assert.equal(lead.source, 'organic');
  assert.equal(lead.utm_campaign, 'mega_test');
});

test('form rejects missing consent, invalid IDs, paid UTM and invalid slots before network', async () => {
  const base = { testNumber: 1, contactWindow: 'eftermiddag', consent: true, token };
  assert.throws(() => buildSyntheticLead({ ...base, consent: false }), /DEMO_CONSENT_REQUIRED/);
  assert.throws(() => buildSyntheticLead({ ...base, testNumber: '1.5' }), /INVALID_TEST_NUMBER/);
  assert.throws(() => buildSyntheticLead({ ...base, testNumber: '90000000' }), /INVALID_TEST_NUMBER/);
  assert.throws(() => buildSyntheticLead({ ...base, contactWindow: 'night' }), /INVALID_CONTACT_WINDOW/);
  assert.throws(() => buildSyntheticLead({ ...base, search: '?utm_medium=cpc' }), /UNSUPPORTED_DEMO_MEDIUM/);
  let calls = 0;
  const request = async () => { calls++; throw new Error('SHOULD_NOT_CALL'); };
  await assert.rejects(runSyntheticJourney({ ...base, slotId: 'real-slot', request }), /INVALID_SLOT/);
  await assert.rejects(runSyntheticJourney({ ...base, token: 'weak', request }), /DEMO_TOKEN_REQUIRED/);
  assert.equal(calls, 0);
});

test('local HTML and module assets are served; full synthetic form → CRM → booking → KPI works', async () => {
  const server = createDemoServer({ token });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const [path, expected] of [
      ['/demo-flow', /INTERN PROTOTYPE/],
      ['/demo-flow.js', /runSyntheticJourney/],
      ['/demo-flow.mjs', /buildSyntheticLead/]
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      assert.match(await response.text(), expected);
    }
    const input = {
      testNumber: 31, contactWindow: 'formiddag', consent: true, token,
      search: '?utm_source=linkedin&utm_medium=organic&utm_campaign=launch_test',
      slotId: 'demo-slot-1', base
    };
    const first = await runSyntheticJourney(input);
    assert.equal(first.duplicate, false);
    assert.equal(first.booking.slotId, 'demo-slot-1');
    assert.equal(first.kpi.leads, 1);
    assert.equal(first.kpi.byChannel['organic/launch_test'].leads, 1);
    const duplicate = await runSyntheticJourney(input);
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.booking, null);
    assert.equal(duplicate.kpi.leads, 1);
    const withdrawn = await fetch(base + '/api/leads/' + first.leadId + '/events', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'consent_withdrawn' })
    });
    assert.equal(withdrawn.status, 200);
    const slots = await fetch(base + '/api/slots', { headers: { Authorization: 'Bearer ' + token } });
    assert.equal((await slots.json())[0].available, true);
    const kpi = await fetch(base + '/api/kpi', { headers: { Authorization: 'Bearer ' + token } });
    assert.equal((await kpi.json()).withdrawn, 1);
  } finally {
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
