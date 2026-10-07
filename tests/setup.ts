/**
 * Tests run against a throwaway database, never the dev one.
 * `npm test` sets TEST_DATABASE_URL; if it is absent we fall back to an
 * in-memory-style file under .test-data so a stray run can't touch real data.
 */
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "file:./.test-data/test.db";
process.env.AUTH_SECRET ??= "test-secret-not-used-for-real";
