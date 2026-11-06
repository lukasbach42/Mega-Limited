// Synthetic-only HTTP boundary regression tests. Never use real customer data.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { createDemoServer } from "./demo-server.mjs";

const token = "synthetic-boundary-regression-token";
const payload = JSON.stringify({
  name: "Test Kunde88", phone: "00000088", postcode: "0000",
  preferred_contact: "formiddag", consent: true,
  consent_text_version: "demo-v1", source: "organic"
});

async function withServer(run) {
  const server = createDemoServer({ token, now: () => "2026-11-06T08:00:00.000Z" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try { await run(server.address().port); }
  finally { await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())); }
}

function request(port, { path = "/api/leads", method = "POST", headers = {}, body = payload } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1", port, path, method,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, ...headers }
    }, res => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }));
    });
    req.on("error", reject);
    req.end(method === "POST" ? body : undefined);
  });
}

test("rejects untrusted Host and cross-origin POST before creating a lead", async () => {
  await withServer(async port => {
    const hostileHost = await request(port, { headers: { Host: "attacker.example" } });
    assert.equal(hostileHost.status, 403);
    assert.deepEqual(hostileHost.body, { error: "INVALID_HOST" });

    const hostileOrigin = await request(port, {
      headers: { Host: "127.0.0.1:" + port, Origin: "https://attacker.example" }
    });
    assert.equal(hostileOrigin.status, 403);
    assert.deepEqual(hostileOrigin.body, { error: "INVALID_ORIGIN" });

    const unauthenticated = await request(port, {
      headers: { Authorization: "Bearer wrong-token" }
    });
    assert.equal(unauthenticated.status, 401);
    assert.deepEqual(unauthenticated.body, { error: "UNAUTHORIZED" });

    const kpi = await request(port, { method: "GET", path: "/api/kpi" });
    assert.equal(kpi.status, 200);
    assert.equal(kpi.headers["cache-control"], "no-store");
    assert.equal(kpi.body.totalLeads ?? kpi.body.leads ?? 0, 0);
  });
});

test("invalid content type, malformed JSON and oversized bodies fail closed", async () => {
  await withServer(async port => {
    const type = await request(port, { headers: { "Content-Type": "text/plain" } });
    assert.equal(type.status, 415);
    assert.deepEqual(type.body, { error: "JSON_REQUIRED" });

    const malformed = await request(port, { body: "{" });
    assert.equal(malformed.status, 400);
    assert.deepEqual(malformed.body, { error: "INVALID_JSON" });

    const oversized = await request(port, { body: JSON.stringify({ synthetic: "x".repeat(5000) }) });
    assert.equal(oversized.status, 413);
    assert.deepEqual(oversized.body, { error: "BODY_TOO_LARGE" });
  });
});
