import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Puzzle, Link2, Gift, Users, ArrowRight, Check,
} from "lucide-react";
import { auth } from "@/lib/auth";

const features = [
  { Icon: Puzzle, title: "Add from anywhere", body: "The extension reads the product page and drops it on your list without losing your scroll position." },
  { Icon: Link2, title: "One link, everyone", body: "A single URL for the whole family. No account needed to look, and you can revoke it if it leaks." },
  { Icon: Gift, title: "Claim it, quietly", body: "Givers mark what they've bought so nobody doubles up. The recipient never sees who claimed what." },
  { Icon: Users, title: "Follow your people", body: "The wishlists you care about collect on one gifting page, so birthdays stop being a scramble." },
];

const steps = [
  { title: "Make a list", body: "A Christmas, a new flat, a treat-yourself list. As many as you like." },
  { title: "Fill it in", body: "By hand, or one tap of the extension on any product page." },
  { title: "Share one link", body: "Drop it in the group chat. Anyone can open it, no sign-up required." },
  { title: "They claim gifts", body: "Givers mark what they've bought. You just receive them, pleasantly surprised." },
];

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/lists");

  return (
    <div>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b border-v-200 bg-v-0 dark:border-v-800 dark:bg-v-900">
        {/* A soft accent wash — subtle enough to read as depth, not decoration. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_-10%,color-mix(in_oklab,var(--color-a-500)_12%,transparent),transparent_70%)]"
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-24 sm:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-v-200 bg-v-0 px-3 py-1 text-[0.8125rem] font-medium text-v-600 shadow-xs dark:border-v-700 dark:bg-v-800 dark:text-v-300">
              <span className="size-1.5 rounded-full bg-a-500" />
              For people who are hard to buy for
            </span>

            <h1 className="mt-8 text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[4.25rem]">
              Keep the wishlist.
              <span className="block text-v-400 sm:text-v-500">Skip the duplicates.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-v-500 dark:text-v-400">
              Save what you find online, share one link with everyone, and let your people claim gifts
              quietly so you get exactly one of each.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="btn btn-primary px-4 py-2.5 text-[0.875rem]">
                Create your wishlist
                <ArrowRight className="size-4" />
              </Link>
            </div>

            <p className="mt-6 text-[0.8125rem] text-v-400">Free · No card · Share links you can revoke</p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="surface group p-5 transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-v-300 hover:shadow-md dark:hover:border-v-700"
            >
              <span className="grid size-9 place-items-center rounded-[10px] bg-a-100 text-a-600 transition-colors duration-200 group-hover:bg-a-200 dark:bg-a-900/40 dark:text-a-300">
                <Icon className="size-[18px]" strokeWidth={1.75} />
              </span>
              <h2 className="mt-4 text-[0.9375rem] font-semibold">{title}</h2>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-v-500 dark:text-v-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- steps */}
      <section className="border-y border-v-200 bg-v-0 dark:border-v-800 dark:bg-v-900">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <h2 className="text-[1.75rem] font-semibold tracking-[-0.025em] sm:text-[2rem]">
              How sharing works
            </h2>
            <p className="mt-2 text-[0.9375rem] text-v-500 dark:text-v-400">
              Four steps, then you never have to hint again.
            </p>
          </div>

          <ol className="mt-10 grid gap-px overflow-hidden rounded-[14px] border border-v-200 bg-v-200 sm:grid-cols-2 lg:grid-cols-4 dark:border-v-800 dark:bg-v-800">
            {steps.map((s, i) => (
              <li key={s.title} className="bg-v-0 p-6 dark:bg-v-900">
                <span className="tnum grid size-7 place-items-center rounded-full bg-a-100 text-[0.75rem] font-semibold text-a-700 dark:bg-a-900/50 dark:text-a-300">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-[0.9375rem] font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-v-500 dark:text-v-400">{s.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-[0.8125rem] text-v-500 dark:text-v-400">
            {["No card required", "Share links you can revoke", "Claiming is one per item"].map((t) => (
              <span key={t} className="inline-flex items-center gap-2">
                <Check className="size-4 text-pos" strokeWidth={2} />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- cta */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="mx-auto max-w-2xl text-[1.75rem] font-semibold tracking-[-0.028em] text-balance sm:text-[2.25rem]">
          Nobody should have to drop hints twice.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-[0.9375rem] text-v-500 dark:text-v-400">
          Make a list, share the link, and let everyone else handle it.
        </p>
        <Link href="/register" className="btn btn-primary mx-auto mt-8 px-5 py-2.5">
          Start your list
          <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}
