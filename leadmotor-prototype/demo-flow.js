// Browser controller for the local synthetic-only journey; no browser storage.
import { runSyntheticJourney } from './demo-flow.mjs';
const form = document.getElementById('demo-form');
const output = document.getElementById('result');
const button = document.getElementById('run');
form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true;
  output.textContent = 'Tester syntetisk leadflow…';
  try {
    const result = await runSyntheticJourney({
      testNumber: document.getElementById('test-number').value,
      contactWindow: document.getElementById('contact-window').value,
      consent: document.getElementById('demo-consent').checked,
      search: window.location.search,
      token: document.getElementById('token').value.trim(),
      slotId: document.getElementById('slot').value,
    });
    output.textContent = JSON.stringify({
      leadId: result.leadId,
      duplicate: result.duplicate,
      bookedSlot: result.booking?.slotId ?? null,
      syntheticLeads: result.kpi.leads,
      channelKpi: result.kpi.byChannel,
    }, null, 2);
  } catch (error) {
    output.textContent = 'Testen blev afvist: ' + error.message;
  } finally {
    button.disabled = false;
  }
});
