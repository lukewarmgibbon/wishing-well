#!/usr/bin/env node
/**
 * Apply the checked-in migrations, without asking anyone to remember to flip
 * the schema first.
 *
 * `prisma migrate deploy` reads the datasource block from schema.prisma and
 * validates DATABASE_URL against it. schema.prisma is committed as `sqlite`
 * because that is what local development uses, so running a Postgres migration
 * against it fails with:
 *
 *     Error validating datasource `db`: the URL must start with the protocol `file:`.
 *
 * which reads like a database problem and is actually a schema-file problem.
 * The obvious workaround — "run db:postgres first" — is easy to forget and
 * leaves the repo on the wrong provider if the command in between fails.
 *
 * So: switch to Postgres, migrate, and put the schema back exactly as it was.
 */
import { spawnSync } from "node:child_process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const providerScript = join(root, "scripts", "db-provider.mjs");

function provider() {
  return execFileSync(process.execPath, [providerScript, "show"], {
    encoding: "utf8",
  })
    .split(":")
    .pop()
    .trim();
}

const url = process.env.DATABASE_URL ?? "";
if (!/^postgres(ql)?:\/\//i.test(url)) {
  console.error(
    "\n  DATABASE_URL does not look like a Postgres connection string.\n\n" +
      "  Migrations are PostgreSQL SQL, so this only makes sense against Postgres.\n" +
      "  Set it to your database's pooled URL first, e.g.\n\n" +
      '      export DATABASE_URL="postgresql://user:pass@host/db?pgbouncer=true"\n',
  );
  process.exit(1);
}

const original = provider();
if (original !== "postgresql") {
  execFileSync(process.execPath, [providerScript, "to", "postgresql"], { stdio: "inherit" });
}

const restore = () => {
  if (original !== "postgresql") {
    execFileSync(process.execPath, [providerScript, "to", original], { stdio: "inherit" });
  }
};

const result = spawnSync(
  process.execPath,
  [join(root, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"],
  { cwd: root, stdio: "inherit", env: process.env },
);

restore();

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
