import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJournalDemoCRM } from "./demo-journal.mjs";

function input(n = 1) {
  return { name: "Test Kunde" + n, phone: "0000000" + n, postcode: "0000", preferred_contact: "formiddag", consent: true, consent_text_version: "demo-v1", source: "organic", utm_campaign: "pilot_test" };
}
function withJournal(run) {
  const dir = mkdtempSync(join(tmpdir(), "mega-synthetic-"));
  try { return run(join(dir, "demo.journal")); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

test("journal restores consent, UTM, booking, withdrawal and KPI after restart", () => withJournal(filePath => {
  let crm = createJournalDemoCRM({ filePath, now: () => "2026-10-29T08:00:00.000Z", makeId: () => "demo-uuid1" });
  const id = crm.submit(input()).leadId;
  assert.equal(crm.submit(input()).duplicate, true);
  crm.book(id, "demo-slot-1");
  crm.recordEvent(id, "contacted");
  crm.recordEvent(id, "meeting_held");
  crm.recordEvent(id, "policy_issued");
  crm.recordEvent(id, "clawback");
  crm.recordEvent(id, "consent_withdrawn");
  assert.equal(statSync(filePath).mode & 0o777, 0o600);
  assert.equal(readFileSync(filePath, "utf8").trim().split("\n").length, 7);
  crm = createJournalDemoCRM({ filePath });
  assert.equal(crm.getLead(id).events[0].consentTextVersion, "demo-v1");
  assert.equal(crm.getLead(id).utm.campaign, "pilot_test");
  assert.equal(crm.getLead(id).status, "withdrawn");
  assert.equal(crm.availableSlots()[0].available, true);
  assert.equal(crm.kpi().policies, 1);
  assert.equal(crm.kpi().clawbacks, 1);
  assert.equal(crm.submit(input()).duplicate, true);
  assert.throws(() => crm.recordEvent(id, "contacted"), /CONSENT_WITHDRAWN/);
}));

test("journal rejects real-looking data and does not persist invalid submissions", () => withJournal(filePath => {
  const crm = createJournalDemoCRM({ filePath });
  assert.throws(() => crm.submit({ ...input(), phone: "41293030" }), /SYNTHETIC_ONLY/);
  assert.equal(readFileSync(filePath, "utf8"), "");
}));

test("journal fails closed for corrupt and group-readable storage", () => withJournal(filePath => {
  writeFileSync(filePath, "{bad json}\n", { mode: 0o600 });
  assert.throws(() => createJournalDemoCRM({ filePath }), /CORRUPT_JOURNAL/);
  writeFileSync(filePath, "", { mode: 0o600 });
  chmodSync(filePath, 0o644);
  assert.throws(() => createJournalDemoCRM({ filePath }), /UNSAFE_JOURNAL/);
}));
