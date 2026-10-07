import { describe, it, expect, afterEach } from "vitest";
import { nextOccurrence, withOccurrenceMeta, relativeDays, addDays, formatDate } from "@/lib/dates";
import { dropPercent } from "@/lib/pricing";
import { rateLimit } from "@/lib/rate-limit";

describe("nextOccurrence", () => {
  it("keeps a future yearly date as-is", () => {
    const d = new Date(2030, 5, 1);
    expect(nextOccurrence(d, "yearly", new Date(2029, 0, 1)).getTime()).toBe(d.getTime());
  });

  it("rolls a past yearly date forward to the next occurrence", () => {
    const from = new Date(2026, 2, 10); // 10 March 2026
    const next = nextOccurrence(new Date(1980, 5, 1), "yearly", from);
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(5);
    expect(next.getDate()).toBe(1);
  });

  it("stays in the current year when the date is still ahead", () => {
    const from = new Date(2026, 0, 1); // 1 Jan 2026
    const next = nextOccurrence(new Date(1990, 10, 25), "yearly", from);
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(10);
  });

  it("moves to next year once the date has passed this year", () => {
    const from = new Date(2026, 11, 30); // 30 Dec 2026
    const next = nextOccurrence(new Date(1990, 5, 1), "yearly", from);
    expect(next.getFullYear()).toBe(2027);
  });

  it("puts a 29 February birthday on 1 March in common years", () => {
    const from = new Date(2026, 0, 1);
    const next = nextOccurrence(new Date(2024, 1, 29), "yearly", from);
    // 2026 is not a leap year.
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(2); // March
    expect(next.getDate()).toBe(1);
  });

  it("keeps 29 February on the leap year itself", () => {
    const from = new Date(2028, 0, 1);
    const next = nextOccurrence(new Date(2024, 1, 29), "yearly", from);
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(29);
  });

  it("does not mutate the input date", () => {
    const original = new Date(1990, 5, 1);
    const before = original.getTime();
    nextOccurrence(original, "yearly", new Date(2026, 0, 1));
    expect(original.getTime()).toBe(before);
  });

  it("a one-off date in the past stays in the past", () => {
    const d = new Date(2000, 0, 1);
    expect(nextOccurrence(d, "none", new Date(2026, 0, 1)).getTime()).toBe(d.getTime());
  });
});

describe("withOccurrenceMeta", () => {
  const base = {
    id: "o1",
    title: "Birthday",
    date: new Date(2000, 4, 20), // 20 May
    repeats: "yearly",
    kind: "birthday",
    leadDays: 14,
    subjectId: "u1",
    listId: null,
  };

  it("flags an occasion inside the lead window as soon", () => {
    const from = new Date(2026, 4, 10); // 10 days before
    expect(withOccurrenceMeta(base, from).isSoon).toBe(true);
  });

  it("does not flag one far in the future", () => {
    const from = new Date(2026, 0, 1);
    expect(withOccurrenceMeta(base, from).isSoon).toBe(false);
  });

  it("is due today, not negative days", () => {
    const from = new Date(2026, 4, 20);
    const meta = withOccurrenceMeta(base, from);
    expect(meta.daysUntil).toBe(0);
    expect(meta.isSoon).toBe(true);
  });
});

describe("relativeDays", () => {
  it.each([
    [0, "today"],
    [1, "tomorrow"],
    [-1, "yesterday"],
    [5, "in 5 days"],
    [-3, "3 days ago"],
  ])("renders %i as %s", (days, expected) => {
    expect(relativeDays(days as number)).toBe(expected);
  });
});

describe("addDays", () => {
  it("crosses a month boundary", () => {
    const d = addDays(new Date(2026, 0, 30), 3);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(2);
  });
});

describe("dropPercent", () => {
  it("reports a drop as positive", () => {
    expect(dropPercent([{ price: 100 }], 80)).toBeCloseTo(20);
  });

  it("reports a rise as negative", () => {
    expect(dropPercent([{ price: 100 }], 120)).toBeCloseTo(-20);
  });

  it("ignores sub-1% noise", () => {
    expect(dropPercent([{ price: 100 }], 99.5)).toBeNull();
  });

  it("returns null with no history", () => {
    expect(dropPercent([], 50)).toBeNull();
  });
});

describe("rateLimit", () => {
  it("allows up to the limit then blocks", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    const key = "test:allows-up-to-limit";
    expect(rateLimit(key, opts).ok).toBe(true);
    expect(rateLimit(key, opts).ok).toBe(true);
    expect(rateLimit(key, opts).ok).toBe(true);
    const blocked = rateLimit(key, opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps separate buckets per key", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(rateLimit("test:key-a", opts).ok).toBe(true);
    expect(rateLimit("test:key-b", opts).ok).toBe(true);
  });
});

/**
 * Occasions are calendar dates, not instants. Someone types "15 March", and
 * that has to read as 15 March for every relative regardless of where they
 * are — the family this is built for is split between the UK and abroad, and
 * telling someone in the States a birthday is a day early is the exact
 * failure this app exists to prevent.
 */
describe("formatDate across timezones", () => {
  const original = process.env.TZ;
  const entered = new Date("2027-03-15"); // a date input's value, as UTC midnight

  const inZone = (tz: string) => {
    process.env.TZ = tz;
    return formatDate(entered);
  };

  afterEach(() => {
    process.env.TZ = original;
  });

  it("reads as the same date in every timezone", () => {
    const zones = [
      "Europe/London",
      "America/New_York", // 5 hours behind — the case that used to break
      "America/Los_Angeles",
      "Asia/Kolkata",
      "Asia/Tokyo",
      "Australia/Sydney",
      "Pacific/Auckland",
    ];
    // The exact wording follows the system locale, so the invariant is that no
    // timezone disagrees with any other about *which day* it is.
    const results = zones.map((tz) => [tz, inZone(tz)] as const);
    for (const [tz, shown] of results) {
      expect(shown, `${tz} disagrees`).toBe(results[0][1]);
    }
  });

  it("does not drift a day earlier in the Americas", () => {
    const shown = inZone("America/New_York");
    expect(shown).toContain("15");
    expect(shown).not.toContain("14");
  });

  it("does not drift a day later far east", () => {
    const shown = inZone("Pacific/Auckland");
    expect(shown).toContain("15");
    expect(shown).not.toContain("16");
  });
});
