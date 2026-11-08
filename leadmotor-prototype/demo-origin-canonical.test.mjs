// Synthetic localhost Origin validation. No personal data.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createDemoServer } from "./demo-server.mjs";

test("rejects non-canonical Origin headers before CRM routing", async () => {
  const server = createDemoServer({ token: "synthetic-test-token-0123456789" });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const host = `127.0.0.1:${port}`;
  const send = (origin) => new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1", port, path: "/api/slots", method: "GET",
      headers: { Host: host, Authorization: "Bearer synthetic-test-token-0123456789", Origin: origin },
    }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.end();
  });
  try {
    for (const origin of [
      `http://evil@127.0.0.1:${port}`,
      `http://127.0.0.1:${port}/other`,
      `http://127.0.0.1:${port}/?track=1`,
      `http://127.0.0.1:${port}/#fragment`,
      `https://127.0.0.1:${port}`,
    ]) {
      const response = await send(origin);
      assert.equal(response.status, 403, origin);
      assert.deepEqual(JSON.parse(response.body), { error: "INVALID_ORIGIN" });
    }
    assert.equal((await send(`http://${host}`)).status, 200);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
