import { DEMO_SELLERS, isDemoSeller } from './demo-team.mjs';
// Mega Limited: synthetic-only in-memory prototype. NOT a production CRM. Never supply real personal data.
export function createDemoCRM({now=()=>new Date().toISOString(),makeId=()=>`demo-${Math.random().toString(36).slice(2,14)}`}={}) {
  const leads=new Map(), phones=new Map(), reservations=new Map();
  const slots=["demo-slot-1","demo-slot-2"];
  const consentText="DEMO ONLY: I consent to a simulated contact from Mega Limited. No real booking or outreach.";
  const fail=code=>{const error=new Error(code);error.code=code;throw error;};
  const tracking=value=>{
    if(value===undefined||value===null||value==="") return "";
    if(typeof value!=="string"||value.length>80||!/^[a-zA-Z0-9._-]+$/.test(value)) fail("INVALID_UTM");
    return value;
  };
  const snapshot=lead=>JSON.parse(JSON.stringify(lead));
  function submit(input){
    if(!input||typeof input!=="object"||Array.isArray(input)) fail("INVALID_INPUT");
    const allowed=["name","phone","postcode","preferred_contact","requested_contact_at","consent","consent_text_version","source","utm_source","utm_medium","utm_campaign"];
    if(Object.keys(input).some(key=>!allowed.includes(key))) fail("UNKNOWN_FIELD");
    if(typeof input.name!=="string"||!/^Test [A-Za-z0-9 -]{2,60}$/.test(input.name)) fail("SYNTHETIC_ONLY");
    if(typeof input.phone!=="string"||!/^0000[0-9]{4}$/.test(input.phone)||input.postcode!=="0000") fail("SYNTHETIC_ONLY");
    if(input.consent!==true||input.consent_text_version!=="demo-v1") fail("CONSENT_REQUIRED");
    if(!["formiddag","eftermiddag"].includes(input.preferred_contact)) fail("INVALID_CONTACT_WINDOW");
    if(!["test","organic","direct","referral"].includes(input.source)) fail("INVALID_SOURCE");
    const requestedContactAt=input.requested_contact_at??null;
    if(requestedContactAt!==null && (typeof requestedContactAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(requestedContactAt)||!Number.isFinite(Date.parse(requestedContactAt))||new Date(requestedContactAt).toISOString()!==requestedContactAt)) fail('INVALID_CONTACT_TIME');
    const utm={source:tracking(input.utm_source),medium:tracking(input.utm_medium),campaign:tracking(input.utm_campaign)};
    if(phones.has(input.phone)) return {duplicate:true,leadId:phones.get(input.phone)};
    const id=makeId();
    if(typeof id!=="string"||!id.startsWith("demo-")||leads.has(id)) fail("INVALID_ID");
    const timestamp=now();
    const lead={id,name:input.name,phone:input.phone,postcode:"0000",preferredContact:input.preferred_contact,requestedContactAt,assignee:null,source:input.source,utm,status:"new",booking:null,events:[{type:"consent_recorded",at:timestamp,consentTextVersion:"demo-v1",consentText}]};
    leads.set(id,lead);phones.set(input.phone,id);
    return {duplicate:false,leadId:id};
  }
  function getLead(id){const lead=leads.get(id);if(!lead) fail("NOT_FOUND");return snapshot(lead);}
  function team(){return snapshot(DEMO_SELLERS);}
  function listLeads({status='active',assignee='all',offset=0,limit=25}={}){
    const statuses=['active','all','new','booked','contacted','meeting_held','policy_issued','clawback','withdrawn'];
    if(!statuses.includes(status)||!['all','unassigned',...DEMO_SELLERS.map(s=>s.id)].includes(assignee)||!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>50) fail('INVALID_FILTER');
    const matches=[...leads.values()].filter(lead=>(status==='all'||(status==='active'?lead.status!=='withdrawn':lead.status===status))&&(assignee==='all'||(assignee==='unassigned'?lead.assignee===null:lead.assignee===assignee)));
    matches.reverse();
    return {total:matches.length,offset,limit,items:matches.slice(offset,offset+limit).map(lead=>snapshot({id:lead.id,name:lead.name,phone:lead.phone,preferredContact:lead.preferredContact,requestedContactAt:lead.requestedContactAt,assignee:lead.assignee,status:lead.status,booking:lead.booking,source:lead.source,utm:lead.utm,createdAt:lead.events[0].at}))};
  }
  function assign(id,assignee,expectedAssignee){
    const lead=leads.get(id);if(!lead) fail('NOT_FOUND');
    if(lead.status==='withdrawn') fail('CONSENT_WITHDRAWN');
    if((assignee!==null&&!isDemoSeller(assignee))||(expectedAssignee!==null&&!isDemoSeller(expectedAssignee))) fail('INVALID_ASSIGNEE');
    if(lead.assignee!==expectedAssignee) fail('ASSIGNMENT_CONFLICT');
    if(lead.assignee===assignee) return getLead(id);
    const previousAssignee=lead.assignee;
    lead.assignee=assignee;lead.events.push({type:'assigned',at:now(),previousAssignee,assignee});
    return getLead(id);
  }
  function availableSlots(){return slots.map(id=>({id,available:!reservations.has(id),kind:"synthetic_only"}));}
  function book(id,slotId){
    const lead=leads.get(id);if(!lead) fail("NOT_FOUND");
    if(!slots.includes(slotId)) fail("INVALID_SLOT");
    if(reservations.has(slotId)) fail("SLOT_TAKEN");
    if(!["new","contacted"].includes(lead.status)||lead.booking) fail("INVALID_TRANSITION");
    reservations.set(slotId,id);lead.booking=slotId;lead.status="booked";
    lead.events.push({type:"booked",at:now(),slotId});
    return getLead(id);
  }
  function recordEvent(id,type){
    const lead=leads.get(id);if(!lead) fail("NOT_FOUND");
    if(!["contacted","meeting_held","policy_issued","clawback","consent_withdrawn"].includes(type)) fail("INVALID_EVENT");
    if(lead.status==="withdrawn") fail("CONSENT_WITHDRAWN");
    const valid={
      contacted:["new","booked"],
      meeting_held:["booked","contacted"],
      policy_issued:["meeting_held"],
      clawback:["policy_issued"],
      consent_withdrawn:["new","booked","contacted","meeting_held","policy_issued","clawback"]
    };
    if(!valid[type].includes(lead.status)) fail("INVALID_TRANSITION");
    if(type==="consent_withdrawn"){
      if(lead.booking){reservations.delete(lead.booking);lead.booking=null;}
      lead.assignee=null;lead.status="withdrawn";
    } else lead.status=type;
    lead.events.push({type,at:now()});
    return getLead(id);
  }
  function kpi(){
    const all=[...leads.values()];
    const count=type=>all.filter(l=>l.events.some(e=>e.type===type)).length;
    const byChannel={};
    for(const lead of all){
      const key=`${lead.source}/${lead.utm.campaign||"(none)"}`;
      if(!byChannel[key]) byChannel[key]={leads:0,contacted:0,meetings:0,policies:0,clawbacks:0};
      const row=byChannel[key];row.leads++;
      if(lead.events.some(e=>e.type==="contacted")) row.contacted++;
      if(lead.events.some(e=>e.type==="meeting_held")) row.meetings++;
      if(lead.events.some(e=>e.type==="policy_issued")) row.policies++;
      if(lead.events.some(e=>e.type==="clawback")) row.clawbacks++;
    }
    return {leads:all.length,contacted:count("contacted"),meetings:count("meeting_held"),policies:count("policy_issued"),clawbacks:count("clawback"),withdrawn:count("consent_withdrawn"),byChannel,disclaimer:"Synthetic test data only; no 6-month retention or real conversion data."};
  }
  return {submit,getLead,listLeads,team,assign,availableSlots,book,recordEvent,kpi};
}

export function calculateLeadEconomics({annualPremium=10000,partnerRate=25,sellerRate=17.7126,contactRate=0.6,closeRate=0.21,clawbackProbability=0.05,sellerClawbackRecoverable=false,cpl=100,fixedCostPerPolicy=0,targetDb=500}={}){
  const numeric={annualPremium,partnerRate,sellerRate,contactRate,closeRate,clawbackProbability,cpl,fixedCostPerPolicy,targetDb};
  if(Object.values(numeric).some(x=>!Number.isFinite(x)||x<0)||partnerRate>100||sellerRate>100||contactRate>1||closeRate>1||clawbackProbability>1) throw new RangeError("INVALID_ECONOMICS_INPUT");
  const conversion=contactRate*closeRate;
  const partnerCommission=annualPremium*partnerRate/100;
  const sellerPay=annualPremium*sellerRate/100;
  const grossMargin=partnerCommission-sellerPay;
  const expectedClawback=clawbackProbability*(partnerCommission-(sellerClawbackRecoverable?sellerPay:0));
  const marginBeforeLeads=grossMargin-expectedClawback-fixedCostPerPolicy;
  const leadCostPerPolicy=conversion>0?cpl/conversion:null;
  const dbPerPolicy=conversion>0?marginBeforeLeads-leadCostPerPolicy:null;
  return {conversion,partnerCommission,sellerPay,grossMargin,expectedClawback,marginBeforeLeads,leadCostPerPolicy,dbPerPolicy,breakEvenCpl:Math.max(0,marginBeforeLeads*conversion),maxCplAtTarget:Math.max(0,(marginBeforeLeads-targetDb)*conversion),sellerClawbackRecoverable};
}
