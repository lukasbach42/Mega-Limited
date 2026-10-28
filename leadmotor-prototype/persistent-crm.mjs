// Encrypted, single-writer synthetic demo store. No production data.
import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from 'node:crypto';
import { openSync, readFileSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDemoCRM } from './demo-core.mjs';

export function createPersistentCRM({ file, key, now = () => new Date().toISOString(), makeId = () => 'demo-' + randomUUID() }) {
  if (typeof key !== 'string' || !/^[a-f0-9]{64}$/i.test(key)) throw new Error('STORE_KEY_REQUIRED');
  if (typeof file !== 'string' || !file) throw new Error('STORE_FILE_REQUIRED');
  const path = resolve(file), lock = path + '.lock', temp = path + '.tmp';
  const secret = Buffer.from(key, 'hex');
  // A crash leaves a lock: operator must establish that no writer is running before removing it.
  const fd = openSync(lock, 'wx', 0o600);
  closeSync(fd);
  let commands = [], crm, closed = false;
  function build(log) {
    let replayClock, replayId;
    const candidate = createDemoCRM({ now: () => replayClock(), makeId: () => replayId() });
    let result;
    for (const command of log) {
      if (!['submit', 'book', 'recordEvent'].includes(command.method) || !Array.isArray(command.args)) throw new Error('INVALID_STORE');
      replayClock = () => command.at; replayId = () => command.id;
      result = candidate[command.method](...command.args);
    }
    return { candidate, result };
  }
  try {
    let bytes;
    try { bytes = readFileSync(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (bytes) {
      const envelope = JSON.parse(bytes.toString('utf8'));
      if (envelope.version !== 1) throw new Error('INVALID_STORE');
      const decipher = createDecipheriv('aes-256-gcm', secret, Buffer.from(envelope.iv, 'hex'));
      decipher.setAAD(Buffer.from('mega-synthetic-crm-v1'));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'));
      commands = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8'));
      if (!Array.isArray(commands)) throw new Error('INVALID_STORE');
    }
    crm = build(commands).candidate;
  } catch {
    unlinkSync(lock);
    throw new Error('STORE_OPEN_FAILED');
  }
  function mutate(method, args) {
    if (closed) throw new Error('STORE_CLOSED');
    const command = { method, args: structuredClone(args), at: now(), id: makeId() };
    const next = [...commands, command];
    const { candidate, result } = build(next); // Validate before touching the committed store.
    if (method === 'submit' && result.duplicate) return result;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', secret, iv);
    cipher.setAAD(Buffer.from('mega-synthetic-crm-v1'));
    const data = Buffer.concat([cipher.update(JSON.stringify(next), 'utf8'), cipher.final()]);
    let tempFd;
    try {
      tempFd = openSync(temp, 'wx', 0o600);
      writeFileSync(tempFd, JSON.stringify({ version: 1, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data: data.toString('base64') }));
      fsyncSync(tempFd); closeSync(tempFd); tempFd = undefined;
      renameSync(temp, path);
    } catch {
      if (tempFd !== undefined) closeSync(tempFd);
      // Do not remove a pre-existing temporary file; it may need operator inspection.
      throw new Error('STORE_WRITE_FAILED');
    }
    commands = next; crm = candidate;
    return result;
  }
  const read = method => (...args) => {
    if (closed) throw new Error('STORE_CLOSED');
    return crm[method](...args);
  };
  return {
    submit: input => mutate('submit', [input]),
    book: (id, slot) => mutate('book', [id, slot]),
    recordEvent: (id, type) => mutate('recordEvent', [id, type]),
    getLead: read('getLead'), availableSlots: read('availableSlots'), kpi: read('kpi'),
    close() { if (!closed) { closed = true; secret.fill(0); unlinkSync(lock); } },
  };
}
