# Getting Wishing Well live — the beginner's guide

Written for someone who has never deployed anything before. Nothing here is
assumed. Where a choice matters, the reasoning is given so you can tell whether
a step still makes sense later.

**The whole guide costs £0.** A domain is optional and the only thing you'd pay
for. Nothing else on this list has a bill until you have real users — including
the money-making parts, which are deliberately switched off until you choose to
turn them on.

Getting a handful of family onto it, in and out of the country, is a genuinely
good first audience: small enough to be free, real enough to be useful, and
small enough that you can fix what annoys them. See **"If this is for family
rather than the public"** near the end — it also lists what is *not* built yet,
so you don't promise something that isn't there.

---

## The plan in one paragraph

Put the code on GitHub, put the database on Neon (free), connect the two on
Vercel (free), add a domain, then build the browser extension against your real
address. Affiliate links stay **off** at launch — you turn them on later, and
only then does hosting start costing money. That's the plan; the rest is detail.

---

## Before you start: three things to decide

### 1. Do you want a domain name?

A domain is a web address like `wishingwell.co.uk`. You get one for about
£10/year, and it lasts a year and renews.

- **Yes** (recommended) — people can share `yourapp.co.uk`. You have to renew it
  yearly or the site goes offline.
- **Not yet** — Vercel gives you a free address like `my-wishing-well.vercel.app`.
  Everything works, including the extension. You can add a domain later without
  breaking anything, so this is a genuinely fine place to start.

You can start on the free Vercel address and buy the domain when you have
something worth showing people. That is the cheapest possible path, and I'd
suggest it.

### 2. What do you already have?

You need free accounts at:
- **GitHub** — holds your code. Sign up at github.com
- **Vercel** — puts the site online. Sign up at vercel.com (use "Continue with
  GitHub")
- **Neon** — hosts the database. Sign up at neon.com
- **Resend** — sends password-reset emails. Sign up at resend.com (free, 3,000
  emails a month)
- **Google Cloud Console** — only for "Sign in with Google". Can be skipped at
  launch.

All free tiers. None need a card.

### 3. Are you launching publicly, or showing a few people?

This decides whether you run the demo seed against production, and **it is the
one thing you must not get wrong** — see the warning in Step 7.

---

## Step 1 — Put the code on GitHub

**This has not been done yet. There is no git repository in the project at all**,
so this is genuinely step one.

GitHub is where Vercel reads your code from. You cannot deploy without it.

Open a terminal in the project folder:

```bash
cd /home/user/wishlist
```

Tell git who you are (use your own details):

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Create the repository and save your work:

```bash
git init
git add .
git commit -m "First version of Wishing Well"
```

Now go to **github.com → New repository**. Name it `wishing-well`. **Leave
"Add a README" and all the tick boxes unticked** — you already have code, and
letting GitHub add its own files creates a conflict.

When it's created, the page gives you two commands under "push an existing
repository". Paste and run them. They look like:

```bash
git remote add origin https://github.com/YOUR-NAME/wishing-well.git
git branch -M main
git push -u origin main
```

Swap `YOUR-NAME` for your actual GitHub username.

**What's deliberately not being uploaded:** `.env` (your secrets) and
`prisma/dev.db` (your local data) are already excluded by `.gitignore`. This is
correct and important — never let a secret into GitHub.

---

## Step 2 — Create the database

The app works on a SQLite file on your laptop, but a live website needs a real
database, because a website is not one computer. We use PostgreSQL.

1. Go to **neon.com**, sign up, create a project. Name it anything.
2. Neon shows a **connection string**. It starts with `postgresql://`. It looks
   like a very long password. **Copy it** — you need it in a moment.
3. Click the connection string and choose the **Pooled** version, not the direct
   one. It has `?pgbouncer=true` on the end.

Keep that string safe. It is the key to your entire database.

---

## Step 3 — Connect the database and build the tables

Your database is currently empty — there are no tables in it yet. You need to
create them before the app can do anything.

In the project folder:

```bash
export DATABASE_URL="postgresql://...paste-your-neon-pooled-string-here..."
npm run db:deploy
```

You should see:

```
1 migration found in prisma/migrations
Applying migration `20260930223229_init`
All migrations have been successfully applied.
```

**What just happened:** `npm run db:deploy` read
`prisma/migrations/20260930223229_init/migration.sql` and created all 11 tables
in your Neon database. That file is real and has been applied to a real
PostgreSQL server as a check.

There is a subtlety here that used to bite people, so it is worth knowing why
the command is a wrapper rather than a plain `prisma migrate deploy`. The
project keeps **one** schema file that describes **either** SQLite or
PostgreSQL, and local development wants SQLite. Prisma checks the connection
string against the schema, so running a Postgres migration while the file says
SQLite fails with:

```
Error validating datasource `db`: the URL must start with the protocol `file:`.
```

which reads like a database problem and is actually a schema-file problem.
`npm run db:deploy` switches to Postgres, migrates, and switches back, so there
is no step to remember and nothing left in the wrong state. If you set
`DATABASE_URL` to something that is not Postgres, it will tell you plainly
instead of failing obscurely.

It is safe to run more than once — a second run reports "No pending migrations
to apply."

### Before you carry on

Confirm it worked by checking you can still run your local copy:

```bash
npm run dev
```

If `http://localhost:3000` still loads with the demo data, your local setup is
untouched. If something went wrong, `npm run setup` rebuilds it from scratch.

## Step 4 — Deploy to Vercel

1. Go to **vercel.com**, click **Add New → Project**.
2. Import your `wishing-well` repository from GitHub.
3. Vercel shows a settings page. It will have guessed the framework as Next.js —
   that is correct. **Leave the build command alone** unless it is empty; the
   project's own `npm run build` knows what to do.
4. Click **Deploy**.

Wait a minute or two. When it finishes you get a live address.

**It will probably fail the first time.** That is normal and not a disaster.
The most likely reason is that Vercel doesn't know your database address yet —
which is the next step.

---

## Step 5 — Tell Vercel the environment variables

Environment variables are the settings a program reads when it runs. Vercel needs
to know your database address and a secret key.

In your Vercel project: **Settings → Environment Variables → Add**.

Add these. For **Key** type the name exactly; for **Value**, paste the content.

| Key | Value | Notes |
|---|---|---|
| `DATABASE_URL` | your Neon pooled string | Step 2 |
| `AUTH_SECRET` | see below | generate it |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app-name.vercel.app` | your real address |
| `NEXT_PUBLIC_APP_URL` | same as above | used in emails |

**Making `AUTH_SECRET`:**

```bash
openssl rand -base64 32
```

That prints a random string. Copy it as the value.

This is the key that signs people in. Anyone who has it can sign in as anyone.
It is in GitHub nowhere, and you have just generated a fresh one, so nothing is
exposed.

Click **Save**. Vercel now needs a fresh deploy to pick these up — go to the
**Deployments** tab and redeploy the latest one.

---

## Step 6 — Make the database match the new deploy

Vercel builds the app; it does not run migrations. So after the tables exist
(Step 3), the app should work. If you ever change the database structure in
future, you must run the migration again and redeploy.

Check the site now. You should see the landing page.

---

## Step 7 — ⚠ Decide about the demo data, carefully

Your local database has demo content: Alex, Sam and Priya, five wishlists, ten
products, and a public list. The `/demo` pages you can browse without signing in
depend on that data existing.

**This is the part people get wrong, so read it twice.**

The demo accounts use the password `password123`. If you copy that demo data
into your live database, you are publishing three working logins on the open
internet with a password that is written in this project's README. Anyone could
sign in as Alex and read his wishlist.

So the seed script now **refuses to run against a real database** unless you
explicitly tell it to. If you try, it stops and explains itself.

**Option A — start with no demo data (safest).**

Skip seeding. The `/demo` pages will be empty, and the site starts clean. This
is the right choice if you are putting this in front of the public.

**Option B — seed demo data to show a friend.**

Run it with a password only you know:

```bash
DATABASE_URL="postgresql://...your-neon-string..." \
ALLOW_DEMO_SEED=true \
DEMO_PASSWORD="something-nobody-would-guess" \
npm run db:seed
```

If you leave `DEMO_PASSWORD` out, the script invents a random one and prints it.
Either way the published `password123` never reaches your live database.

**If you seeded with demo data, delete it before launch.** There is a reset
script, but for a live database you probably want to start clean rather than
delete rows one by one.

---

## Step 8 — Add your domain (optional, but do it soon)

In Vercel: **Settings → Domains → Add**. Type the domain you bought and follow
the instructions. Vercel tells you to add two records at your domain registrar.

Then add one more environment variable and redeploy:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.co.uk` |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.co.uk` |

This matters more than it looks: those values appear in password-reset links and
Google sign-in redirects. Leave them pointing at the `.vercel.app` address and
those will quietly send people to the wrong place.

---

## Step 9 — Password reset emails (do this before showing anyone)

Right now, if someone forgets their password, the reset email cannot send.
`Resend` fixes that and is free up to 3,000 emails a month.

1. Sign up at **resend.com**, verify your email.
2. On the **Domains** tab, add your domain and follow the DNS instructions.
3. Resend gives you an API key. Create one and copy it.
4. In Vercel, add `RESEND_API_KEY` and `MAIL_FROM` (something like
   `Wishing Well <hello@your-domain.co.uk>`), then redeploy.

Skip this and be honest with early users about how to sign in.

---

## Step 10 — "Sign in with Google" (optional)

Skippable. The email-and-password login works on its own.

To add it, you must register your site with Google:

1. Go to **console.cloud.google.com/apis/credentials** and create an OAuth
   client.
2. Add a **Web application**.
3. Under *Authorised redirect URIs*, add
   `https://your-domain.co.uk/api/auth/callback/google`.
4. Copy the **Client ID** and **Client Secret** into Vercel as
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then redeploy.

The redirect URI must match your real address exactly, including `https://` and
no trailing slash. This is the single most common reason Google sign-in fails.

---

## Step 11 — Build the extension for your real address

The extension in this project currently points at `localhost:3000`, so it only
works on your own machine. Now it can point at the real site:

```bash
WISHING_WELL_ORIGIN=https://your-domain.co.uk npm run extension:build
```

Then commit and push the result:

```bash
git add extension
git commit -m "Point the extension at the live site"
git push
```

**One thing to know about this, and it will bite you if you skip it:** you are
pushing a *changed* `extension/` folder on top of the one already on GitHub. Git
is a timeline, not a folder, so the files you changed and the files you did not
can disagree. Push the whole folder in one commit (`git add extension` above
does this) and the built extension will load correctly.

Load it: `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
choose the `extension/` folder. **Anyone you give the extension to has to do
this on their own machine** unless you publish it to the Chrome Web Store, which
is a separate project in its own right and not needed to launch.

---

## Step 12 — Before you tell anyone

Work through this list with the site actually open in front of you.

- [ ] Home page loads on a real address, not `localhost`
- [ ] Sign up with your own email and sign in
- [ ] Create a list, add a product, see it appear
- [ ] Open the share link in a private window — a signed-out visitor sees the
      list and can reserve something
- [ ] The extension loads and saves a real product
- [ ] Password reset actually sends you an email (Step 9)
- [ ] Nothing on the site says `localhost`
- [ ] No demo accounts with `password123` exist in the live database (Step 7)
- [ ] It works on a phone — narrow screens are a common breakage

---

## Later: turning on the money

Nothing above costs money. This part does, and it is deliberately separate.

**Do not enable affiliate links until you have real traffic.** The feature is
off by default and the site works exactly the same either way.

When you are ready, two things change at once:

1. You set `AFFILIATE_ENABLED=true` and your affiliate network's ID in Vercel,
   then redeploy.
2. **You must upgrade Vercel to Pro ($20/month).** The free Hobby plan is for
   personal, non-commercial use and explicitly rules out sites that earn through
   affiliate links. Using it commercially breaks their terms, and they do act on
   it. A self-hosted VPS is the cheaper alternative if you ever want it, but it
   is a lot more work and is not worth it until you have paying traffic.

UK tax, for later and not urgent: the tax-free personal allowance on trading
income is £1,000 a year. Under that there is nothing to declare. Over it, you
register as self-employed and file a return. You do not need to think about this
until the income is real.

---

## If this is for family rather than the public

Roughly ten people, some in the UK and some abroad, is a much easier launch than
"the public" — and in some ways the *right* first audience. Here is what
changes.

### It still costs nothing

Ten people using a wishlist app is a rounding error against Vercel's free
tier's 100 GB of bandwidth and 4 CPU-hours a month. You would need thousands of
active users before that ceiling mattered.

**The free Hobby plan is fine for this**, as long as you leave affiliate links
switched off. You are not charging anyone, not running ads, and not selling
anything. A personal, non-commercial app is exactly what Hobby is for. The rule
only bites when money starts flowing through the site.

### Email moves from optional to essential

With a handful of strangers, a broken password reset is an inconvenience. With
family, it is the thing that gets you a phone call. Do Step 9 before you send
anyone the link.

### Ask them to confirm their email address

The site now shows a banner at the top until someone confirms their address.
This matters more than it sounds: if someone types `alex@gmial.com` by mistake,
their account still works, but every password reset goes to an address they do
not control. There is no way back from that without a database edit. The banner
is the only thing standing between a typo and a permanently confused relative.

### Money and the law

Do not put demo accounts on a live database that real people are using — see
Step 7. Ten family members' real wishlists and a `password123` login in the same
database is asking for trouble.

A free personal app used by family is not a business, so there is nothing to
declare and no accounts to file. That stays true until money comes in.

### Spreading across countries

Three things were checked and fixed for this specifically:

- **Birthdays do not shift by a day.** A date typed as "15 March" read as
  "14 March" for anyone west of Greenwich, because the stored date was being
  rendered in each viewer's local timezone. Occasions are now pinned to UTC, so
  the day that was typed is the day everyone sees. There is a test covering
  seven timezones.
- **Currency is per item.** There is now a currency selector next to the price
  box, so someone entering a price by hand picks £, $, € or whatever they mean
  instead of silently getting USD. The extension reads the currency off the
  product page automatically.
- **Dates format per reader.** Someone in the UK sees "15 October" and someone
  in the States sees "October 15" — both correct for them. Only the *day* is
  locked down, not the wording.

### What is still not built

Worth knowing before you promise anyone anything:

- **No push notifications or email reminders.** The app surfaces upcoming
  occasions when someone opens it; it will not tap them on the shoulder. If
  birthdays are the reason your family will use this, that is a real gap.
- **Share links do not expire yet.** `ShareLink.expiresAt` exists in the data
  model but is not exposed. Fine for family; think twice before sharing a link
  publicly.
- **Rate limiting is per-instance.** Fine at this size, and it resets whenever
  the server restarts, so it is not a security control against a determined
  person.
- **Price history is thin.** Prices are only recorded when someone runs the
  price checker or edits a price. Nothing is scraping shops in the background,
  so history fills in slowly or not at all.
- **The extension is not on the Chrome Web Store.** Each person loads the
  unpacked folder themselves, which is a slightly awkward ask and the single
  most likely reason a relative gives up.

The reminders gap is the one I would close first, if the family tells you it
is the thing they actually wanted.

---

## When something breaks

- **Site shows an error about `DATABASE_URL` or a datasource** — the schema was
  built for the wrong database. The `npm run build` script now detects this
  automatically, so redeploy and check the variable is set in Vercel.
- **"Invalid login" but the password is right** — usually `NEXT_PUBLIC_SITE_URL`
  pointing somewhere unexpected. It must be your real address, no trailing slash.
- **Password reset does nothing** — `RESEND_API_KEY` missing, or the `MAIL_FROM`
  domain is not verified with Resend.
- **Google sign-in bounces back to a blank page** — the redirect URI does not
  match exactly. Copy it from Google's console, do not retype it.
- **The extension cannot reach the site** — it was built for the old address.
  Rebuild with `npm run extension:build` and reload it on `chrome://extensions`.
- **Read Vercel's build log.** The actual error is nearly always in the last
  twenty lines, and it is more reliable than guessing.
