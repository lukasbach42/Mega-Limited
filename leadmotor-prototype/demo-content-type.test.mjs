// Synthetic-only regression: reject ambiguous Content-Type values before parsing.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createDemoServer } from "./demo-server.mjs";

test("JSON intake rejects unsupported and malformed content types", async () => {
  const token = "synthetic-test-token-0123456789";
  const server = createDemoServer({ token });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const send = contentType => new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1", port, path: "/api/leads", method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": contentType },
    }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.end("{}");
  });
  try {
    for (const type of [
      "application/json; charset=iso-8859-1",
      "application/json; garbage",
      "application/json; charset=utf-8; extra=1",
      "application/json; charset=",
      "application/json; charset=utf-8, text/plain",
      "text/plain",
    ]) {
      const response = await send(type);
      assert.equal(response.status, 415, type);
      assert.deepEqual(JSON.parse(response.body), { error: "JSON_REQUIRED" });
    }
    for (const type of ["application/json", "application/json; charset=UTF-8"]) {
      const response = await send(type);
      assert.equal(response.status, 422, type); // Accepted media type, invalid synthetic lead.
    }
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
