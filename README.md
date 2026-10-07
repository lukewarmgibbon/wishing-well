# Wishing Well

A wishlist app with a companion browser extension. People keep as many lists as they like, add things from
anywhere on the web, share a single link with friends and family, and let gift-givers quietly claim items so
nobody buys the same present twice.

## What's built

**The site**
- Email + password accounts, plus Google sign-in (turns on automatically once you add Google credentials)
- Email verification and password reset, with hashed single-use tokens
- Multiple lists per person — "Christmas 2026", "New flat", "Treat myself"
- Manual item entry, or add from the extension, or bulk-save a whole product page
- Three visibility levels per list: **Private**, **Shared link**, **Public**
- Share links that can be disabled at any time if one leaks
- Invite specific people by email, as a viewer or an editor
- **Gift claiming** — a viewer marks "I'll get this one"; the owner sees who claimed what, other guests
  never do. Claims can be made **anonymously**, per-account or per-claim
- Per-list "show prices" switch, for surprise lists
- **Gifting dashboard** at `/gifts` — every unclaimed item from everyone you follow, searchable,
  filterable and sortable, with an "upcoming occasions" countdown
- **Occasions** — record someone's birthday or anniversary once and `/gifts` answers *what's coming up*
- **Mark as received**, **archive**, and **roll over to next year** lifecycle actions
- **Price history** per item, with a percentage-drop indicator and an on-demand re-check
- People directory for finding and following others
- Open Graph / Twitter card previews for every shared list

**The extension** (Chrome / Edge / Brave, Manifest V3)
- Reads the current page (Open Graph tags, JSON-LD product data, a price scrape as a last resort) and
  pre-fills the save form
- **Bulk capture** — scans the page, lists every product it can identify, and saves them all in one
  request with duplicate detection
- One click to add to any list you can edit
- Right-click "Add to wishlist…" on any page, link or image
- Create a new list without leaving the popup
- Won't add the same URL twice, including the same URL with different `utm_*` parameters

## Running it

```bash
npm install
npm run setup     # generates the Prisma client, creates the SQLite db, seeds demo data
npm run dev       # http://localhost:3000
```

### Demo accounts

All use the password `password123`:

| Email | What they're useful for |
| --- | --- |
| `alex@example.com` | Owns the lists; public Christmas list, private "New flat" |
| `sam@example.com` | Follows Alex, has claimed a gift, is an editor on one list |
| `priya@example.com` | Follows Alex, has her own public list |

### Pages you can open without signing in

The preview frame blocks cookies, so **all of these work logged-out** and are seeded for inspection:

- `/demo` — the landing page
- `/demo/lists` — the dashboard, including the archived section
- `/demo/lists/<id>` — a list with sharing controls
- `/demo/gifts` — the gifting dashboard: occasions, search, filters, sorting
- `/demo/people` — the people directory
- `/w/alex-christmas-2026` — a public shared list

### Test suite

```bash
npm test          # 54 unit tests
npm run test:db   # resets and reseeds the demo database
```

Authorization rules live in `src/lib/permissions.ts` and `src/lib/access.ts` and are pinned by
`tests/permissions.test.ts` and `tests/access.test.ts`. Date recurrence, price-drop maths and the rate
limiter are covered in `tests/dates.test.ts`.

## Running inside the sandboxed preview

The live preview is served from an HTTPS host **inside a cross-site iframe**, which breaks
cookie-based sessions in two ways unless you account for it. Both are handled:

- Browsers refuse to store `SameSite=Lax` cookies in a third-party frame, so sign-in silently
  failed with `MissingCSRF` while every page still rendered (pages need no cookies). Setting
  `IFRAME_SAFE_COOKIES="true"` switches the session and CSRF cookies to `SameSite=None; Secure`.
- Auth.js can't infer the protocol or host behind the proxy, so `AUTH_TRUST_HOST="true"` is set.
- `next.config.ts` also sets `X-Frame-Options: ALLOWALL` and `frame-ancestors *`, and adds
  `allowedDevOrigins` so Next doesn't block its own dev resources for the proxy host.

> When `IFRAME_SAFE_COOKIES` is `"true"` the cookies carry the `Secure` attribute, which plain
> `http://` browsers refuse to store. Browsing via `http://localhost:3000` therefore needs it set
> to `"false"`. It's on by default in this repo's `.env` for the preview.

### Why the login form doesn't use `signIn()`

The `signIn()` helper shipped with the Auth.js v5 beta posts to `/api/auth/signin/<provider>`,
which redirects to a 400 and never establishes a session. `src/components/AuthForm.tsx` therefore
drives `/api/auth/callback/<provider>` itself, then confirms the result with `/api/auth/session`
rather than trusting the response status. Worth revisiting on a stable Auth.js release.

## Loading the extension

1. Open `chrome://extensions` and turn on **Developer mode**
2. Click **Load unpacked** and choose the `extension/` folder in this project
3. Sign in from the extension popup, or open **My lists** on the website and copy your sign-in code into
   the extension's settings. The Google "Connect with a code" path works there too.

The extension talks to `http://localhost:3000` by default; change it in the popup's settings.

## Enabling Google sign-in

1. Create an OAuth client at <https://console.cloud.google.com/apis/credentials>
2. Add `http://localhost:3000/api/auth/callback/google` as an authorised redirect URI
3. Put the client id and secret in `.env`:

```
GOOGLE_CLIENT_ID="…apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="…"
```

The Google button appears on the sign-in page automatically once both are set. Google accounts are
marked verified on first sign-in and skip the confirmation step entirely.

## Email

Verification and password-reset mail goes out through [Resend](https://resend.com) when
`RESEND_API_KEY` is set:

```
RESEND_API_KEY="re_…"
```

With no key, `src/lib/mail.ts` writes the rendered message to `.outbox/` and logs it instead, so the
whole flow stays testable locally. Open `.outbox/` to click through a real verification or reset link
during development.

## How access control works

Every read and write goes through `src/lib/access.ts`, which resolves a viewer to exactly one level:

| Level | Can do |
| --- | --- |
| `owner` | Everything, including sharing, archiving, rolling over and deleting |
| `editor` | Add, edit and hide items |
| `viewer` | View the list, claim and release gifts |
| `none` | Sees only a "this list is private" screen |

Levels are granted by, in order: ownership → an email invite → a valid share-link token → following the
owner → the list being marked `PUBLIC`. Revoked or expired tokens grant nothing.

The lifecycle actions (archive, roll over, mark received, re-check price) are declared as one table in
`src/lib/permissions.ts` rather than inline `if (level !== "owner")` checks spread across five handlers,
and every route now goes through it.

Three rules that are easy to get wrong, so they're worth stating:

- **Following someone does not let you edit their lists.** It only surfaces them on your gifting page.
- **Claiming an item is one-per-item**, enforced by a unique constraint, so two people can't both think
  they've got it. The second person gets a 409 and is pointed at other lists.
- **An anonymous claim is anonymous to the owner too.** The reservation row still points at a user, but
  every owner-facing query strips the name, so the flag can't be quietly ignored.

## Price checking

Price history is recorded passively: every time an item is created or its price is edited, the current
value is appended to `ItemPrice`. That means the trend builds up with no scheduled work.

Active re-checking is deliberately best-effort. Most retailers serve a bot-blocked page to a server-side
fetch, so `fetchPrice()` in `src/lib/pricing.ts` returns `null` more often than not, and **a blocked
fetch records nothing** rather than recording a false price. To check everything at once, from cron or a
CI schedule:

```bash
npm run prices
```

For real drop alerts, route `fetchPrice()` through a hosted scraping API — it is the only function that
needs to change.

## Rate limiting

`src/lib/rate-limit.ts` is a dependency-free in-memory limiter keyed by client IP. It covers
registration, extension login, item creation, bulk capture, sharing, profile writes, password resets and
verification email. **It is per-process**: a multi-instance deployment needs Redis or Upstash behind
the same interface, or the limits multiply by instance count.

## Layout

```
prisma/schema.prisma     users, lists, items, prices, occasions, shares, share links, follows, reservations
src/lib/access.ts        the single place that decides who can see a list
src/lib/permissions.ts   who may archive, roll over, mark received, re-check a price
src/lib/auth.ts          Auth.js config, credentials + Google, session and token helpers
src/lib/dates.ts         yearly recurrence, leap days, countdowns, relative labels
src/lib/pricing.ts       price history, drop detection, best-effort price fetching
src/lib/tokens.ts        hashed verification, reset and API tokens
src/lib/mail.ts          Resend, with a local .outbox fallback
src/lib/rate-limit.ts    in-memory limiter and endpoint presets
src/components/Modal.tsx the one modal — Escape, focus trap, focus restore, scroll lock
src/app/                 pages and API routes
extension/               Manifest V3 extension (load this folder unpacked)
```

### API

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/register` | POST | Create an account and a first list |
| `/api/forgot-password` | POST | Email a reset link |
| `/api/reset-password` | POST | Consume a reset token, set a new password |
| `/api/verify-email` | POST | Consume a verification token |
| `/api/verify-email/resend` | POST | Send another confirmation email |
| `/api/profile` | PATCH | Name, anonymous-claim preference, password change |
| `/api/lists` | GET, POST | List or create lists (session or token) |
| `/api/lists/:id` | GET, PATCH, DELETE | Read, update, delete a list |
| `/api/lists/:id/items` | POST | Add an item |
| `/api/lists/:id/share` | PUT, POST, PATCH, DELETE | Share links and email invites |
| `/api/lists/:id/archive` | POST | Archive or restore a list |
| `/api/lists/:id/rollover` | POST | Copy the list forward, optionally with its items |
| `/api/occasions` | GET, POST, DELETE | Record birthdays and other dates for people you follow |
| `/api/items/:id` | PATCH, DELETE | Edit or remove an item |
| `/api/items/:id/reserve` | POST, DELETE | Claim or release a gift, optionally anonymously |
| `/api/items/:id/receive` | POST | Mark a gift received (releases its claim) |
| `/api/items/:id/price` | GET, POST | Read price history, or trigger a re-check |
| `/api/users` | GET | Search people (emails masked) |
| `/api/users/:id/follow` | POST, DELETE | Follow or unfollow |
| `/api/extension/login` | POST | Exchange email + password for an API token |
| `/api/extension/lists` | GET | Lists the extension can add to |
| `/api/extension/items` | POST | Add an item from the extension |
| `/api/extension/items/bulk` | POST | Save many products from one page, with dedupe |
| `/api/extension/token/rotate` | POST | Issue a fresh API token, invalidating the old one |

Every route accepts either the web session cookie or `Authorization: Bearer <token>`, so the extension and
the site share one implementation.

## Databases

The schema is one file, and `scripts/db-provider.mjs` flips the datasource between
SQLite and PostgreSQL so you never maintain two copies of it.

**Local (default, zero-config).** SQLite, no server to run:

```bash
npm run db:sqlite && npm run db:push && npm run db:seed
```

**Production.** PostgreSQL, with a real migration history:

```bash
export DATABASE_URL='postgresql://user:pass@host:5432/wishlist?pgbouncer=true'
npm run db:postgres        # rewrite the datasource to postgresql
npm run db:deploy          # apply prisma/migrations/
```

`prisma/migrations/20260930223229_init/migration.sql` is a checked-in PostgreSQL
migration covering all 11 tables. `npm run db:provider` prints the current one.

Because the committed migrations are PostgreSQL SQL, local SQLite development
deliberately uses `db push` rather than `migrate`. Don't run `migrate dev`
against SQLite.

If your host pools connections (Neon, Supabase, PgBouncer), use the **pooled**
URL for the app and the direct one for `migrate deploy`.

## Security headers and framing

`next.config.ts` sends `X-Frame-Options: DENY` and `frame-ancestors 'none'` by
default, alongside `X-Content-Type-Options`, `Referrer-Policy` and
`DNS-Prefetch-Control`.

`ALLOW_FRAMING=true` is the single switch that permits embedding, and it exists
only so the sandboxed preview iframe keeps working. Leave it off in production.

Note that for `next start` this is a **build-time** variable: Next evaluates
`headers()` during `next build` and bakes the result in, so setting
`ALLOW_FRAMING` on a running server has no effect. Building with it set prints a
warning. In `next dev` it applies immediately, which is what the preview needs.

## Affiliate links

Off unless you turn it on. With no configuration, `affiliateUrl()` returns the
retailer URL untouched — the exact string stored on the item — and no disclosure
is rendered anywhere.

```bash
AFFILIATE_ENABLED=true
AFFILIATE_NETWORK=your-network-id
AFFILIATE_DISCLOSURE="Some links are affiliate links — we may earn a commission at no extra cost to you."
```

When enabled, product links gain `tag`, `utm_source`, `utm_medium` and
`utm_campaign` parameters, and a disclosure appears on shared lists and `/gifts`.
The disclosure is on by default, and the copy above is the default wording.

Deliberate properties, all covered by `tests/affiliate.test.ts`:

- **Links still point straight at the retailer.** Nothing is proxied, cloaked, or
  redirected through this app.
- Existing affiliate parameters (`tag`, `irclickid`, `utm_*`, …) are never
  overwritten, so a link a shop already tracks is left alone.
- Non-commerce hosts (Google, social, Stripe, …) and non-HTTP URLs pass through
  unchanged.
- **Shared `/w/` lists stay free.** The feature is off by default precisely so
  free sharing never depends on a monetisation decision.

If you enable this on Vercel, note that the Hobby plan is for personal,
non-commercial use — see the hosting note below.

## Building the extension for a real domain

The committed `extension/` folder is the localhost development default. To
produce a build pointed at your domain:

```bash
WISHING_WELL_ORIGIN=https://wish.example.com npm run extension:build
```

This stamps the origin into the service worker and popup, points the manifest's
host permissions at it, and — for any non-local origin — moves the blanket
`https://*/*` into `optional_host_permissions` and adds `activeTab`. A server
the user configures by hand still overrides the build default.

For non-local builds the blanket host permission is **optional**, so the content
script does not run until the user grants access. The popup asks for it the
first time you scan a page, via `ensurePageAccess()`. Single-item saving needs
no prompt: `activeTab` already covers it.

The build is idempotent — running it again for a different origin re-stamps
cleanly.

## Hosting

**Vercel Hobby is not usable for this.** It is a personal, non-commercial plan
and explicitly excludes sites that earn money through affiliate links. Once
affiliate revenue is real, you need **Vercel Pro ($20/user/month)** or a cheap
self-hosted VPS — both fine, neither expensive.

## Before you put this in front of real users

- [x] **Move off SQLite** — run `npm run db:postgres` and `npm run db:deploy`
- [ ] **Generate a real `AUTH_SECRET`** with `openssl rand -base64 32`
- [ ] **Serve over HTTPS** and set `AUTH_TRUST_HOST=true`
- [x] **Build the extension for your domain** — `npm run extension:build`
- [x] **Framing is denied by default** — keep `ALLOW_FRAMING` unset in production
- [ ] **Put a shared rate limiter behind `src/lib/rate-limit.ts`.** In-memory
      limits reset on deploy and multiply across instances.
- [ ] **Move price fetching to a real service.** Blocked fetches record nothing
      by design, so history is honest but thin.
- [ ] **Decide on hosting before enabling affiliate links** — Hobby is
      non-commercial.
- [ ] Consider expiring share links (`ShareLink.expiresAt` is modelled but not
      yet exposed in the UI) and emailing people when a gift is claimed.

## Extension regression test

`scripts/extension-regress.mjs` loads the unpacked extension in Chromium and
checks the service worker boots, that an unbuilt placeholder never becomes a
server URL, that `ensurePageAccess()` grants nothing it shouldn't, and that bulk
capture still finds exactly the four fixture products with prices intact.

```bash
npm i -D playwright && npx playwright install chromium
AX_TOKEN=<alex's token> AX_LIST=<a list id> npm run test:extension
```

MV3 extensions need the full Chromium build (Playwright's `channel: "chromium"`),
not the headless shell, which has no extension support.
