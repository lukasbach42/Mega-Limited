// Encrypted, single-writer synthetic demo store. No production data.
import { randomBytes, randomUUID, createCipheriv } from 'node:crypto';
import { openSync, readFileSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { storeKey, replayStore, decodeStore } from './store-format.mjs';

export function createPersistentCRM({ file, key, now = () => new Date().toISOString(), makeId = () => 'demo-' + randomUUID() }) {
  const secret = storeKey(key);
  if (typeof file !== 'string' || !file) throw new Error('STORE_FILE_REQUIRED');
  const path = resolve(file), lock = path + '.lock', temp = path + '.tmp';
  // A crash leaves a lock: operator must establish that no writer is running before removing it.
  const fd = openSync(lock, 'wx', 0o600);
  closeSync(fd);
  let commands = [], crm, closed = false;
  try {
    let bytes;
    try { bytes = readFileSync(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (bytes) {
      const decoded = decodeStore(bytes, secret);
      commands = decoded.commands; crm = decoded.candidate;
    } else crm = replayStore(commands).candidate;
  } catch {
    secret.fill(0);
    unlinkSync(lock);
    throw new Error('STORE_OPEN_FAILED');
  }
  function mutate(method, args) {
    if (closed) throw new Error('STORE_CLOSED');
    const command = { method, args: structuredClone(args), at: now(), id: makeId() };
    const next = [...commands, command];
    const { candidate, result } = replayStore(next); // Validate before touching the committed store.
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
