/**
 * Occasion maths.
 *
 * The whole point of an occasion is answering "is anything coming up?", so it
 * has to work for yearly events whose stored date is last year's — and for
 * 29 February, which lands on the 1st in common years.
 */

const DAY_MS = 86_400_000;

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/**
 * The next occurrence of an occasion, on or after `from`.
 * For yearly events this keeps the month/day and steps the year forward.
 */
export function nextOccurrence(
  date: Date,
  repeats: string,
  from: Date = new Date()
): Date {
  const base = startOfDay(date);
  const today = startOfDay(from);

  // A one-off is simply the date it is, past or future.
  if (repeats !== "yearly") return base;

  if (base >= today) return base;

  // 29 Feb in a non-leap year: observe on 1 Mar, the conventional fallback.
  const month = base.getMonth();
  const day = base.getDate();
  const isLeapDay = month === 1 && day === 29;

  const candidate = new Date(today.getFullYear(), month, day);
  if (isLeapDay && !isLeapYear(today.getFullYear())) {
    candidate.setMonth(2); // March
    candidate.setDate(1);
  }
  if (candidate < today) {
    const nextYear = today.getFullYear() + 1;
    const next = new Date(nextYear, month, day);
    if (isLeapDay && !isLeapYear(nextYear)) {
      next.setMonth(2);
      next.setDate(1);
    }
    return next;
  }
  return candidate;
}

function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export type OccasionWithMeta = {
  id: string;
  title: string;
  date: Date;
  repeats: string;
  kind: string;
  leadDays: number;
  subjectId: string;
  listId: string | null;
  subject?: { id: string; name: string | null } | null;
};

/** Decorated with the next occurrence and its countdown. */
export function withOccurrenceMeta<T extends OccasionWithMeta>(o: T, from = new Date()) {
  const next = nextOccurrence(new Date(o.date), o.repeats, from);
  const today = startOfDay(from);
  const daysUntil = Math.round((next.getTime() - today.getTime()) / DAY_MS);
  return {
    ...o,
    nextOccurrence: next,
    daysUntil,
    isSoon: daysUntil <= o.leadDays,
    isPast: daysUntil < 0,
  };
}

/** "in 3 days" / "today" / "in 5 weeks" — deliberately coarse, like a date stamp. */
export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days < 30) return `in ${days} days`;
  if (days < 60) return "in a month";
  if (days < 365) return `in ${Math.round(days / 30)} months`;
  return "in over a year";
}

/**
 * Format a calendar date — a birthday, an anniversary, an occasion.
 *
 * These are *dates*, not instants. Someone types "15 March" into a date input,
 * the browser gives us `2027-03-15`, and that becomes UTC midnight. Rendering
 * it in the viewer's local timezone then silently moves it: anyone west of
 * Greenwich sees 14 March, so a relative in the States is told a birthday is a
 * day early. Pinning the format to UTC means the day that was typed is the day
 * that is shown, everywhere on earth.
 */
export function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
