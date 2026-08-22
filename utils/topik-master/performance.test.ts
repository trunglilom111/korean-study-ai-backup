import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const assetDirectory = join(root, "public", "topik-master");
function collectAssets(directory: string, prefix = ""): Array<{ name: string; bytes: number }> {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    const relativeName = prefix ? `${prefix}/${name}` : name;
    return statSync(path).isDirectory()
      ? collectAssets(path, relativeName)
      : [{ name: relativeName, bytes: statSync(path).size }];
  });
}

const assets = collectAssets(assetDirectory);
const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
assert.ok(assets.every((asset) => asset.bytes <= 750_000), `TOPIK asset exceeds 750 KB: ${JSON.stringify(assets)}`);
assert.ok(totalBytes <= 8_000_000, `TOPIK public assets exceed 8 MB: ${totalBytes}`);

const page = readFileSync(join(root, "app", "topik-master", "page.tsx"), "utf8");
const css = readFileSync(join(root, "app", "topik-master", "topik-master.module.css"), "utf8");
assert.match(page, /tiger-mascot\.webp/);
assert.match(page, /sizes="\(max-width: 699px\) 64vw, 390px"/);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(css, /button:focus-visible/);
assert.match(css, /@media \(max-width: 699px\)/);

console.log(`TOPIK performance budget verification passed (${Math.round(totalBytes / 1024)} KB public assets).`);
