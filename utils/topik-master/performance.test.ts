import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const assetDirectory = join(root, "public", "topik-master");
const assets = readdirSync(assetDirectory).map((name) => ({ name, bytes: statSync(join(assetDirectory, name)).size }));
const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
assert.ok(assets.every((asset) => asset.bytes <= 500_000), `TOPIK asset exceeds 500 KB: ${JSON.stringify(assets)}`);
assert.ok(totalBytes <= 1_000_000, `TOPIK public assets exceed 1 MB: ${totalBytes}`);

const page = readFileSync(join(root, "app", "topik-master", "page.tsx"), "utf8");
const css = readFileSync(join(root, "app", "topik-master", "topik-master.module.css"), "utf8");
assert.match(page, /tiger-mascot\.webp/);
assert.match(page, /sizes="\(max-width: 699px\) 64vw, 390px"/);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(css, /button:focus-visible/);
assert.match(css, /@media \(max-width: 699px\)/);

console.log(`TOPIK performance budget verification passed (${Math.round(totalBytes / 1024)} KB public assets).`);
