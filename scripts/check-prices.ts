/**
 * Background price re-check.
 *
 * Run it from cron:
 *   0 6 * * *  cd /app && npm run prices
 *
 * Expect a fair number of failures — most retailers serve a block page to a
 * server fetch. A failure is recorded as "not checked", never as "price fell",
 * so a blocked scrape can never trigger a false alert.
 */
import { PrismaClient } from "@prisma/client";
import { fetchPrice, recordPrice, dropPercent } from "../src/lib/pricing";

const prisma = new PrismaClient();

const MAX_AGE_HOURS = 24;

async function main() {
  const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 3600_000);

  const due = await prisma.item.findMany({
    where: {
      price: { not: null },
      list: { archivedAt: null },
      updatedAt: { lt: cutoff },
    },
    select: { id: true, title: true, url: true, price: true, list: { select: { title: true } } },
    take: 200,
    orderBy: { updatedAt: "asc" },
  });

  console.log(`Checking ${due.length} item(s)…\n`);

  let checked = 0;
  let unchanged = 0;
  let changed = 0;
  const drops: string[] = [];

  for (const item of due) {
    const result = await fetchPrice(item.url);
    checked++;

    if (!result) {
      // Blocked or unparseable. Touch nothing.
      continue;
    }

    if (Math.abs(result.price - (item.price ?? 0)) < 0.01) {
      unchanged++;
      await prisma.item.update({ where: { id: item.id }, data: { updatedAt: new Date() } });
      continue;
    }

    const history = await prisma.itemPrice.findMany({
      where: { itemId: item.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { price: true },
    });

    await recordPrice(item.id, result.price, result.currency, "check");
    await prisma.item.update({
      where: { id: item.id },
      data: { price: result.price, currency: result.currency, updatedAt: new Date() },
    });

    changed++;
    const drop = dropPercent(history.slice(1), result.price);
    const arrow = drop == null ? "" : drop > 0 ? ` ↓${drop.toFixed(0)}%` : ` ↑${Math.abs(drop).toFixed(0)}%`;
    console.log(`  ${item.list.title} · ${item.title}: ${item.price} → ${result.price}${arrow}`);

    if (drop != null && drop >= 5) {
      drops.push(`${item.title} — now ${result.price} (${drop.toFixed(0)}% down)`);
    }
  }

  console.log(
    `\nChecked ${checked} · unchanged ${unchanged} · changed ${changed} · blocked ${checked - unchanged - changed}`
  );

  if (drops.length) {
    console.log(`\nPrice drops worth telling someone about:`);
    for (const d of drops) console.log(`  • ${d}`);
    // Hook a notification here — email, push, whatever you have.
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
