import assert from "node:assert/strict";

const baseUrl = process.env.TOPIK_TEST_BASE_URL || "http://localhost:3000";
const page = await fetch(`${baseUrl}/topik-master`, { redirect: "manual" });
assert.ok([307, 308].includes(page.status), `Expected auth redirect, received ${page.status}`);
assert.match(page.headers.get("location") || "", /\/login\?next=\/topik-master/);
assert.match(page.headers.get("cache-control") || "", /no-store|no-cache/);
assert.equal(page.headers.get("x-frame-options"), "DENY");
assert.match(page.headers.get("x-robots-tag") || "", /noindex/);

const api = await fetch(`${baseUrl}/api/topik-master/dashboard`);
assert.equal(api.status, 401);
assert.match(api.headers.get("cache-control") || "", /no-store/);
assert.equal(api.headers.get("x-content-type-options"), "nosniff");

console.log("TOPIK anonymous smoke verification passed.");
