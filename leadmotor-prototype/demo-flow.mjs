// Synthetic-only partner-neutral demo journey. No customer data or external services.
import { parseDemoAttribution } from './demo-attribution.mjs';

export function buildSyntheticLead({ testNumber, contactWindow, consent, search = '' }) {
  const n = Number(testNumber);
  if (!Number.isSafeInteger(n) || n < 1 || n > 9999) throw new Error('INVALID_TEST_NUMBER');
  if (!['formiddag', 'eftermiddag'].includes(contactWindow)) throw new Error('INVALID_CONTACT_WINDOW');
  if (consent !== true) throw new Error('DEMO_CONSENT_REQUIRED');
  return {
    name: 'Test Kunde' + n,
    phone: '0000' + String(n).padStart(4, '0'),
    postcode: '0000',
    preferred_contact: contactWindow,
    consent: true,
    consent_text_version: 'demo-v1',
    ...parseDemoAttribution(search),
  };
}

async function api(request, url, token, method, body) {
  const response = await request(url, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'HTTP_' + response.status);
  return result;
}

export async function runSyntheticJourney({
  testNumber, contactWindow, consent, search = '', token, slotId = '',
  request = fetch, base = '',
}) {
  // Validate locally before any API call; only synthetic data ever leaves this page.
  const lead = buildSyntheticLead({ testNumber, contactWindow, consent, search });
  if (typeof token !== 'string' || token.length < 24) throw new Error('DEMO_TOKEN_REQUIRED');
  if (slotId && !['demo-slot-1', 'demo-slot-2'].includes(slotId)) throw new Error('INVALID_SLOT');
  const submitted = await api(request, base + '/api/leads', token, 'POST', lead);
  let booking = null;
  if (slotId && !submitted.duplicate) {
    booking = await api(request, base + '/api/leads/' + encodeURIComponent(submitted.leadId) + '/booking', token, 'POST', { slotId });
  }
  const kpi = await api(request, base + '/api/kpi', token, 'GET');
  return { leadId: submitted.leadId, duplicate: submitted.duplicate, booking, kpi };
}
