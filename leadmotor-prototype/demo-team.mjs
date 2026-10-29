// Synthetic internal team only; no real people, email addresses or external recipients.
export const DEMO_SELLERS = Object.freeze([
  Object.freeze({id:'demo-seller-1',name:'Testsælger 1'}),
  Object.freeze({id:'demo-seller-2',name:'Testsælger 2'}),
]);
export function isDemoSeller(id) { return DEMO_SELLERS.some(seller=>seller.id===id); }
