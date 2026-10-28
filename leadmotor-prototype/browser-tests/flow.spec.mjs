import { test as base, expect } from '@playwright/test';
import { once } from 'node:events';
import { createDemoServer } from '../demo-server.mjs';
const operator='browser-synthetic-operator-at-least-24',intake='browser-synthetic-intake-at-least-24',analyst='browser-synthetic-analyst-at-least-24';
const test=base.extend({
  app:async({},use)=>{
    const server=createDemoServer({token:operator,credentials:[{token:intake,role:'intake'},{token:analyst,role:'analyst'},{token:'browser-synthetic-seller-one-token-at-least-24',role:'seller',sellerId:'demo-seller-1'},{token:'browser-synthetic-seller-two-token-at-least-24',role:'seller',sellerId:'demo-seller-2'}]});
    server.listen(0,'127.0.0.1');await once(server,'listening');
    try {await use('http://127.0.0.1:'+server.address().port);}
    finally {await new Promise(resolve=>server.close(resolve));}
  },
});
async function login(page,app,token=operator,query='') {
  await page.goto(app+'/'+query);await page.getByLabel('Midlertidig testadgang fra demoserveren').fill(token);
  await page.getByRole('button',{name:'Åbn test',exact:true}).click();
  await expect(page.locator('#session-status')).toContainText('Testrolle:');
  await expect(page.locator('#token')).toHaveValue('');
}
async function submit(page,n=1) {
  await page.getByLabel('Testnavn',{exact:true}).fill('Test Browser'+n);
  await page.getByLabel('Testtelefon',{exact:true}).fill('0000000'+n);
  await page.getByLabel('Jeg bekræfter kun dette simulerede testsamtykke.').check();
  await page.getByRole('button',{name:'Gem testlead',exact:true}).click();
  await expect(page.locator('#lead-status')).toContainText('Testlead gemt.');
}

test('complete form, consent, attribution, dedup, booking, withdrawal and new lead journey',async({page,app},testInfo)=>{
  const failures=[];page.on('pageerror',error=>failures.push(error.message));
  await login(page,app,operator,'?source=organic&utm_source=local&utm_medium=organic&utm_campaign=browser_flow');
  await page.getByRole('button',{name:'Gem testlead',exact:true}).click();
  await expect(page.locator('#lead-status')).toBeEmpty(); // Native consent constraint prevents submission.
  await submit(page);
  await expect(page.locator('#lead-record')).toContainText('browser_flow');
  await expect(page.locator('#lead-record')).toContainText('demo-v1');
  await page.getByLabel('Jeg bekræfter kun dette simulerede testsamtykke.').check();
  await page.getByRole('button',{name:'Gem testlead',exact:true}).click();
  await expect(page.locator('#lead-status')).toContainText('Eksisterende testlead');
  await expect(page.locator('#kpi')).toContainText('"leads": 1');
  await page.getByLabel('Ledigt kunstigt slot').selectOption('demo-slot-1');
  await page.getByRole('button',{name:'Reserver testslot',exact:true}).click();
  await expect(page.locator('#booking-status')).toBeVisible();
  await expect(page.locator('#booking-status')).toContainText('Testbooking bekræftet');
  await expect(page.locator('#lead-record')).toContainText('"status": "booked"');
  await page.screenshot({path:testInfo.outputPath('synthetic-leadflow.png'),fullPage:true});
  await page.getByLabel('Næste testhændelse').selectOption('consent_withdrawn');
  await page.getByRole('button',{name:'Registrer testhændelse'}).click();
  await expect(page.locator('#lead-record')).toContainText('"status": "withdrawn"');
  await expect(page.getByRole('button',{name:'Registrer testhændelse'})).toBeDisabled();
  await submit(page,2); // New lead resets booking controls after previous lead was booked/withdrawn.
  await expect(page.locator('#booking-form')).toBeVisible();
  await page.getByLabel('Ledigt kunstigt slot').selectOption('demo-slot-1');
  await page.getByRole('button',{name:'Reserver testslot',exact:true}).click();
  await expect(page.locator('#booking-status')).toContainText('Testbooking bekræftet');
  expect(failures).toEqual([]);
});

test('intake and analyst see only permitted controls, and logout clears active view',async({page,app})=>{
  await login(page,app,intake);await submit(page);
  await expect(page.locator('#crm')).toBeHidden();await expect(page.locator('#reporting')).toBeHidden();
  await page.getByRole('button',{name:'Luk testsession'}).click();
  await expect(page.locator('#lead-status')).toBeEmpty();await expect(page.locator('#booking')).toBeHidden();
  await page.locator('#token').fill(analyst);await page.getByRole('button',{name:'Åbn test',exact:true}).click();
  await expect(page.locator('#session-status')).toContainText('KPI-læser');
  await expect(page.locator('#intake')).toBeHidden();await expect(page.locator('#crm')).toBeHidden();
  await expect(page.locator('#kpi')).toContainText('"leads": 1');
});

test('stale slot selection shows conflict without losing the saved lead',async({page,context,app})=>{
  const other=await context.newPage();
  await login(page,app);await submit(page,1);
  await login(other,app);await submit(other,2);
  await expect(other.locator('#slot')).toHaveValue('demo-slot-1');
  await page.getByRole('button',{name:'Reserver testslot',exact:true}).click();
  await expect(page.locator('#booking-status')).toContainText('Testbooking bekræftet');
  await other.getByRole('button',{name:'Reserver testslot',exact:true}).click();
  await expect(other.locator('#error')).toContainText('Testslottet er optaget');
  await expect(other.locator('#lead-status')).toContainText('Testlead gemt');
  await expect(other.locator('#booking-status')).not.toContainText('bekræftet');
  await other.getByRole('button',{name:'Opdater ledige testslots'}).click();
  await expect(other.locator('#slot')).toHaveValue('demo-slot-2');
  await other.getByRole('button',{name:'Reserver testslot',exact:true}).click();
  await expect(other.locator('#booking-status')).toContainText('demo-slot-2');
});

test('failed network submission has no success/booking state and can be retried',async({page,app})=>{
  await login(page,app);
  await page.route('**/api/leads',route=>route.abort('failed'));
  await page.getByLabel('Jeg bekræfter kun dette simulerede testsamtykke.').check();
  await page.getByRole('button',{name:'Gem testlead',exact:true}).click();
  await expect(page.locator('#error')).toContainText('Ingen bekræftelse');
  await expect(page.locator('#lead-status')).toBeEmpty();await expect(page.locator('#booking')).toBeHidden();
  await page.unroute('**/api/leads');await submit(page);
  await expect(page.locator('#kpi')).toContainText('"leads": 1');
});

test('invalid token is rejected and URL campaign validation does not execute markup',async({page,app})=>{
  await page.goto(app+'/?utm_campaign=%3Cscript%3E');
  await expect(page.locator('#error')).toContainText('Kampagnefelter');
  await page.locator('#token').fill('invalid-synthetic-token-at-least-24');
  await page.getByRole('button',{name:'Åbn test',exact:true}).click();
  await expect(page.locator('#error')).toContainText('ugyldig');
  await expect(page.locator('#intake')).toBeHidden();await expect(page.locator('#token')).toHaveValue('');
});


test('operator inbox distributes to own sellers; reallocation removes prior seller access',async({page,context,app},testInfo)=>{
  await login(page,app);
  await page.getByLabel('Ønsket kontakttid (valgfrit, dansk tid)').fill('2026-11-02T10:30');
  await submit(page);
  const row=page.locator('#inbox-rows tr').filter({hasText:'Test Browser1'});
  await expect(row).toContainText('10.30');
  await row.getByLabel('Ansvarlig for Test Browser1').selectOption('demo-seller-1');
  await row.getByRole('button',{name:'Gem fordeling'}).click();
  await expect(page.locator('#lead-record')).toContainText('demo-seller-1');
  const seller=await context.newPage();await login(seller,app,'browser-synthetic-seller-one-token-at-least-24');
  await expect(seller.locator('#inbox-rows')).toContainText('Test Browser1');
  await expect(seller.locator('#intake')).toBeHidden();await expect(seller.locator('#reporting')).toBeHidden();
  await seller.getByRole('button',{name:'Åbn Test Browser1'}).click();
  await expect(seller.locator('#lead-record')).toContainText('demo-seller-1');
  await page.screenshot({path:testInfo.outputPath('synthetic-inbox-assignment.png'),fullPage:true});
  await row.getByLabel('Ansvarlig for Test Browser1').selectOption('demo-seller-2');
  await row.getByRole('button',{name:'Gem fordeling'}).click();
  await expect(page.locator('#lead-record')).toContainText('demo-seller-2');
  await seller.getByRole('button',{name:'Registrer testhændelse'}).click();
  await expect(seller.locator('#error')).toContainText('ikke længere tilgængeligt');
  await expect(seller.locator('#lead-record')).toBeEmpty();
  await seller.getByRole('button',{name:'Opdater indbakke'}).click();
  await expect(seller.locator('#inbox-status-text')).toContainText('Ingen henvendelser');
  await page.locator('#inbox-owner').selectOption('unassigned');await page.getByRole('button',{name:'Opdater indbakke'}).click();
  await expect(page.locator('#inbox-status-text')).toContainText('Ingen henvendelser');
});
