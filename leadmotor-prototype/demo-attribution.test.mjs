import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { parseDemoAttribution } from "./demo-attribution.mjs";
import { createDemoServer } from "./demo-server.mjs";

test("organic, direct and referral URL parameters map to correct CRM channel", () => {
  assert.deepEqual(parseDemoAttribution("?utm_source=linkedin&utm_medium=organic&utm_campaign=mega_launch"), {
    source: "organic", utm_source: "linkedin", utm_medium: "organic", utm_campaign: "mega_launch"
  });
  assert.equal(parseDemoAttribution("?utm_medium=referral").source, "referral");
  assert.equal(parseDemoAttribution("?utm_medium=direct").source, "direct");
  assert.equal(parseDemoAttribution("").source, "test");
});

test("URL parser rejects PII-like, malformed, duplicate and paid tracking", () => {
  assert.throws(() => parseDemoAttribution("?utm_campaign=alice%40example.com"), /INVALID_UTM/);
  assert.throws(() => parseDemoAttribution("?utm_campaign=%3Cscript%3E"), /INVALID_UTM/);
  assert.throws(() => parseDemoAttribution("?utm_source=a&utm_source=b"), /DUPLICATE_UTM/);
  assert.throws(() => parseDemoAttribution("?utm_medium=paid"), /UNSUPPORTED_DEMO_MEDIUM/);
  assert.throws(() => parseDemoAttribution("?" + "a".repeat(1025)), /INVALID_QUERY/);
});

test("localhost HTTP API receives synthetic attribution and reports campaign KPI", async () => {
  const token = "synthetic-test-token-at-least-24";
  const server = createDemoServer({ token });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    const moduleResponse = await fetch(base + "/demo-attribution.mjs");
    assert.equal(moduleResponse.status, 200);
    assert.match(await moduleResponse.text(), /parseDemoAttribution/);
    const html = await (await fetch(base + "/demo-console")).text();
    assert.match(html, /type="module"/);
    const tracking = parseDemoAttribution("?utm_source=linkedin&utm_medium=organic&utm_campaign=mega_launch");
    const response = await fetch(base + "/api/leads", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Kunde7", phone: "00000007", postcode: "0000",
        preferred_contact: "formiddag", consent: true, consent_text_version: "demo-v1",
        ...tracking
      })
    });
    assert.equal(response.status, 201);
    const kpi = await fetch(base + "/api/kpi", { headers: { Authorization: "Bearer " + token } });
    assert.equal((await kpi.json()).byChannel["organic/mega_launch"].leads, 1);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
