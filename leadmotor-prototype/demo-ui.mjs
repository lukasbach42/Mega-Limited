import { campaignFromSearch, createDemoClient } from './demo-client.mjs';
const $ = id => document.getElementById(id);
let client, role, active = false, terminal = false;
const messages = {
  UNAUTHORIZED:'Testadgangen er ugyldig eller udløbet. Åbn en ny testsession.',
  FORBIDDEN:'Denne testrolle har ikke adgang til handlingen.',
  NETWORK_ERROR:'Serveren kunne ikke nås. Ingen bekræftelse er modtaget; opdater før du prøver igen.',
  STORAGE_UNAVAILABLE:'Lagring kunne ikke bekræftes. Handlingen er ikke bekræftet gemt.',
  SLOT_TAKEN:'Testslottet er optaget. Leadet er stadig gemt; opdater de ledige slots.',
  INVALID_TRANSITION:'Handlingen passer ikke til leadets aktuelle status. Kontrollér CRM-loggen.',
  CONSENT_WITHDRAWN:'Testsamtykket er trukket tilbage. Leadet må ikke behandles videre.',
  CONSENT_REQUIRED:'Testsamtykke skal bekræftes.', SYNTHETIC_ONLY:'Brug kun syntetiske testværdier.',
  INVALID_UTM:'Kampagnefelter må kun indeholde bogstaver, tal, punktum, bindestreg og underscore (højst 80 tegn).',
  INVALID_SOURCE:'Vælg en af de viste testkanaler.', RATE_LIMIT:'For mange testforsøg. Vent et minut.',
  LEAD_REQUIRED:'Gem et testlead først.',
};
function showError(error) { $('error').textContent = messages[error.message] || 'Handlingen kunne ikke bekræftes. Kontrollér testsession og prøv igen.'; }
function reset() {
  client?.disconnect(); client = null; role = null; active = false; terminal = false;
  for (const id of ['intake','booking','crm','reporting','disconnect']) $(id).hidden = true;
  $('access-form').hidden = false; $('token').value = '';
  $('lead-status').textContent = ''; $('booking-status').textContent = '';
  $('lead-record').textContent = ''; $('kpi').textContent = '';
  $('consent').checked = false; $('event-button').disabled = true;
  $('session-status').textContent = 'Ingen testsession åben.';
}
async function run(button, work) {
  $('error').textContent = ''; button.disabled = true;
  try { await work(); } catch (error) { showError(error); }
  finally { button.disabled = button.id === 'event-button' ? (!active || terminal) : button.id === 'book-button' ? ($('slot').options.length === 0 || !active) : false; }
}
async function slots() {
  const rows = await client.slots();
  const options = rows.filter(slot=>slot.available).map(slot=>{
    const option=document.createElement('option');option.value=slot.id;option.textContent=slot.id+' (kunstigt testslot)';return option;
  });
  $('slot').replaceChildren(...options);
  $('slot').disabled = options.length === 0; $('book-button').disabled = options.length === 0;
  if (!options.length) $('booking-status').textContent = 'Alle testslots er optaget. Leadet er gemt; der er ingen ny booking.';
}
async function refreshLead() {
  if (role !== 'operator' || !active) return;
  const lead=await client.lead();
  $('lead-record').textContent=JSON.stringify(lead,null,2);
  terminal=lead.status==='withdrawn';
  $('event-button').disabled=terminal;
  if (lead.booking) {
    $('booking-form').hidden=true; $('refresh-slots').hidden=true;
    $('booking-status').textContent='Testbooking bekræftet: '+lead.booking+'. Ingen rigtig kalenderaftale.';
  } else if (!['new','contacted'].includes(lead.status)) $('booking').hidden=true;
}
async function kpi() { $('kpi').textContent=JSON.stringify(await client.kpi(),null,2); }
$('access-form').addEventListener('submit', event=>{
  event.preventDefault();
  run(event.submitter,async()=>{
    client?.disconnect();
    client=createDemoClient({token:$('token').value}); $('token').value='';
    let session;
    try { session=await client.session(); } catch(error) { reset(); throw error; }
    role=session.role; active=false;
    $('access-form').hidden=true; $('disconnect').hidden=false;
    $('session-status').textContent='Testrolle: '+({intake:'Leadmodtagelse',operator:'CRM-operatør',analyst:'KPI-læser'}[role]||role);
    $('intake').hidden=role==='analyst'; $('crm').hidden=role!=='operator'; $('reporting').hidden=role==='intake';
    if (role!=='intake') await kpi();
  });
});
$('disconnect').addEventListener('click',()=>{reset();$('error').textContent='';});
$('lead-form').addEventListener('submit',event=>{
  event.preventDefault();
  run(event.submitter,async()=>{
    active=false; terminal=false; $('booking-form').hidden=false; $('refresh-slots').hidden=false; $('booking').hidden=true; $('event-button').disabled=true;
    $('lead-status').textContent=''; $('booking-status').textContent=''; $('lead-record').textContent='';
    const fields={name:$('name').value,phone:$('phone').value,postcode:'0000',preferred_contact:$('preferred_contact').value,consent:$('consent').checked};
    const params=new URLSearchParams();for(const id of ['source','utm_source','utm_medium','utm_campaign']) params.set(id,$(id).value);
    const result=await client.submit(fields,campaignFromSearch(params.toString())); active=true;
    $('lead-status').textContent=(result.duplicate?'Eksisterende testlead fundet; ingen ny samtykkehistorik eller leadtælling. ':'Testlead gemt. ')+result.leadId;
    $('consent').checked=false; $('booking').hidden=false;
    await slots(); await refreshLead(); if(role!=='intake') await kpi();
  });
});
$('booking-form').addEventListener('submit',event=>{
  event.preventDefault();
  run(event.submitter,async()=>{
    const booking=await client.book($('slot').value);
    $('booking-status').textContent='Testbooking bekræftet: '+booking.slotId+'. Ingen rigtig kalenderaftale.';
    $('booking-form').hidden=true;
    await refreshLead(); if(role!=='intake') await kpi();
  });
});
$('refresh-slots').addEventListener('click',event=>run(event.target,async()=>{$('booking-form').hidden=false;await slots();}));
$('event-form').addEventListener('submit',event=>{
  event.preventDefault();
  run(event.submitter,async()=>{await client.event($('event').value);await refreshLead();await kpi();});
});
$('refresh-kpi').addEventListener('click',event=>run(event.target,kpi));
try { const campaign=campaignFromSearch(location.search);for(const [key,value] of Object.entries(campaign)) $(key).value=value; }
catch(error){ showError(error); }
window.addEventListener('pagehide',reset);
