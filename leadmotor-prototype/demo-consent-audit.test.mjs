import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDemoServer } from "./demo-server.mjs";

const token = "synthetic-consent-audit-test-token";
const syntheticLead = {
  name: "Test Kunde21", phone: "00000021", postcode: "0000",
  preferred_contact: "formiddag", consent: true,
  consent_text_version: "demo-v1", source: "organic",
  utm_campaign: "consent_audit"
};

async function withServer(storageFile, run) {
  const server = createDemoServer({ token, storageFile, now: () => "2026-11-02T08:00:00.000Z" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  const get = (path, auth = token) => fetch(base + path, {
    headers: { Authorization: "Bearer " + auth }
  });
  const post = (path, body) => fetch(base + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  try { return await run({ get, post }); }
  finally { await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())); }
}

test("consent audit is authenticated, minimal and excludes synthetic contact details", async () => {
  await withServer(undefined, async ({ get, post }) => {
    const created = await post("/api/leads", syntheticLead);
    assert.equal(created.status, 201);
    const { leadId } = await created.json();
    const path = "/api/leads/" + leadId + "/consent";
    assert.equal((await get(path, "wrong-token")).status, 401);
    assert.equal((await get("/api/leads/demo-unknown/consent")).status, 404);
    const response = await get(path);
    assert.equal(response.status, 200);
    const audit = await response.json();
    assert.equal(audit.leadId, leadId);
    assert.equal(audit.demoConsentStatus, "recorded");
    assert.equal(audit.textVersion, "demo-v1");
    assert.equal(audit.recordedAt, "2026-11-02T08:00:00.000Z");
    assert.match(audit.consentText, /DEMO ONLY/);
    assert.equal(audit.withdrawnAt, null);
    assert.doesNotMatch(JSON.stringify(audit), /Test Kunde21|00000021|consent_audit/);
    assert.match(audit.disclaimer, /not legal consent evidence/);
    assert.equal((await post("/api/leads/" + leadId + "/events", { type: "consent_withdrawn" })).status, 200);
    const withdrawn = await (await get(path)).json();
    assert.equal(withdrawn.demoConsentStatus, "withdrawn");
    assert.equal(withdrawn.withdrawnAt, "2026-11-02T08:00:00.000Z");
  });
});

test("consent withdrawal evidence survives synthetic journal restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mega-consent-audit-"));
  const storageFile = join(dir, "synthetic.journal");
  try {
    let leadId;
    await withServer(storageFile, async ({ post }) => {
      leadId = (await (await post("/api/leads", syntheticLead)).json()).leadId;
      assert.equal((await post("/api/leads/" + leadId + "/events", { type: "consent_withdrawn" })).status, 200);
    });
    await withServer(storageFile, async ({ get }) => {
      const response = await get("/api/leads/" + leadId + "/consent");
      assert.equal(response.status, 200);
      const audit = await response.json();
      assert.equal(audit.demoConsentStatus, "withdrawn");
      assert.equal(audit.textVersion, "demo-v1");
      assert.equal(audit.withdrawnAt, "2026-11-02T08:00:00.000Z");
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
