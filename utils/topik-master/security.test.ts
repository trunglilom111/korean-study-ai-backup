import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrations = Array.from({ length: 7 }, (_, index) => {
  const number = String(index + 1).padStart(3, "0");
  const names: Record<string, string> = {
    "001": "topik_master_access_profile",
    "002": "topik_master_study_brain",
    "003": "topik_master_learning_data",
    "004": "topik_master_practice_engine",
    "005": "topik_master_results_planner",
    "006": "topik_master_ai_reasoning",
    "007": "topik_master_import_pipeline",
  };
  return readFileSync(join(root, "supabase", "migrations", `202608220${number}_${names[number]}.sql`), "utf8");
});
const sql = migrations.join("\n").toLowerCase();

assert.doesNotMatch(sql, /\bdrop\s+table\b|\btruncate\b|\breset\b/);
assert.match(sql, /is_topik_master_owner/);
assert.match(sql, /revoke all on table public\.topik_master_import_batches from anon/);
assert.match(sql, /topik_master_generated_practice/);
assert.match(sql, /topik_master_import_items/);

const access = readFileSync(join(root, "utils", "topik-master", "access.ts"), "utf8");
assert.match(access, /trunglilom11@gmail\.com/);

const config = readFileSync(join(root, "next.config.ts"), "utf8");
assert.match(config, /X-Frame-Options/);
assert.match(config, /private, no-store/);
assert.match(config, /X-Robots-Tag/);

console.log("TOPIK security and migration verification passed.");
