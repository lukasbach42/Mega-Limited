import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createAuthorization, routeAction } from './demo-access.mjs';
import { createDemoClient, campaignFromSearch } from './demo-client.mjs';
import { createDemoServer } from './demo-server.mjs';
const operator='synthetic-operator-token-at-least-24',intake='synthetic-intake-token-at-least-24',analyst='synthetic-analyst-token-at-least-24';
const fields={name:'Test Flow',phone:'00000001',postcode:'0000',preferred_contact:'formiddag',consent:true};
const campaign=campaignFromSearch('?source=organic&utm_source=test&utm_medium=organic&utm_campaign=journey');
async function serverFixture(t) {
  const server=createDemoServer({token:operator,credentials:[{token:intake,role:'intake'},{token:analyst,role:'analyst'}]});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
  const url='http://127.0.0.1:'+server.address().port;
  return {url,client:token=>createDemoClient({token,fetcher:(path,options)=>fetch(url+path,options)})};
}

test('roles validate credentials, deny unknown actions and match routes exactly',()=>{
  assert.throws(()=>createAuthorization(),/STRONG_DEMO_TOKEN_REQUIRED/);
  assert.throws(()=>createAuthorization({token:'short'}),/INVALID_CREDENTIALS/);
  assert.throws(()=>createAuthorization({credentials:[{token:operator,role:'admin'}]}),/INVALID_CREDENTIALS/);
  assert.throws(()=>createAuthorization({token:operator,credentials:[{token:operator,role:'analyst'}]}),/INVALID_CREDENTIALS/);
  const access=createAuthorization({token:operator,credentials:[{token:analyst,role:'analyst'}]});
  assert.equal(access.identify('Bearer '+analyst),'analyst');assert.equal(access.identify('Bearer wrong'),null);
  assert.equal(access.permits('analyst','kpi'),true);assert.equal(access.permits('analyst','lead'),false);
  assert.equal(access.permits('__proto__','events'),false);assert.equal(access.permits('operator','delete'),false);
  assert.equal(routeAction('GET','/api/leads/demo-1'),'lead');assert.equal(routeAction('POST','/api/leads/demo-1/booking'),'booking');
  assert.equal(routeAction('GET','/api/leads/demo-1/booking'),null);assert.equal(routeAction('GET','/api/kpi/extra'),null);
});
test('campaign extraction rejects duplicate/invalid attribution and ignores unrelated query fields',()=>{
  assert.equal(campaign.utm_campaign,'journey');
  assert.throws(()=>campaignFromSearch('?utm_campaign=a&utm_campaign=b'),/INVALID_UTM/);
  assert.throws(()=>campaignFromSearch('?source=test&source=organic'),/INVALID_SOURCE/);
  assert.throws(()=>campaignFromSearch('?utm_source=%3Cscript%3E'),/INVALID_UTM/);
  assert.throws(()=>campaignFromSearch('?source=unverified'),/INVALID_SOURCE/);
  assert.deepEqual(campaignFromSearch('?name=Ignored'),{source:'test',utm_source:'',utm_medium:'',utm_campaign:''});
});
test('client requires acknowledged lead before booking and clears state after submit failure/disconnect',async()=>{
  let calls=0;
  const client=createDemoClient({token:operator,fetcher:async()=>{calls++;return {ok:false,json:async()=>({error:'STORAGE_UNAVAILABLE'})};}});
  assert.throws(()=>client.book('demo-slot-1'),/LEAD_REQUIRED/);
  await assert.rejects(()=>client.submit(fields,campaign),/STORAGE_UNAVAILABLE/);
  assert.throws(()=>client.lead(),/LEAD_REQUIRED/);assert.equal(calls,1);
  client.disconnect();await assert.rejects(()=>client.kpi(),/TOKEN_REQUIRED/);assert.equal(calls,1);
  const offline=createDemoClient({token:operator,fetcher:async()=>{throw new Error('private network details');}});
  await assert.rejects(()=>offline.session(),/^Error: NETWORK_ERROR$/);
});
test('HTTP role boundaries apply before body processing and never expose CRM to intake/analyst',async t=>{
  const {url,client}=await serverFixture(t);const sender=client(intake),reader=client(analyst);
  assert.deepEqual(await sender.session(),{role:'intake',syntheticOnly:true});
  const lead=await sender.submit(fields,campaign);await sender.book('demo-slot-1');
  await assert.rejects(()=>sender.lead(),/FORBIDDEN/);await assert.rejects(()=>sender.kpi(),/FORBIDDEN/);
  await assert.rejects(()=>sender.event('consent_withdrawn'),/FORBIDDEN/);
  await assert.rejects(()=>reader.slots(),/FORBIDDEN/);
  await assert.rejects(()=>reader.submit(fields,campaign),/FORBIDDEN/);
  assert.equal((await reader.kpi()).leads,1);
  const forbidden=await fetch(url+'/api/leads/'+lead.leadId+'/events',{method:'POST',headers:{Authorization:'Bearer '+analyst,'Content-Type':'text/plain'},body:'not-json'});
  assert.equal(forbidden.status,403);
  assert.equal((await fetch(url+'/api/kpi')).status,401);
});
test('HTTP browser client journey preserves consent/UTM, dedup, booking, withdrawal and KPI',async t=>{
  const {client}=await serverFixture(t),crm=client(operator);
  const first=await crm.submit(fields,campaign);
  assert.equal(first.duplicate,false);await crm.book('demo-slot-1');
  const initial=await crm.lead();assert.equal(initial.utm.campaign,'journey');assert.equal(initial.events[0].consentTextVersion,'demo-v1');
  const repeat=await crm.submit(fields,{...campaign,utm_campaign:'must_not_overwrite'});
  assert.equal(repeat.duplicate,true);assert.deepEqual(await crm.lead(),initial);
  await crm.event('contacted');await crm.event('meeting_held');await crm.event('policy_issued');await crm.event('consent_withdrawn');
  await assert.rejects(()=>crm.event('contacted'),/CONSENT_WITHDRAWN/);
  assert.equal((await crm.slots())[0].available,true);
  const kpi=await crm.kpi();assert.equal(kpi.leads,1);assert.equal(kpi.policies,1);assert.equal(kpi.withdrawn,1);
  assert.equal(kpi.byChannel['organic/journey'].policies,1);
});
test('HTTP static allowlist serves no credentials/backend files and uses same-origin security headers',async t=>{
  const {url}=await serverFixture(t);
  const page=await fetch(url+'/');assert.equal(page.status,200);
  const html=await page.text();assert.ok(html.includes('INTERN TEST'));assert.ok(!html.includes(operator));
  assert.match(page.headers.get('content-security-policy'),/script-src 'self'/);assert.equal(page.headers.get('referrer-policy'),'no-referrer');
  for(const path of ['/demo-ui.mjs','/demo-ui.css','/demo-client.mjs']) assert.equal((await fetch(url+path)).status,200);
  for(const path of ['/persistent-crm.mjs','/demo-access.mjs','/store-maintenance.mjs','/.env']) assert.notEqual((await fetch(url+path)).status,200);
  assert.equal((await fetch(url+'/',{headers:{Origin:'https://example.invalid'}})).status,403);
});
