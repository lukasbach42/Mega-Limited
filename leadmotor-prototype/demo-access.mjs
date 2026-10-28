import { isDemoSeller } from './demo-team.mjs';
// Coarse prototype roles; these are process-scoped tokens, not production identities.
import { timingSafeEqual } from 'node:crypto';
const grants = {
  intake: new Set(['session', 'submit', 'slots', 'booking']),
  operator: new Set(['session', 'submit', 'slots', 'booking', 'lead', 'events', 'kpi', 'inbox', 'team', 'assignment']),
  seller: new Set(['session', 'inbox', 'lead', 'slots', 'booking', 'events']),
  analyst: new Set(['session', 'kpi']),
};
export function createAuthorization({ token, credentials = [] } = {}) {
  if (!Array.isArray(credentials)) throw new Error('INVALID_CREDENTIALS');
  const entries = [...credentials];
  if (token !== undefined) entries.push({ token, role: 'operator' });
  if (!entries.length) throw new Error('STRONG_DEMO_TOKEN_REQUIRED');
  const seen = new Set();
  const keys = entries.map(entry => {
    if (!entry || !Object.hasOwn(grants, entry.role) || typeof entry.token !== 'string' || entry.token.length < 24 || /[\r\n]/.test(entry.token) || seen.has(entry.token)) throw new Error('INVALID_CREDENTIALS');
    if (entry.role === 'seller' ? !isDemoSeller(entry.sellerId) : entry.sellerId !== undefined) throw new Error('INVALID_CREDENTIALS');
    seen.add(entry.token);
    return { key: Buffer.from(entry.token), role: entry.role, ...(entry.role === 'seller' ? {sellerId:entry.sellerId} : {}) };
  });
  return {
    principal(header) {
      if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
      const supplied = Buffer.from(header.slice(7));
      let principal = null;
      for (const entry of keys) if (supplied.length === entry.key.length && timingSafeEqual(supplied, entry.key)) principal = {role:entry.role, ...(entry.sellerId ? {sellerId:entry.sellerId} : {})};
      return principal;
    },
    identify(header) { return this.principal(header)?.role || null; },
    permits(role, action) { return Object.hasOwn(grants, role) && grants[role].has(action); },
  };
}
export function routeAction(method, path) {
  if (method === 'GET' && path === '/api/leads') return 'inbox';
  if (method === 'GET' && path === '/api/team') return 'team';
  if (method === 'POST' && /^\/api\/leads\/demo-[a-zA-Z0-9-]+\/assignment$/.test(path)) return 'assignment';
  if (method === 'GET' && path === '/api/session') return 'session';
  if (method === 'GET' && path === '/api/slots') return 'slots';
  if (method === 'GET' && path === '/api/kpi') return 'kpi';
  if (method === 'POST' && path === '/api/leads') return 'submit';
  if (method === 'GET' && /^\/api\/leads\/demo-[a-zA-Z0-9-]+$/.test(path)) return 'lead';
  if (method === 'POST' && /^\/api\/leads\/demo-[a-zA-Z0-9-]+\/booking$/.test(path)) return 'booking';
  if (method === 'POST' && /^\/api\/leads\/demo-[a-zA-Z0-9-]+\/events$/.test(path)) return 'events';
  return null;
}
