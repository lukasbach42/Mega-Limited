import { campaignFromSearch, copenhagenContactTime, createDemoClient } from './demo-client.mjs';
const $ = id => document.getElementById(id);
let client, role, active = false, terminal = false;
let sellers=[],inboxOffset=0,inboxTotal=0;
const messages = {
  INVALID_CONTACT_TIME:'Vælg en gyldig dansk kontakttid. Tidspunkter, der springes over eller forekommer to gange ved skift til sommer-/vintertid, kan ikke bruges.',
  ASSIGNMENT_CONFLICT:'Leadet er blevet fordelt i mellemtiden. Opdater indbakken før du prøver igen.',
  NOT_FOUND:'Leadet er ikke længere tilgængeligt for denne sælger. Opdater indbakken.',
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
function showError(error) { if(error.message==='NOT_FOUND'){active=false;$('lead-record').textContent='';$('booking').hidden=true;$('event-button').disabled=true;} $('error').textContent = messages[error.message] || 'Handlingen kunne ikke bekræftes. Kontrollér testsession og prøv igen.'; }
function reset() {
  client?.disconnect(); client = null; role = null; active = false; terminal = false;
  for (const id of ['intake','booking','crm','reporting','disconnect','inbox']) $(id).hidden = true;
  $('access-form').hidden = false; $('token').value = '';
  $('lead-status').textContent = ''; $('booking-status').textContent = '';
  $('lead-record').textContent = ''; $('kpi').textContent = '';
  $('consent').checked = false; $('event-button').disabled = true;
  $('session-status').textContent = 'Ingen testsession åben.';
  $('inbox-rows').replaceChildren();$('inbox-status-text').textContent='';sellers=[];inboxOffset=0;inboxTotal=0;
}
async function run(button, work) {
  $('error').textContent = ''; button.disabled = true;
  try { await work(); } catch (error) { showError(error); }
  finally { button.disabled = button.id === 'inbox-next' ? inboxOffset+25>=inboxTotal : button.id === 'inbox-prev' ? inboxOffset===0 : button.id === 'event-button' ? (!active || terminal) : button.id === 'book-button' ? ($('slot').options.length === 0 || !active) : false; }
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
  if (!['operator','seller'].includes(role) || !active) return;
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
    $('session-status').textContent='Testrolle: '+({intake:'Leadmodtagelse',operator:'CRM-operatør',seller:'Egen sælger · '+session.sellerId,analyst:'KPI-læser'}[role]||role);
    $('intake').hidden=!['intake','operator'].includes(role); $('crm').hidden=!['operator','seller'].includes(role); $('reporting').hidden=!['operator','analyst'].includes(role);
    $('inbox').hidden=!['operator','seller'].includes(role);$('owner-filter').hidden=role!=='operator';
    if(role==='operator') {
      sellers=await client.team();
      $('inbox-owner').replaceChildren(...['all','unassigned'].map((value,index)=>new Option(['Alle sælgere','Ikke fordelt'][index],value)),...sellers.map(s=>new Option(s.name,s.id)));
    }
    if(['operator','seller'].includes(role)){inboxOffset=0;await refreshInbox();}
    if (['operator','analyst'].includes(role)) await kpi();
  });
});
$('disconnect').addEventListener('click',()=>{reset();$('error').textContent='';});
$('lead-form').addEventListener('submit',event=>{
  event.preventDefault();
  run(event.submitter,async()=>{
    active=false; terminal=false; $('booking-form').hidden=false; $('refresh-slots').hidden=false; $('booking').hidden=true; $('event-button').disabled=true;
    $('lead-status').textContent=''; $('booking-status').textContent=''; $('lead-record').textContent='';
    const fields={name:$('name').value,phone:$('phone').value,postcode:'0000',preferred_contact:$('preferred_contact').value,consent:$('consent').checked,requested_contact_at:copenhagenContactTime($('requested-contact').value)};
    const params=new URLSearchParams();for(const id of ['source','utm_source','utm_medium','utm_campaign']) params.set(id,$(id).value);
    const result=await client.submit(fields,campaignFromSearch(params.toString())); active=true;
    $('lead-status').textContent=(result.duplicate?'Eksisterende testlead fundet; ingen ny samtykkehistorik eller leadtælling. ':'Testlead gemt. ')+result.leadId;
    $('consent').checked=false; $('booking').hidden=false;
    await slots(); await refreshLead(); if(role==='operator'){await kpi();await refreshInbox();}
  });
});
$('booking-form').addEventListener('submit',event=>{
  event.preventDefault();
  run(event.submitter,async()=>{
    const booking=await client.book($('slot').value);
    $('booking-status').textContent='Testbooking bekræftet: '+booking.slotId+'. Ingen rigtig kalenderaftale.';
    $('booking-form').hidden=true;
    await refreshLead(); if(role==='operator') await kpi();if(['operator','seller'].includes(role))await refreshInbox();
  });
});
$('refresh-slots').addEventListener('click',event=>run(event.target,async()=>{$('booking-form').hidden=false;await slots();}));
$('event-form').addEventListener('submit',event=>{
  event.preventDefault();
  run(event.submitter,async()=>{const type=$('event').value;await client.event(type);if(role==='seller'&&type==='consent_withdrawn'){active=false;terminal=true;$('lead-record').textContent='Frabedelse registreret. Leadet er fjernet fra din indbakke.';$('booking').hidden=true;}else await refreshLead();if(role==='operator')await kpi();await refreshInbox();});
});
$('refresh-kpi').addEventListener('click',event=>run(event.target,kpi));
try { const campaign=campaignFromSearch(location.search);for(const [key,value] of Object.entries(campaign)) $(key).value=value; }
catch(error){ showError(error); }
function cell(row,text) { const td=document.createElement('td');td.textContent=text;row.append(td);return td; }
async function refreshInbox() {
  const filters={status:$('inbox-status').value,offset:String(inboxOffset),limit:'25'};
  if(role==='operator') filters.assignee=$('inbox-owner').value;
  const result=await client.inbox(filters);inboxTotal=result.total;
  if(inboxOffset>=result.total&&inboxOffset>0){inboxOffset=result.total?Math.floor((result.total-1)/25)*25:0;return refreshInbox();}
  const rows=result.items.map(lead=>{
    const row=document.createElement('tr');
    cell(row,lead.name+' · '+lead.phone);
    const requested=lead.requestedContactAt?new Intl.DateTimeFormat('da-DK',{timeZone:'Europe/Copenhagen',dateStyle:'short',timeStyle:'short'}).format(new Date(lead.requestedContactAt)):lead.preferredContact;
    cell(row,requested+' (ønske)');
    cell(row,lead.status+' · '+lead.source+'/'+(lead.utm.campaign||'(ingen kampagne)'));
    const owner=cell(row,'');
    if(role==='operator') {
      const select=document.createElement('select');select.setAttribute('aria-label','Ansvarlig for '+lead.name);
      select.append(new Option('Ikke fordelt',''),...sellers.map(s=>new Option(s.name,s.id)));select.value=lead.assignee||'';
      const assign=document.createElement('button');assign.type='button';assign.textContent='Gem fordeling';assign.disabled=lead.status==='withdrawn';select.disabled=assign.disabled;
      assign.addEventListener('click',()=>run(assign,async()=>{await client.assign(lead.id,select.value||null,lead.assignee);await refreshInbox();if(active)await refreshLead();}));
      owner.append(select,assign);
    } else owner.textContent='Tildelt dig';
    const action=cell(row,'');const open=document.createElement('button');open.type='button';open.textContent='Åbn '+lead.name;
    open.addEventListener('click',()=>run(open,async()=>{await client.openLead(lead.id);active=true;terminal=false;$('booking').hidden=false;$('booking-form').hidden=false;$('refresh-slots').hidden=false;$('booking-status').textContent='';await slots();await refreshLead();}));action.append(open);return row;
  });
  $('inbox-rows').replaceChildren(...rows);
  $('inbox-status-text').textContent=result.total?String(result.offset+1)+'–'+String(result.offset+result.items.length)+' af '+String(result.total)+' henvendelser':'Ingen henvendelser matcher dette filter.';
  $('inbox-prev').disabled=inboxOffset===0;$('inbox-next').disabled=inboxOffset+result.limit>=result.total;
}
$('inbox-filter-form').addEventListener('submit',event=>{event.preventDefault();run(event.submitter,async()=>{inboxOffset=0;await refreshInbox();});});
$('inbox-prev').addEventListener('click',event=>run(event.target,async()=>{inboxOffset=Math.max(0,inboxOffset-25);await refreshInbox();}));
$('inbox-next').addEventListener('click',event=>run(event.target,async()=>{inboxOffset+=25;await refreshInbox();}));
window.addEventListener('pagehide',reset);
