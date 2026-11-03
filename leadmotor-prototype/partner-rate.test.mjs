import test from 'node:test';
import assert from 'node:assert/strict';
import {minimumPartnerRate} from './partner-rate.mjs';
const base={annualPremiumDkk:10000,sellerRatePct:17.7126,validLeadRate:1,contactRate:.6,closeRate:.21,rawCplDkk:90,targetDbPerPolicyDkk:500,expectedPartnerClawbackRate:.05};
test('required partner rate for 90 DKK raw lead and 500 DKK policy contribution',()=>{
 const r=minimumPartnerRate(base);
 assert.equal(r.status,'scenario_only');
 assert.ok(Math.abs(r.requiredPartnerRatePct-33.7069)<.01);
});
test('invalid raw leads and impossible conversion never produce spurious commission',()=>{
 assert.equal(minimumPartnerRate({...base,validLeadRate:0}).status,'no_conversion');
 assert.throws(()=>minimumPartnerRate({...base,rawCplDkk:-1}),RangeError);
});
test('lower valid rate increases required partner commission',()=>{
 assert.ok(minimumPartnerRate({...base,validLeadRate:2/3}).requiredPartnerRatePct>
 minimumPartnerRate(base).requiredPartnerRatePct);
});
test('seller clawback recovery lowers required commission',()=>{
 assert.ok(minimumPartnerRate({...base,sellerRecovery:true}).requiredPartnerRatePct<
 minimumPartnerRate(base).requiredPartnerRatePct);
});
