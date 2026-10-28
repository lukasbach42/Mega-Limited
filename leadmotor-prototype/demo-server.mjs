// Local-only synthetic demo API. NOT production-ready. Never use with real personal data.
import http from "node:http";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPersistentCRM } from "./persistent-crm.mjs";
import { createDemoCRM } from "./demo-core.mjs";

const MAX_BODY_BYTES = 4096;
const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'",
};

function reply(res, status, data) {
  res.writeHead(status, jsonHeaders);
  res.end(JSON.stringify(data));
}

function authenticated(header, token) {
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function readBody(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "")) {
    const err = new Error("JSON_REQUIRED"); err.status = 415; throw err;
  }
  let bytes = 0;
  const parts = [];
  for await (const part of req) {
    bytes += part.length;
    if (bytes > MAX_BODY_BYTES) {
      const err = new Error("BODY_TOO_LARGE"); err.status = 413; throw err;
    }
    parts.push(part);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    const err = new Error("INVALID_JSON"); err.status = 400; throw err;
  }
}

export function createDemoServer({ token, now, makeId, storage } = {}) {
  if (typeof token !== "string" || token.length < 24) throw new Error("STRONG_DEMO_TOKEN_REQUIRED");
  const options = { now, makeId: makeId || (() => "demo-" + randomUUID()) };
  const crm = storage ? createPersistentCRM({ ...options, ...storage }) : createDemoCRM(options);
  const windows = new Map();
  const server = http.createServer(async (req, res) => {
    try {
      // Only loopback traffic is accepted. Host and Origin checks mitigate DNS rebinding.
      if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress)) {
        return reply(res, 403, { error: "LOOPBACK_ONLY" });
      }
      const host = req.headers.host || "";
      if (!/^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/.test(host)) {
        return reply(res, 403, { error: "INVALID_HOST" });
      }
      if (req.headers.origin) {
        let origin;
        try { origin = new URL(req.headers.origin); } catch { return reply(res, 403, { error: "INVALID_ORIGIN" }); }
        if (origin.protocol !== "http:" || origin.host !== host) {
          return reply(res, 403, { error: "INVALID_ORIGIN" });
        }
      }
      if (!authenticated(req.headers.authorization, token)) {
        return reply(res, 401, { error: "UNAUTHORIZED" });
      }
      const ip = req.socket.remoteAddress;
      const minute = Math.floor(Date.now() / 60000);
      const entry = windows.get(ip);
      const hits = entry && entry.minute === minute ? entry.hits + 1 : 1;
      windows.set(ip, { minute, hits });
      if (hits > 60) return reply(res, 429, { error: "RATE_LIMIT" });
      const path = new URL(req.url, "http://127.0.0.1").pathname;
      if (req.method === "GET" && path === "/api/slots") return reply(res, 200, crm.availableSlots());
      if (req.method === "GET" && path === "/api/kpi") return reply(res, 200, crm.kpi());
      if (req.method === "POST" && path === "/api/leads") {
        const result = crm.submit(await readBody(req));
        return reply(res, result.duplicate ? 200 : 201, result);
      }
      const leadPath = /^\/api\/leads\/(demo-[a-zA-Z0-9-]+)$/.exec(path);
      if (req.method === "GET" && leadPath) return reply(res, 200, crm.getLead(leadPath[1]));
      const booking = /^\/api\/leads\/(demo-[a-zA-Z0-9-]+)\/booking$/.exec(path);
      if (req.method === "POST" && booking) {
        const body = await readBody(req);
        if (!body || Object.keys(body).length !== 1 || typeof body.slotId !== "string") {
          return reply(res, 422, { error: "INVALID_BOOKING" });
        }
        const lead = crm.book(booking[1], body.slotId);
        return reply(res, 200, { leadId: lead.id, status: lead.status, slotId: lead.booking });
      }
      const event = /^\/api\/leads\/(demo-[a-zA-Z0-9-]+)\/events$/.exec(path);
      if (req.method === "POST" && event) {
        const body = await readBody(req);
        if (!body || Object.keys(body).length !== 1 || typeof body.type !== "string") {
          return reply(res, 422, { error: "INVALID_EVENT" });
        }
        const lead = crm.recordEvent(event[1], body.type);
        return reply(res, 200, { leadId: lead.id, status: lead.status });
      }
      return reply(res, 404, { error: "NOT_FOUND" });
    } catch (err) {
      if (err.message?.startsWith("STORE_")) return reply(res, 503, { error: "STORAGE_UNAVAILABLE" });
      const status = err.status || (err.code === "NOT_FOUND" ? 404 : 422);
      return reply(res, status, { error: err.code || err.message || "INVALID_REQUEST" });
    }
  });
  server.once("close", () => crm.close?.());
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const token = randomBytes(32).toString("hex");
  const file = process.env.DEMO_STORE_FILE;
  const key = process.env.DEMO_STORE_KEY;
  if (Boolean(file) !== Boolean(key)) throw new Error("STORE_FILE_AND_KEY_REQUIRED");
  const server = createDemoServer({ token, storage: file ? { file, key } : undefined });
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close());
  server.listen(8787, "127.0.0.1", () => {
    console.log("Synthetic-only demo API on http://127.0.0.1:8787");
    console.log("Temporary Bearer token (local development only):", token);
    console.log("Never submit real names, numbers, or other personal data.");
  });
}
