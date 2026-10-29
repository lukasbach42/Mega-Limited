import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDemoCRM } from './demo-core.mjs';
import { createPersistentCRM } from './persistent-crm.mjs';
import { backupDemoStore,restoreDemoStore } from './store-maintenance.mjs';
import { createDemoServer } from './demo-server.mjs';
import { createAuthorization } from './demo-access.mjs';
import { copenhagenContactTime } from './demo-client.mjs';
const input=n=>({name:'Test Inbox'+n,phone:'0000'+String(n).padStart(4,'0'),postcode:'0000',preferred_contact:'formiddag',requested_contact_at:'2026-11-02T09:30:00.000Z',consent:true,consent_text_version:'demo-v1',source:'test'});
const options=()=>{let id=0;return {makeId:()=> 'demo-'+(++id),now:()=> '2026-10-28T15:00:00.000Z'};};
const op='synthetic-inbox-operator-token-at-least-24',s1='synthetic-inbox-seller-one-token-at-least-24',s2='synthetic-inbox-seller-two-token-at-least-24';
async function fixture(t){
  const server=createDemoServer({token:op,credentials:[{token:s1,role:'seller',sellerId:'demo-seller-1'},{token:s2,role:'seller',sellerId:'demo-seller-2'},{token:'synthetic-inbox-intake-token-at-least-24',role:'intake'},{token:'synthetic-inbox-analyst-token-at-least-24',role:'analyst'}]});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port;
  const req=(token,path,body)=>fetch(url+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {url,req};
}

test('inbox lists newest leads with bounded pagination and validates all filters',()=>{
  const crm=createDemoCRM(options());for(let n=1;n<=28;n++)crm.submit(input(n));
  const first=crm.listLeads();assert.equal(first.total,28);assert.equal(first.items.length,25);assert.equal(first.items[0].name,'Test Inbox28');
  assert.equal(first.items[0].requestedContactAt,'2026-11-02T09:30:00.000Z');assert.equal('events' in first.items[0],false);
  assert.equal(crm.listLeads({offset:25}).items.length,3);
  for(const filters of [{limit:51},{offset:-1},{status:'invalid'},{assignee:'someone@example.invalid'}])assert.throws(()=>crm.listLeads(filters),/INVALID_FILTER/);
  first.items[0].name='changed';assert.equal(crm.listLeads().items[0].name,'Test Inbox28');
});
test('assignment is audited, detects stale updates and withdrawal removes ownership',()=>{
  const crm=createDemoCRM(options()),id=crm.submit(input(1)).leadId;
  crm.assign(id,'demo-seller-1',null);
  assert.equal(crm.listLeads({assignee:'unassigned'}).total,0);
  assert.equal(crm.listLeads({assignee:'demo-seller-1'}).total,1);
  const before=crm.getLead(id).events.length;
  crm.assign(id,'demo-seller-1','demo-seller-1');assert.equal(crm.getLead(id).events.length,before);
  assert.throws(()=>crm.assign(id,'demo-seller-2',null),/ASSIGNMENT_CONFLICT/);
  crm.assign(id,'demo-seller-2','demo-seller-1');
  assert.deepEqual(crm.getLead(id).events.at(-1),{type:'assigned',at:'2026-10-28T15:00:00.000Z',previousAssignee:'demo-seller-1',assignee:'demo-seller-2'});
  crm.recordEvent(id,'consent_withdrawn');assert.equal(crm.getLead(id).assignee,null);assert.equal(crm.listLeads().total,0);
  assert.equal(crm.listLeads({status:'withdrawn'}).total,1);assert.throws(()=>crm.assign(id,'demo-seller-1',null),/CONSENT_WITHDRAWN/);
  assert.equal(crm.kpi().leads,1);
});
test('requested contact date is optional, canonical and separate from booking',()=>{
  const crm=createDemoCRM(options());const id=crm.submit(input(1)).leadId;
  assert.equal(crm.getLead(id).booking,null);assert.equal(crm.availableSlots().every(s=>s.available),true);
  for(const value of [false,0,'not-a-date','2026-02-30T09:30:00.000Z','2026-11-02T09:30:00+01:00'])assert.throws(()=>crm.submit({...input(2),requested_contact_at:value}),/INVALID_CONTACT_TIME/);
  const legacy=input(2);delete legacy.requested_contact_at;const old=crm.submit(legacy).leadId;assert.equal(crm.getLead(old).requestedContactAt,null);
  assert.equal(copenhagenContactTime('2026-11-02T10:30'),'2026-11-02T09:30:00.000Z');
  assert.equal(copenhagenContactTime('2026-07-02T10:30'),'2026-07-02T08:30:00.000Z');
  assert.throws(()=>copenhagenContactTime('2026-03-29T02:30'),/INVALID_CONTACT_TIME/);
  assert.throws(()=>copenhagenContactTime('2026-10-25T02:30'),/INVALID_CONTACT_TIME/);
  assert.throws(()=>copenhagenContactTime('2026-02-30T10:30'),/INVALID_CONTACT_TIME/);
});
test('seller credentials must bind to a configured synthetic internal seller',()=>{
  assert.throws(()=>createAuthorization({credentials:[{token:s1,role:'seller'}]}),/INVALID_CREDENTIALS/);
  assert.throws(()=>createAuthorization({credentials:[{token:s1,role:'seller',sellerId:'external-company'}]}),/INVALID_CREDENTIALS/);
  const access=createAuthorization({credentials:[{token:s1,role:'seller',sellerId:'demo-seller-1'}]});
  assert.deepEqual(access.principal('Bearer '+s1),{role:'seller',sellerId:'demo-seller-1'});
  assert.equal(access.permits('seller','assignment'),false);
});
test('HTTP own sellers can access only currently assigned leads, including after reallocation',async t=>{
  const {req}=await fixture(t);const created=await req(op,'/api/leads',input(1)),id=(await created.json()).leadId;
  assert.equal((await req(s1,'/api/leads/'+id)).status,404);
  assert.equal((await req(s1,'/api/leads')).status,200);assert.equal((await (await req(s1,'/api/leads')).json()).total,0);
  const body={assignee:'demo-seller-1',expectedAssignee:null};assert.equal((await req(s1,'/api/leads/'+id+'/assignment',body)).status,403);
  assert.equal((await req(op,'/api/leads/'+id+'/assignment',body)).status,200);
  assert.equal((await req(s1,'/api/leads/'+id)).status,200);assert.equal((await req(s2,'/api/leads/'+id)).status,404);
  assert.equal((await req(s1,'/api/leads?assignee=all')).status,403);
  assert.equal((await req(s1,'/api/team')).status,403);assert.equal((await req(s1,'/api/kpi')).status,403);
  assert.equal((await req(s2,'/api/leads/'+id+'/events',{type:'contacted'})).status,404);
  assert.equal((await req(s2,'/api/leads/'+id+'/booking',{slotId:'demo-slot-1'})).status,404);
  assert.equal((await req(op,'/api/leads/'+id+'/assignment',{assignee:'demo-seller-2',expectedAssignee:null})).status,409);
  assert.equal((await req(op,'/api/leads/'+id+'/assignment',{assignee:'demo-seller-2',expectedAssignee:'demo-seller-1'})).status,200);
  assert.equal((await req(s1,'/api/leads/'+id+'/events',{type:'contacted'})).status,404);
  assert.equal((await req(s2,'/api/leads/'+id+'/events',{type:'contacted'})).status,200);
  assert.equal((await req(s2,'/api/leads/'+id+'/events',{type:'consent_withdrawn'})).status,200);
  assert.equal((await req(s2,'/api/leads/'+id)).status,404);
  assert.equal((await (await req(s2,'/api/leads?status=all')).json()).total,0);
});
test('HTTP inbox rejects unknown or duplicate query fields and intake/analyst cannot list personal lead data',async t=>{
  const {req}=await fixture(t);
  for(const query of ['limit=100','offset=-1','offset=1e2','status=new&status=all','email=x','status=unknown'])assert.equal((await req(op,'/api/leads?'+query)).status,422);
  for(const token of ['synthetic-inbox-intake-token-at-least-24','synthetic-inbox-analyst-token-at-least-24']){
    assert.equal((await req(token,'/api/leads')).status,403);assert.equal((await req(token,'/api/team')).status,403);
  }
  const team=await (await req(op,'/api/team')).json();assert.equal(team.length,2);
  assert.ok(team.every(person=>!('email' in person)));
});
test('persistent inbox assignment and requested time survive restart and encrypted recovery',t=>{
  const dir=mkdtempSync(join(tmpdir(),'mega-inbox-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const storage={file:join(dir,'source.enc'),key:'ab'.repeat(32)};
  let crm=createPersistentCRM(storage);const id=crm.submit(input(1)).leadId;crm.assign(id,'demo-seller-1',null);const before=crm.getLead(id);crm.close();
  crm=createPersistentCRM(storage);assert.deepEqual(crm.getLead(id),before);crm.close();
  const backupFile=join(dir,'backup.enc');backupDemoStore({...storage,backupFile});const restored=join(dir,'restored.enc');restoreDemoStore({...storage,file:restored,backupFile});
  crm=createPersistentCRM({...storage,file:restored});try{assert.deepEqual(crm.getLead(id),before);assert.equal(crm.listLeads({assignee:'demo-seller-1'}).total,1);}finally{crm.close();}
});

test('HTTP owner-operated inbox keeps assignment labels without creating seller access',async t=>{
  const server=createDemoServer({token:op});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const url='http://127.0.0.1:'+server.address().port;
  const req=(token,path,body)=>fetch(url+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const id=(await (await req(op,'/api/leads',input(1))).json()).leadId;
  assert.equal((await req(op,'/api/leads/'+id+'/assignment',{assignee:'demo-seller-1',expectedAssignee:null})).status,200);
  assert.equal((await (await req(op,'/api/leads')).json()).items[0].assignee,'demo-seller-1');
  assert.equal((await req(s1,'/api/leads')).status,401);
  assert.equal((await req(s2,'/api/leads/'+id)).status,401);
  assert.deepEqual(await (await req(op,'/api/session')).json(),{role:'operator',syntheticOnly:true});
});
