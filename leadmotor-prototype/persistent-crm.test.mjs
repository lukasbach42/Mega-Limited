import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { createPersistentCRM } from './persistent-crm.mjs';
import { createDemoServer } from './demo-server.mjs';
const key = 'ab'.repeat(32);
const input = n => ({ name: 'Test Kunde'+n, phone: '0000000'+n, postcode:'0000', preferred_contact:'formiddag', consent:true, consent_text_version:'demo-v1', source:'organic', utm_campaign:'restart_test' });
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'mega-synthetic-'));
  t.after(() => rmSync(dir, { recursive:true, force:true }));
  return { file:join(dir,'crm.enc'), key };
}
test('restart preserves consent, UTM, dedup, bookings and historical KPI', t => {
  const options = fixture(t);
  let crm = createPersistentCRM(options);
  const id = crm.submit(input(1)).leadId;
  crm.book(id,'demo-slot-1');
  crm.recordEvent(id,'contacted');
  crm.recordEvent(id,'meeting_held');
  crm.recordEvent(id,'policy_issued');
  const before = crm.getLead(id), kpi = crm.kpi();
  crm.close();
  assert.ok(!readFileSync(options.file,'utf8').includes('Test Kunde'));
  crm = createPersistentCRM(options);
  try {
    assert.deepEqual(crm.getLead(id),before);
    assert.deepEqual(crm.kpi(),kpi);
    const bytes = readFileSync(options.file);
    assert.deepEqual(crm.submit(input(1)),{duplicate:true,leadId:id});
    assert.deepEqual(readFileSync(options.file),bytes);
    const other = crm.submit(input(2)).leadId;
    assert.throws(() => crm.book(other,'demo-slot-1'), /SLOT_TAKEN/);
    crm.recordEvent(id,'consent_withdrawn');
  } finally { crm.close(); }
  crm = createPersistentCRM(options);
  try {
    assert.equal(crm.availableSlots()[0].available,true);
    assert.throws(() => crm.recordEvent(id,'contacted'), /CONSENT_WITHDRAWN/);
    assert.equal(crm.kpi().withdrawn,1);
    assert.equal(crm.kpi().policies,1);
  } finally { crm.close(); }
});
test('wrong key, tampering and concurrent writer fail closed', t => {
  const options=fixture(t), crm=createPersistentCRM(options);
  crm.submit(input(1));
  assert.throws(() => createPersistentCRM(options), /EEXIST/);
  crm.close();
  assert.throws(() => createPersistentCRM({...options,key:'cd'.repeat(32)}), /STORE_OPEN_FAILED/);
  assert.equal(existsSync(options.file+'.lock'), false);
  const envelope=JSON.parse(readFileSync(options.file,'utf8'));
  envelope.tag='00'.repeat(16);
  writeFileSync(options.file,JSON.stringify(envelope));
  assert.throws(() => createPersistentCRM(options), /STORE_OPEN_FAILED/);
});
test('failed validation and write leave committed memory and disk unchanged', t => {
  const options=fixture(t),crm=createPersistentCRM(options);
  try {
    crm.submit(input(1));
    const before=readFileSync(options.file),kpi=crm.kpi();
    assert.throws(() => crm.submit({...input(2),consent:false}), /CONSENT_REQUIRED/);
    writeFileSync(options.file+'.tmp','simulated interrupted write');
    assert.throws(() => crm.submit(input(2)), /STORE_WRITE_FAILED/);
    assert.deepEqual(crm.kpi(),kpi);
    assert.deepEqual(readFileSync(options.file),before);
    assert.equal(readFileSync(options.file+'.tmp','utf8'),'simulated interrupted write');
  } finally { crm.close(); }
  assert.throws(() => crm.kpi(), /STORE_CLOSED/);
});
test('persistent HTTP lead read requires token and rejects foreign Host and Origin', async t => {
  const storage=fixture(t), token='synthetic-test-token-at-least-24';
  let server;
  const start=async()=>{
    server=createDemoServer({token,storage});server.listen(0,'127.0.0.1');await once(server,'listening');
    return 'http://127.0.0.1:'+server.address().port;
  };
  const stop=()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  let url=await start();let id;
  try {
    const response=await fetch(url+'/api/leads',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(input(1))});
    assert.equal(response.status,201);id=(await response.json()).leadId;
  } finally { await stop(); }
  url=await start();
  try {
    assert.equal((await fetch(url+'/api/leads/'+id)).status,401);
    const headers={Authorization:'Bearer '+token};
    const response=await fetch(url+'/api/leads/'+id,{headers});
    assert.equal(response.status,200);
    assert.equal((await response.json()).events[0].consentTextVersion,'demo-v1');
    assert.equal((await fetch(url+'/api/kpi',{headers:{...headers,Origin:'https://example.invalid'}})).status,403);
    const status = await new Promise((resolve,reject) => {
      const request = http.get(url+'/api/kpi',{headers:{...headers,Host:'example.invalid'}},response=>{response.resume();resolve(response.statusCode);});
      request.on('error',reject);
    });
    assert.equal(status,403);
  } finally { await stop(); }
});
