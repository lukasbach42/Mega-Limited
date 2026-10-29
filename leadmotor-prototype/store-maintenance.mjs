// Offline only. Copies authenticated ciphertext to a NEW file; never overwrites.
import { randomUUID } from 'node:crypto';
import { openSync, closeSync, readFileSync, writeFileSync, fsyncSync, linkSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { storeKey, decodeStore } from './store-format.mjs';

function copyVerifiedStore({ source, destination, key }) {
  const secret = storeKey(key);
  const locks = [];
  let temp, fd;
  try {
    if (typeof source !== 'string' || !source || typeof destination !== 'string' || !destination) throw new Error('STORE_PATHS_REQUIRED');
    source = resolve(source); destination = resolve(destination);
    const comparable = path => process.platform === 'win32' ? path.toLowerCase() : path;
    if (comparable(source) === comparable(destination)) throw new Error('STORE_DISTINCT_PATHS_REQUIRED');
    // Same protocol as the CRM writer. Never remove locks we did not acquire.
    for (const path of [source, destination].sort()) {
      let lockFd;
      try { lockFd = openSync(path + '.lock', 'wx', 0o600); }
      catch (error) { if (error.code === 'EEXIST') throw new Error('STORE_IN_USE'); throw error; }
      locks.push(path + '.lock'); closeSync(lockFd);
    }
    const bytes = readFileSync(source);
    try { decodeStore(bytes, secret); } catch { throw new Error('STORE_VERIFICATION_FAILED'); }
    const candidate = destination + '.' + randomUUID() + '.tmp';
    fd = openSync(candidate, 'wx', 0o600); temp = candidate;
    writeFileSync(fd, bytes); fsyncSync(fd); closeSync(fd); fd = undefined;
    // Atomic, no-clobber publication: rename alone could overwrite an existing file.
    try { linkSync(temp, destination); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('STORE_DESTINATION_EXISTS'); throw error; }
    return { bytes: bytes.length };
  } finally {
    secret.fill(0);
    try { if (fd !== undefined) closeSync(fd); }
    finally {
      try { if (temp) unlinkSync(temp); }
      finally { for (const lock of locks.reverse()) unlinkSync(lock); }
    }
  }
}

export function backupDemoStore({ file, backupFile, key }) {
  return copyVerifiedStore({ source: file, destination: backupFile, key });
}
export function restoreDemoStore({ backupFile, file, key }) {
  return copyVerifiedStore({ source: backupFile, destination: file, key });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [operation, source, destination, ...extra] = process.argv.slice(2);
  try {
    if (!['backup', 'restore'].includes(operation) || !source || !destination || extra.length) throw new Error('STORE_USAGE');
    copyVerifiedStore({ source, destination, key: process.env.DEMO_STORE_KEY });
    console.log('Verified encrypted synthetic store copied to a new file.');
  } catch (error) {
    const safe = ['STORE_USAGE', 'STORE_KEY_REQUIRED', 'STORE_PATHS_REQUIRED', 'STORE_DISTINCT_PATHS_REQUIRED', 'STORE_IN_USE', 'STORE_VERIFICATION_FAILED', 'STORE_DESTINATION_EXISTS'];
    console.error(safe.includes(error.message) ? error.message : 'STORE_MAINTENANCE_FAILED');
    if (error.message === 'STORE_USAGE') console.error('Usage: node store-maintenance.mjs backup|restore SOURCE DESTINATION (key: DEMO_STORE_KEY environment variable)');
    process.exitCode = 1;
  }
}
