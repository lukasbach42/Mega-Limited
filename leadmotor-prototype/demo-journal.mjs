// Local, synthetic-only, append-only CRM journal. NOT a production datastore.
// No real names, telephone numbers, postcodes or external network traffic.
import { randomUUID } from "node:crypto";
import { constants, closeSync, fstatSync, fsyncSync, openSync, readFileSync, writeSync } from "node:fs";
import { createDemoCRM } from "./demo-core.mjs";

const MAX_JOURNAL_BYTES = 1024 * 1024;
const MAX_RECORD_BYTES = 4096;
function failure(code, cause) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  return error;
}
function openPrivateJournal(filePath) {
  if (typeof filePath !== "string" || !filePath) throw failure("STORAGE_PATH_REQUIRED");
  try {
    const fd = openSync(filePath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    closeSync(fd);
  } catch (error) {
    if (error.code !== "EEXIST") throw failure("STORAGE_UNAVAILABLE", error);
  }
  let fd;
  try {
    fd = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.size > MAX_JOURNAL_BYTES) {
      throw failure("UNSAFE_JOURNAL");
    }
    return readFileSync(fd, "utf8");
  } catch (error) {
    throw error.code === "UNSAFE_JOURNAL" ? error : failure("STORAGE_UNAVAILABLE", error);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
function appendRecord(filePath, record) {
  const bytes = Buffer.from(JSON.stringify(record) + "\n", "utf8");
  if (bytes.length > MAX_RECORD_BYTES) throw failure("STORAGE_UNAVAILABLE");
  let fd;
  try {
    fd = openSync(filePath, constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW);
    const stat = fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.size + bytes.length > MAX_JOURNAL_BYTES) {
      throw failure("STORAGE_UNAVAILABLE");
    }
    let written = 0;
    while (written < bytes.length) written += writeSync(fd, bytes, written, bytes.length - written);
    fsyncSync(fd);
  } catch (error) {
    throw failure("STORAGE_UNAVAILABLE", error);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function createJournalDemoCRM({ filePath, now = () => new Date().toISOString(), makeId = () => "demo-" + randomUUID() } = {}) {
  const contents = openPrivateJournal(filePath);
  let eventTime = null;
  let replayId = null;
  let unavailable = false;
  const crm = createDemoCRM({
    now: () => eventTime ?? now(),
    makeId: () => replayId ?? makeId(),
  });
  if (contents && !contents.endsWith("\n")) throw failure("CORRUPT_JOURNAL");
  for (const line of contents.split("\n").filter(Boolean)) {
    if (Buffer.byteLength(line, "utf8") > MAX_RECORD_BYTES) throw failure("CORRUPT_JOURNAL");
    try {
      const record = JSON.parse(line);
      if (record.v !== 1 || typeof record.at !== "string" || !Number.isFinite(Date.parse(record.at))) {
        throw failure("CORRUPT_JOURNAL");
      }
      eventTime = record.at;
      if (record.op === "submit") {
        if (typeof record.leadId !== "string" || !/^demo-[a-zA-Z0-9-]+$/.test(record.leadId)) throw failure("CORRUPT_JOURNAL");
        replayId = record.leadId;
        const result = crm.submit(record.input);
        if (result.duplicate || result.leadId !== record.leadId) throw failure("CORRUPT_JOURNAL");
      } else if (record.op === "book") {
        crm.book(record.leadId, record.slotId);
      } else if (record.op === "event") {
        crm.recordEvent(record.leadId, record.type);
      } else {
        throw failure("CORRUPT_JOURNAL");
      }
    } catch (error) {
      throw failure("CORRUPT_JOURNAL", error);
    } finally {
      eventTime = null;
      replayId = null;
    }
  }
  function mutate(record, fn) {
    if (unavailable) throw failure("STORAGE_UNAVAILABLE");
    const at = now();
    eventTime = at;
    let result;
    try { result = fn(); } finally { eventTime = null; }
    if (record.op === "submit" && result.duplicate) return result;
    try {
      appendRecord(filePath, { v: 1, at, ...record, ...(record.op === "submit" ? { leadId: result.leadId } : {}) });
    } catch (error) {
      unavailable = true; // fail closed after an uncertain disk write
      throw error;
    }
    return result;
  }
  return {
    submit: input => mutate({ op: "submit", input }, () => crm.submit(input)),
    book: (leadId, slotId) => mutate({ op: "book", leadId, slotId }, () => crm.book(leadId, slotId)),
    recordEvent: (leadId, type) => mutate({ op: "event", leadId, type }, () => crm.recordEvent(leadId, type)),
    getLead: id => crm.getLead(id),
    availableSlots: () => crm.availableSlots(),
    kpi: () => crm.kpi(),
  };
}
