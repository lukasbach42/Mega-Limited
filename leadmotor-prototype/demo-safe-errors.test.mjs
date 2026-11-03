import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createDemoServer } from "./demo-server.mjs";

test("unexpected internal exception details never reach synthetic API callers", async () => {
  const secret = "/private/internal/synthetic-journal-secret";
  const token = "synthetic-error-redaction-test-token";
  const server = createDemoServer({
    token,
    now: () => { throw new Error(secret); }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch("http://127.0.0.1:" + server.address().port + "/api/leads", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Kunde99", phone: "00000099", postcode: "0000",
        preferred_contact: "formiddag", consent: true,
        consent_text_version: "demo-v1", source: "organic"
      })
    });
    assert.equal(response.status, 422);
    const body = await response.text();
    assert.deepEqual(JSON.parse(body), { error: "INVALID_REQUEST" });
    assert.equal(body.includes(secret), false);
    assert.equal(response.headers.get("cache-control"), "no-store");
  } finally {
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
