// Shared encrypted demo format: validation is identical for startup and recovery.
import { createDecipheriv } from 'node:crypto';
import { createDemoCRM } from './demo-core.mjs';

export function storeKey(key) {
  if (typeof key !== 'string' || !/^[a-f0-9]{64}$/i.test(key)) throw new Error('STORE_KEY_REQUIRED');
  return Buffer.from(key, 'hex');
}

export function replayStore(log) {
  if (!Array.isArray(log)) throw new Error('INVALID_STORE');
  let current;
  const candidate = createDemoCRM({ now: () => current.at, makeId: () => current.id });
  let result;
  for (const command of log) {
    if (!command || !['submit', 'book', 'recordEvent', 'assign'].includes(command.method) || !Array.isArray(command.args)) throw new Error('INVALID_STORE');
    current = command;
    result = candidate[command.method](...command.args);
  }
  return { candidate, result };
}

export function decodeStore(bytes, secret) {
  const envelope = JSON.parse(bytes.toString('utf8'));
  if (envelope.version !== 1 || !/^[a-f0-9]{24}$/i.test(envelope.iv) || !/^[a-f0-9]{32}$/i.test(envelope.tag) || typeof envelope.data !== 'string') throw new Error('INVALID_STORE');
  const decipher = createDecipheriv('aes-256-gcm', secret, Buffer.from(envelope.iv, 'hex'));
  decipher.setAAD(Buffer.from('mega-synthetic-crm-v1'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'));
  const commands = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8'));
  return { commands, ...replayStore(commands) };
}
