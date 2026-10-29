import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createDemoServer } from "./demo-server.mjs";

const token = "synthetic-test-token-at-least-24";
const lead = { name: "Test Kunde9", phone: "00000009", postcode: "0000", preferred_contact: "formiddag", consent: true, consent_text_version: "demo-v1", source: "organic", utm_campaign: "restart_test" };
async function serve(storageFile, fn) {
  const server = createDemoServer({ token, storageFile });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  const post = (path, data) => fetch(base + path, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const get = path => fetch(base + path, { headers: { Authorization: "Bearer " + token } });
  try { return await fn({ post, get }); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test("HTTP API journal retains synthetic lead and KPI across server restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mega-http-"));
  const storageFile = join(dir, "demo.journal");
  try {
    let id;
    await serve(storageFile, async ({ post }) => {
      const response = await post("/api/leads", lead);
      assert.equal(response.status, 201);
      id = (await response.json()).leadId;
      assert.equal((await post("/api/leads/" + id + "/booking", { slotId: "demo-slot-1" })).status, 200);
    });
    await serve(storageFile, async ({ post, get }) => {
      const duplicate = await post("/api/leads", lead);
      assert.equal(duplicate.status, 200);
      assert.equal((await duplicate.json()).leadId, id);
      const slots = await (await get("/api/slots")).json();
      assert.equal(slots[0].available, false);
      const kpi = await (await get("/api/kpi")).json();
      assert.equal(kpi.leads, 1);
      assert.equal(kpi.byChannel["organic/restart_test"].leads, 1);
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
