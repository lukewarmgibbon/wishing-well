-- =============================================================================
--  Wishing Well — production database setup
-- =============================================================================
--  HOW TO USE
--    1. Open your Neon project in the dashboard.
--    2. Click the "SQL Editor" tab (or "Query").
--    3. Open a NEW query.
--    4. Copy everything in this file into it.
--    5. Click "Run".
--
--  It is safe to run twice: if the tables already exist, nothing happens and
--  you will still see the table list at the end. That means you cannot break
--  anything by running it accidentally.
--
--  Everything runs as one transaction, so it either all works or none of it
--  does — you can never end up half-migrated.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
--  The tables. This is the checked-in migration, byte for byte.
-- -----------------------------------------------------------------------------
-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "apiToken" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "anonClaims" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ResetToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Wishlist" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT 'Gift',
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "showPrices" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Item" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "imageUrl" TEXT,
    "price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "note" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "listId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ItemPrice" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Share" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ShareLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "listId" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "passcode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followeeId" TEXT NOT NULL,
    "relation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Occasion" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "repeats" TEXT NOT NULL DEFAULT 'yearly',
    "kind" TEXT NOT NULL DEFAULT 'other',
    "leadDays" INTEGER NOT NULL DEFAULT 14,
    "subjectId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "listId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Occasion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Reservation" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_apiToken_key" ON "User"("apiToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VerificationToken_userId_idx" ON "VerificationToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ResetToken_tokenHash_key" ON "ResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ResetToken_userId_idx" ON "ResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Wishlist_slug_key" ON "Wishlist"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Wishlist_ownerId_idx" ON "Wishlist"("ownerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Wishlist_archivedAt_idx" ON "Wishlist"("archivedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Item_listId_idx" ON "Item"("listId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Item_url_idx" ON "Item"("url");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ItemPrice_itemId_createdAt_idx" ON "ItemPrice"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Share_userId_idx" ON "Share"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Share_listId_userId_key" ON "Share"("listId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ShareLink_token_key" ON "ShareLink"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShareLink_listId_idx" ON "ShareLink"("listId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Follow_followeeId_idx" ON "Follow"("followeeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Follow_followerId_followeeId_key" ON "Follow"("followerId", "followeeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Occasion_subjectId_idx" ON "Occasion"("subjectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Occasion_date_idx" ON "Occasion"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reservation_userId_idx" ON "Reservation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Reservation_itemId_key" ON "Reservation"("itemId");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VerificationToken_userId_fkey') THEN
        ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ResetToken_userId_fkey') THEN
        ALTER TABLE "ResetToken" ADD CONSTRAINT "ResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Wishlist_ownerId_fkey') THEN
        ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Item_listId_fkey') THEN
        ALTER TABLE "Item" ADD CONSTRAINT "Item_listId_fkey" FOREIGN KEY ("listId") REFERENCES "Wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ItemPrice_itemId_fkey') THEN
        ALTER TABLE "ItemPrice" ADD CONSTRAINT "ItemPrice_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Share_listId_fkey') THEN
        ALTER TABLE "Share" ADD CONSTRAINT "Share_listId_fkey" FOREIGN KEY ("listId") REFERENCES "Wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Share_userId_fkey') THEN
        ALTER TABLE "Share" ADD CONSTRAINT "Share_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShareLink_listId_fkey') THEN
        ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_listId_fkey" FOREIGN KEY ("listId") REFERENCES "Wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Follow_followerId_fkey') THEN
        ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Follow_followeeId_fkey') THEN
        ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followeeId_fkey" FOREIGN KEY ("followeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Occasion_subjectId_fkey') THEN
        ALTER TABLE "Occasion" ADD CONSTRAINT "Occasion_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Occasion_creatorId_fkey') THEN
        ALTER TABLE "Occasion" ADD CONSTRAINT "Occasion_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Occasion_listId_fkey') THEN
        ALTER TABLE "Occasion" ADD CONSTRAINT "Occasion_listId_fkey" FOREIGN KEY ("listId") REFERENCES "Wishlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_itemId_fkey') THEN
        ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_userId_fkey') THEN
        ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
--  Bookkeeping.
--
--  Prisma keeps a ledger of which migrations it has run. We are applying this
--  one by hand rather than via `prisma migrate deploy`, so we write the ledger
--  entry ourselves. Without it, the next deploy would try to create these very
--  tables a second time and fail.
--
--  The checksum below is the SHA-256 of prisma/migrations/
--  20260930223229_init/migration.sql. If you ever edit that file, this value
--  has to change too or Prisma will (correctly) complain that a migration was
--  modified after it was applied.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" TEXT NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

INSERT INTO "_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs",
     "rolled_back_at", "started_at", "applied_steps_count")
VALUES
    ('20260930223229_init',
     'aecc88cdafbcd804b48d76101c358a054bbb55c23ce66d52a183a78a06e83d22',
     now(),
     '20260930223229_init',
     NULL,
     NULL,
     now(),
     1)
ON CONFLICT ("id") DO NOTHING;

COMMIT;

-- -----------------------------------------------------------------------------
--  Confirmation. This prints the tables that now exist. You should see 12:
--  the 11 below, plus _prisma_migrations.
--      Follow, Item, ItemPrice, Occasion, Reservation, ResetToken, Share,
--      ShareLink, User, VerificationToken, Wishlist
-- -----------------------------------------------------------------------------

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
