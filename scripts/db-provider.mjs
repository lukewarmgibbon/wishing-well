#!/usr/bin/env node
/**
 * Switches the Prisma datasource between SQLite (local dev) and PostgreSQL
 * (anything deployed) without maintaining two schema files that can drift.
 *
 *   node scripts/db-provider.mjs to postgresql
 *   node scripts/db-provider.mjs to sqlite
 *   node scripts/db-provider.mjs to auto      # derive it from DATABASE_URL
 *   node scripts/db-provider.mjs show
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCHEMA = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma", "schema.prisma");
const PROVIDERS = ["sqlite", "postgresql"];

const source = readFileSync(SCHEMA, "utf8");
const match = source.match(/(datasource\s+db\s*\{[^}]*?provider\s*=\s*"([^"]+)")/s);

if (!match) {
  console.error("Could not find a `datasource db { provider = ... }` block in prisma/schema.prisma.");
  process.exit(1);
}

const current = match[2];
let target = process.argv[3];

/**
 * Pick the provider from DATABASE_URL.
 *
 * This exists because schema.prisma is committed as `sqlite` (that is what
 * local development uses), and Prisma resolves the provider at build time. A
 * deployment that sets a Postgres DATABASE_URL but never flips the provider
 * builds a client that points at a `file:` URL, and then every database page
 * fails at runtime with a datasource error that looks nothing like its cause.
 * Deriving it means the deploy cannot be wired up wrong.
 */
if (target === "auto") {
  target = /^postgres(ql)?:\/\//i.test(readDatabaseUrl()) ? "postgresql" : "sqlite";
  console.log(`DATABASE_URL looks ${target === "postgresql" ? "like Postgres" : "like SQLite"}.`);
}

/**
 * Read DATABASE_URL from the environment, falling back to a minimal parse of
 * .env / .env.local. A standalone Node script gets neither Next's env loading
 * nor dotenv, so without this `auto` would silently see nothing locally and
 * always choose SQLite — right by luck rather than by design.
 */
function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  for (const file of [".env.local", ".env"]) {
    try {
      const hit = readFileSync(join(root, file), "utf8").match(/^\s*DATABASE_URL\s*=\s*(.+)$/m);
      if (hit) return hit[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      // No such file — fall through to the next candidate.
    }
  }
  return "";
}

if (!target || target === "show") {
  console.log(`datasource provider: ${current}`);
  process.exit(0);
}

if (!PROVIDERS.includes(target)) {
  console.error(`Unknown provider "${target}". Use one of: ${PROVIDERS.join(", ")}`);
  process.exit(1);
}

if (current === target) {
  console.log(`Already on ${target}.`);
  process.exit(0);
}

writeFileSync(SCHEMA, source.replace(match[1], match[1].replace(`"${current}"`, `"${target}"`)));
console.log(`prisma/schema.prisma: ${current} -> ${target}`);
