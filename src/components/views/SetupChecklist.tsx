import Link from "next/link";
import { Check, Gift, Link2, CalendarDays, X, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";

/**
 * First-run setup, shown only while any of the three steps is outstanding.
 *
 * The steps are derived from the database rather than from local state, so this
 * is the same checklist on every device, it survives signing out, and it
 * disappears on its own once the account is genuinely set up. There is no
 * "completed onboarding" flag to get out of sync with reality.
 *
 * Deliberately not a wizard: blocking someone who arrived knowing what they
 * wanted is the fastest way to lose them. This sits underneath the page and
 * gets out of the way.
 */
export async function SetupChecklist({ userId }: { userId: string }) {
  const [items, shareable, occasions] = await Promise.all([
    prisma.item.count({ where: { list: { ownerId: userId } } }),
    prisma.wishlist.count({
      where: { ownerId: userId, archivedAt: null, visibility: { not: "PRIVATE" } },
    }),
    prisma.occasion.count({ where: { creatorId: userId } }),
  ]);

  const steps = [
    {
      done: items > 0,
      icon: Gift,
      title: "Add your first thing",
      body: "Anything you're saving for. On a computer the browser extension grabs it straight off the page you're on.",
      href: "/lists",
      cta: "Open a list",
    },
    {
      done: shareable > 0,
      icon: Link2,
      title: "Make a list shareable",
      body: "One link your people can open. Anyone holding it can see what you want and claim a gift so nobody buys it twice.",
      href: "/lists",
      cta: "Share a list",
    },
    {
      done: occasions > 0,
      icon: CalendarDays,
      title: "Add a birthday",
      body: "Dates are what make this work. Add your own, or a relative's, and everyone can see what's coming up.",
      href: "/gifts",
      cta: "Add a date",
    },
  ];

  const remaining = steps.filter((s) => !s.done);
  if (remaining.length === 0) return null;

  return (
    <section
      aria-labelledby="setup-heading"
      className="mt-8 border border-hair bg-v-25 p-6 dark:border-hair-d dark:bg-v-900/40 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="kicker text-a-600 dark:text-a-300">Three steps, then you&apos;re done</p>
          <h2 id="setup-heading" className="mt-2 text-[1.35rem] font-semibold tracking-[-0.02em]">
            Set up Wishing Well
          </h2>
        </div>
        <span className="text-sm text-v-500 dark:text-v-400">
          {steps.length - remaining.length} of {steps.length} done
        </span>
      </div>

      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {steps.map(({ done, icon: Icon, title, body, cta, href }) => (
          <li
            key={title}
            className={
              done
                ? "flex flex-col border border-v-150 bg-v-50 p-4 dark:border-v-800 dark:bg-v-900/60"
                : "flex flex-col border border-hair bg-v-0 p-4 dark:border-hair-d dark:bg-v-900"
            }
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className={
                  done
                    ? "flex size-6 items-center justify-center rounded-full bg-pos text-v-0 dark:bg-pos dark:text-v-0"
                    : "flex size-6 items-center justify-center rounded-full bg-a-100 text-a-600 dark:bg-a-900 dark:text-a-300"
                }
              >
                {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
              </span>
              <span
                className={
                  done
                    ? "text-[0.95rem] font-medium text-v-400 line-through dark:text-v-500"
                    : "text-[0.95rem] font-medium"
                }
              >
                {title}
              </span>
            </div>
            <p className="mt-2 flex-1 text-[0.82rem] leading-relaxed text-v-500 dark:text-v-400">
              {body}
            </p>
            {!done && (
              <Link
                href={href}
                className="mt-3 inline-flex items-center gap-1.5 text-[0.82rem] font-medium text-a-600 hover:underline dark:text-a-300"
              >
                {cta}
                <ArrowRight className="size-3.5" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}