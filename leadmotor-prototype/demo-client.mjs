// Same-origin API client. Token and active test lead stay only in memory.
export function campaignFromSearch(search) {
  const params = new URLSearchParams(search);
  if (params.getAll('source').length > 1) throw new Error('INVALID_SOURCE');
  const source = params.get('source') || 'test';
  if (!['test','organic','direct','referral'].includes(source)) throw new Error('INVALID_SOURCE');
  const input = { source };
  for (const field of ['utm_source','utm_medium','utm_campaign']) {
    if (params.getAll(field).length > 1) throw new Error('INVALID_UTM');
    const value = params.get(field) || '';
    if (value.length > 80 || (value && !/^[a-zA-Z0-9._-]+$/.test(value))) throw new Error('INVALID_UTM');
    input[field] = value;
  }
  return input;
}
// Interpret a requested time explicitly in Copenhagen; reject invalid or ambiguous DST times.
export function copenhagenContactTime(local) {
  if (!local) return null;
  if (typeof local!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('INVALID_CONTACT_TIME');
  const wall = Date.parse(local+':00.000Z');
  if (!Number.isFinite(wall)||new Date(wall).toISOString()!==local+':00.000Z') throw new Error('INVALID_CONTACT_TIME');
  const formatter = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const matches = [60,120].map(offset=>new Date(wall-offset*60000)).filter(date=>{
    const part=Object.fromEntries(formatter.formatToParts(date).map(p=>[p.type,p.value]));
    return part.year+'-'+part.month+'-'+part.day+'T'+part.hour+':'+part.minute===local;
  });
  if(matches.length!==1) throw new Error('INVALID_CONTACT_TIME');
  return matches[0].toISOString();
}
export function createDemoClient({ token, fetcher = globalThis.fetch }) {
  if (typeof token !== 'string' || token.length < 24) throw new Error('TOKEN_REQUIRED');
  let leadId = null;
  const controller = new AbortController();
  async function request(path, body) {
    if (!token) throw new Error('TOKEN_REQUIRED');
    let response;
    try {
      response = await fetcher(path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: 'Bearer '+token, ...(body === undefined ? {} : {'Content-Type':'application/json'}) },
        cache: 'no-store', redirect: 'error', credentials: 'omit', signal: controller.signal,
        ...(body === undefined ? {} : {body:JSON.stringify(body)}),
      });
    } catch { throw new Error('NETWORK_ERROR'); }
    let data;
    try { data = await response.json(); } catch { throw new Error('INVALID_RESPONSE'); }
    if (!token) throw new Error('TOKEN_REQUIRED');
    if (!response.ok) throw new Error(data.error || 'REQUEST_FAILED');
    return data;
  }
  function activePath() {
    if (!leadId) throw new Error('LEAD_REQUIRED');
    return '/api/leads/'+encodeURIComponent(leadId);
  }
  return {
    session: () => request('/api/session'),
    slots: () => request('/api/slots'),
    inbox: (filters={}) => request('/api/leads?'+new URLSearchParams(filters)),
    team: () => request('/api/team'),
    async openLead(id) {
      if (!/^demo-[a-zA-Z0-9-]+$/.test(id)) throw new Error('INVALID_ID');
      leadId=null;
      const result=await request('/api/leads/'+encodeURIComponent(id));leadId=id;return result;
    },
    assign: (id,assignee,expectedAssignee) => request('/api/leads/'+encodeURIComponent(id)+'/assignment',{assignee,expectedAssignee}),
    kpi: () => request('/api/kpi'),
    async submit(fields, campaign) {
      leadId = null;
      const result = await request('/api/leads', {...fields,...campaign,consent_text_version:'demo-v1'});
      if (!/^demo-[a-zA-Z0-9-]+$/.test(result.leadId)) throw new Error('INVALID_RESPONSE');
      leadId = result.leadId;
      return result;
    },
    lead: () => request(activePath()),
    book: slotId => request(activePath()+'/booking',{slotId}),
    event: type => request(activePath()+'/events',{type}),
    disconnect() { token = ''; leadId = null; controller.abort(); },
  };
}
