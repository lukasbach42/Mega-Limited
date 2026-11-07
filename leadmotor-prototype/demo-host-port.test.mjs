// Synthetic localhost boundary regression. No real customer data.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createDemoServer } from "./demo-server.mjs";

test("Host header rejects out-of-range ports before CRM routing", async () => {
  const server = createDemoServer({ token: "synthetic-test-token-0123456789" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    for (const host of ["localhost:00000", "localhost:65536", "127.0.0.1:99999"]) {
      const response = await new Promise((resolve, reject) => {
        const request = http.request({
          hostname: "127.0.0.1", port, path: "/api/leads",
          method: "GET", headers: { Host: host },
        }, (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => { body += chunk; });
          res.on("end", () => resolve({ status: res.statusCode, body }));
        });
        request.on("error", reject);
        request.end();
      });
      assert.equal(response.status, 403, host);
      assert.deepEqual(JSON.parse(response.body), { error: "INVALID_HOST" });
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
