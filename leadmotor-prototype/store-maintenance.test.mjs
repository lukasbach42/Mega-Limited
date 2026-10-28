import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createCipheriv } from 'node:crypto';
import { createPersistentCRM } from './persistent-crm.mjs';
import { backupDemoStore, restoreDemoStore } from './store-maintenance.mjs';
const key = 'ef'.repeat(32);
const input = n => ({name:'Test Recovery'+n,phone:'0000000'+n,postcode:'0000',preferred_contact:'eftermiddag',consent:true,consent_text_version:'demo-v1',source:'organic',utm_source:'test',utm_medium:'organic',utm_campaign:'recovery'});
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(),'mega-recovery-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const options = {file:join(dir,'source.enc'),backupFile:join(dir,'backup.enc'),key};
  const crm = createPersistentCRM(options);
  const a=crm.submit(input(1)).leadId, b=crm.submit(input(2)).leadId;
  crm.book(a,'demo-slot-1');crm.recordEvent(a,'contacted');crm.recordEvent(a,'meeting_held');crm.recordEvent(a,'policy_issued');
  crm.book(b,'demo-slot-2');
  const state={a:crm.getLead(a),b:crm.getLead(b),kpi:crm.kpi()};
  crm.close();
  return {...options,dir,state};
}

test('verified encrypted backup restores consent, attribution, reservations and KPI to a new store', t=>{
  const f=fixture(t),before=readFileSync(f.file);
  assert.equal(backupDemoStore(f).bytes,before.length);
  assert.deepEqual(readFileSync(f.backupFile),before);
  assert.ok(!readFileSync(f.backupFile,'utf8').includes('Test Recovery'));
  const restored=join(f.dir,'restored.enc');
  restoreDemoStore({...f,file:restored});
  const crm=createPersistentCRM({file:restored,key});
  try {
    assert.deepEqual(crm.getLead(f.state.a.id),f.state.a);
    assert.deepEqual(crm.getLead(f.state.b.id),f.state.b);
    assert.deepEqual(crm.kpi(),f.state.kpi);
    assert.deepEqual(crm.submit(input(1)),{duplicate:true,leadId:f.state.a.id});
    assert.equal(crm.availableSlots().every(slot=>!slot.available),true);
    crm.recordEvent(f.state.b.id,'consent_withdrawn');
    assert.equal(crm.availableSlots()[1].available,true);
  } finally {crm.close();}
  assert.deepEqual(readFileSync(f.file),before);
  assert.deepEqual(readFileSync(f.backupFile),before);
});

test('backup and restore refuse existing destinations without modifying either file',t=>{
  const f=fixture(t);backupDemoStore(f);
  const source=readFileSync(f.file),backup=readFileSync(f.backupFile);
  assert.throws(()=>backupDemoStore(f),/STORE_DESTINATION_EXISTS/);
  assert.throws(()=>restoreDemoStore(f),/STORE_DESTINATION_EXISTS/);
  assert.deepEqual(readFileSync(f.file),source);assert.deepEqual(readFileSync(f.backupFile),backup);
  assert.equal(existsSync(f.file+'.lock'),false);assert.equal(existsSync(f.backupFile+'.lock'),false);
});

test('maintenance respects active CRM and stale locks and never removes someone else\'s lock',t=>{
  const f=fixture(t),crm=createPersistentCRM(f);
  try {
    assert.throws(()=>backupDemoStore(f),/STORE_IN_USE/);
    assert.equal(existsSync(f.backupFile),false);
    assert.equal(existsSync(f.file+'.lock'),true);
  } finally {crm.close();}
  backupDemoStore(f);
  const target=join(f.dir,'new.enc');writeFileSync(target+'.lock','stale marker');
  assert.throws(()=>restoreDemoStore({...f,file:target}),/STORE_IN_USE/);
  assert.equal(readFileSync(target+'.lock','utf8'),'stale marker');
  assert.equal(existsSync(target),false);assert.equal(existsSync(f.backupFile+'.lock'),false);
});

test('wrong key and corrupt backup are rejected before creating a destination',t=>{
  const f=fixture(t);backupDemoStore(f);
  const target=join(f.dir,'new.enc');
  assert.throws(()=>restoreDemoStore({...f,file:target,key:'aa'.repeat(32)}),/STORE_VERIFICATION_FAILED/);
  const envelope=JSON.parse(readFileSync(f.backupFile,'utf8'));envelope.tag='00'.repeat(16);
  writeFileSync(f.backupFile,JSON.stringify(envelope));
  assert.throws(()=>restoreDemoStore({...f,file:target}),/STORE_VERIFICATION_FAILED/);
  assert.equal(existsSync(target),false);assert.equal(existsSync(target+'.lock'),false);
  assert.equal(existsSync(f.backupFile+'.lock'),false);
});

test('authenticated but invalid command log is rejected by replay, not just decryption',t=>{
  const f=fixture(t),iv=Buffer.alloc(12,1),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);
  cipher.setAAD(Buffer.from('mega-synthetic-crm-v1'));
  const data=Buffer.concat([cipher.update(JSON.stringify([{method:'submit',args:[{...input(1),consent:false}],id:'demo-invalid',at:'2026-10-28T10:00:00.000Z'}])),cipher.final()]);
  writeFileSync(f.backupFile,JSON.stringify({version:1,iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),data:data.toString('base64')}));
  const target=join(f.dir,'new.enc');
  assert.throws(()=>restoreDemoStore({...f,file:target}),/STORE_VERIFICATION_FAILED/);
  assert.equal(existsSync(target),false);
});

test('bad destination and identical paths preserve source and release acquired locks',t=>{
  const f=fixture(t),before=readFileSync(f.file);
  assert.throws(()=>backupDemoStore({...f,backupFile:f.file}),/STORE_DISTINCT_PATHS_REQUIRED/);
  assert.throws(()=>backupDemoStore({...f,backupFile:join(f.dir,'missing','backup.enc')}),/ENOENT/);
  assert.equal(existsSync(f.file+'.lock'),false);assert.deepEqual(readFileSync(f.file),before);
});

test('offline CLI backs up and restores, reports generic errors and requires environment key',t=>{
  const f=fixture(t),script=fileURLToPath(new URL('./store-maintenance.mjs',import.meta.url));
  const run=(args,secret=key)=>spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,DEMO_STORE_KEY:secret}});
  const backup=run(['backup',f.file,f.backupFile]);assert.equal(backup.status,0,backup.stderr);
  const target=join(f.dir,'cli-restored.enc');
  assert.equal(run(['restore',f.backupFile,target]).status,0);
  const missing=run(['backup',f.file,join(f.dir,'no-key.enc')],'');
  assert.equal(missing.status,1);assert.match(missing.stderr,/STORE_KEY_REQUIRED/);
  const error=run(['restore',join(f.dir,'missing.enc'),join(f.dir,'unused.enc')]);
  assert.equal(error.status,1);assert.match(error.stderr,/STORE_MAINTENANCE_FAILED/);
  assert.ok(!error.stderr.includes(f.dir));assert.ok(!error.stderr.includes(key));
  assert.equal(run(['delete',f.file,target]).status,1);
});
