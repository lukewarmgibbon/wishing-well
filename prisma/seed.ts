import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

const token = () => randomBytes(24).toString("hex");

/**
 * The demo password.
 *
 * Locally this is the well-known `password123`, which is convenient and
 * completely fine on a laptop. It is emphatically *not* fine on a deployed
 * database, where it would be three live accounts behind a password published
 * in this repository's README — so against anything but SQLite the seed
 * refuses to run until it is told to, and then uses a random password it
 * prints once.
 */
const LOCAL = /^file:/i.test(process.env.DATABASE_URL ?? "file:./prisma/dev.db");

if (!LOCAL) {
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    console.error(
      "\n  Refusing to seed a non-local database.\n\n" +
        "  This creates three real accounts with a shared password. On a deployed\n" +
        "  database that is three live logins anyone could use.\n\n" +
        "  If that is genuinely what you want (a demo you are about to show to\n" +
        "  someone, on a database that holds nothing real), re-run with:\n\n" +
        "      ALLOW_DEMO_SEED=true npm run db:seed\n\n" +
        "  Set DEMO_PASSWORD to choose the password; otherwise a random one is\n" +
        "  generated and printed once.\n",
    );
    process.exit(1);
  }
  console.warn("  ⚠  Seeding a NON-local database. The demo accounts below are real logins.");
}

const PASSWORD = process.env.DEMO_PASSWORD ?? (LOCAL ? "password123" : randomBytes(9).toString("base64url"));

async function main() {
  console.log("Seeding demo data…");
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Wipe in dependency order so re-seeding is safe.
  await prisma.itemPrice.deleteMany();
  await prisma.occasion.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.shareLink.deleteMany();
  await prisma.share.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.item.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.user.deleteMany();

  const alex = await prisma.user.create({
    data: { name: "Alex Chen", email: "alex@example.com", passwordHash, apiToken: token() },
  });
  const sam = await prisma.user.create({
    data: { name: "Sam Rivera", email: "sam@example.com", passwordHash, apiToken: token() },
  });
  const priya = await prisma.user.create({
    data: { name: "Priya Nair", email: "priya@example.com", passwordHash, apiToken: token() },
  });

  // Alex is the one whose lists everyone is looking at.
  const christmas = await prisma.wishlist.create({
    data: {
      title: "Christmas 2026",
      description: "Nothing too fancy — I'd rather have one lovely thing than five small ones.",
      slug: "alex-christmas-2026",
      emoji: "PartyPopper",
      visibility: "PUBLIC",
      ownerId: alex.id,
    },
  });

  const kitchen = await prisma.wishlist.create({
    data: {
      title: "New flat",
      description: "Things for the place I'm finally having. Kept private so nobody spoil-surprises me.",
      slug: "alex-new-flat-a7b2",
      emoji: "House",
      visibility: "PRIVATE",
      ownerId: alex.id,
    },
  });

  const treats = await prisma.wishlist.create({
    data: {
      title: "Treat myself",
      description: "Small things I've been eyeing all year.",
      slug: "alex-treat-myself-c9d1",
      emoji: "Sparkles",
      visibility: "SHARED",
      showPrices: false,
      ownerId: alex.id,
    },
  });

  const samList = await prisma.wishlist.create({
    data: {
      title: "Sam's birthday",
      description: "Ideas welcome! Nothing too formal.",
      slug: "sam-birthday-2026",
      emoji: "Cake",
      visibility: "PUBLIC",
      ownerId: sam.id,
    },
  });

  const priyaList = await prisma.wishlist.create({
    data: {
      title: "Priya's reading pile",
      description: "Books I'll actually finish, promise.",
      slug: "priya-reading-list",
      emoji: "BookOpen",
      visibility: "PUBLIC",
      ownerId: priya.id,
    },
  });

  const CURRENCY = "GBP";

  const items = [
    { listId: christmas.id, title: "Le Creuset casserole dish, 24cm, sage", price: 245, url: "https://www.lecreuset.co.uk/round-casserole-24cm", priority: 3, position: 1, note: "The round one, not the square.", currency: CURRENCY },
    { listId: christmas.id, title: "Sony WH-1000XM5 headphones", price: 329, url: "https://electronics.example.com/sony-wh1000xm5", priority: 3, position: 2, imageUrl: "https://picsum.photos/seed/sony/400", currency: CURRENCY },
    { listId: christmas.id, title: "Cashmere scarf, oatmeal", price: 120, url: "https://fashion.example.com/cashmere-scarf-oatmeal", priority: 2, position: 3, currency: CURRENCY },
    { listId: christmas.id, title: "Vinyl record player with built-in speakers", price: 179, url: "https://audio.example.com/record-player", priority: 1, position: 4, note: "Only if it's on a good deal.", currency: CURRENCY },
    { listId: kitchen.id, title: "Cast iron pan, 28cm", price: 60, url: "https://home.example.com/cast-iron-28", priority: 2, position: 1, currency: CURRENCY },
    { listId: kitchen.id, title: "Linen bedding set, double", price: 140, url: "https://home.example.com/linen-bedding-double", priority: 2, position: 2, currency: CURRENCY },
    { listId: treats.id, title: "Nice hot chocolate set", price: 28, url: "https://pantry.example.com/hot-chocolate-set", priority: 1, position: 1, currency: CURRENCY },
    { listId: treats.id, title: "Bookshop tote bag", price: 18, url: "https://pantry.example.com/bookshop-tote", priority: 1, position: 2, currency: CURRENCY },
    { listId: samList.id, title: "Weekend bag, cabin size", price: 210, url: "https://travel.example.com/cabin-weekender", priority: 3, position: 1, currency: CURRENCY },
    { listId: samList.id, title: "Sourdough starter kit", price: 45, url: "https://kitchen.example.com/sourdough-kit", priority: 2, position: 2, currency: CURRENCY },
  ];


  const created = [];
  for (const item of items) {
    const row = await prisma.item.create({ data: item });
    created.push(row);
    // The real app records a price on creation, so the seed must too —
    // otherwise every seeded item shows an empty history in the UI.
    if (item.price != null) {
      await prisma.itemPrice.create({
        data: {
          itemId: row.id,
          price: item.price,
          currency: CURRENCY,
          source: "manual",
          createdAt: new Date(Date.now() - 21 * 86_400_000),
        },
      });
    }
  }

  // Sam follows Alex and Priya, so their lists land on Sam's gifting page.
  await prisma.follow.createMany({
    data: [
      { followerId: sam.id, followeeId: alex.id },
      { followerId: sam.id, followeeId: priya.id },
      { followerId: priya.id, followeeId: alex.id },
    ],
  });

  // Sam is also watching Alex's new flat, and can add to the treat list.
  await prisma.share.createMany({
    data: [
      { listId: kitchen.id, userId: sam.id, role: "VIEWER" },
      { listId: treats.id, userId: sam.id, role: "EDITOR" },
    ],
  });

  await prisma.shareLink.create({
    data: { listId: christmas.id, token: "demo-share-link-token", role: "VIEWER" },
  });

  // Occasions are what turn the gifting page into "what's coming up?", so the
  // demo needs a few with dates in the near future.
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);
  await prisma.occasion.createMany({
    data: [
      { title: "Alex's birthday", date: inDays(12), repeats: "yearly", kind: "birthday", subjectId: alex.id, creatorId: sam.id, listId: christmas.id },
      { title: "Priya's birthday", date: inDays(34), repeats: "yearly", kind: "birthday", subjectId: priya.id, creatorId: sam.id, listId: priyaList.id },
      { title: "Sam's birthday", date: inDays(52), repeats: "yearly", kind: "birthday", subjectId: sam.id, creatorId: priya.id },
      { title: "Christmas Day", date: new Date(`${new Date().getFullYear()}-12-25T00:00:00Z`), repeats: "yearly", kind: "holiday", subjectId: alex.id, creatorId: sam.id, listId: christmas.id, leadDays: 30 },
    ],
  });

  // Two items get a genuine back-dated trend so the popover has something real
  // to show, including a "X% below the first price we saw" line.
  //
  // These must be OLDER than the point written above (21 days ago), otherwise
  // the newest recorded price stops matching the item's actual price.
  for (const item of [created[0], created[2]]) {
    const now = item.price ?? 100;
    for (const [factor, days, source] of [
      [1.18, 75, "manual"],
      [1.07, 45, "check"],
    ] as const) {
      await prisma.itemPrice.create({
        data: {
          itemId: item.id,
          price: Math.round(now * factor * 100) / 100,
          currency: CURRENCY,
          source,
          createdAt: new Date(Date.now() - days * 86_400_000),
        },
      });
    }
  }

  // Sam has already claimed the headphones so nobody double-buys.
  await prisma.reservation.create({
    data: { itemId: created[1].id, userId: sam.id, note: "Getting it on sale — don't worry!" },
  });

  console.log(`
Seeded.

  Sign in with any of these (password: ${PASSWORD})
    alex@example.com    — owns the lists
    sam@example.com     — follows Alex, has claimed a gift
    priya@example.com   — follows Alex

  Public list to look at:
    http://localhost:3000/w/alex-christmas-2026
    http://localhost:3000/w/alex-christmas-2026?t=demo-share-link-token
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
