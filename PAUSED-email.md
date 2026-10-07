# Paused: email sending, and what unblocks it

**Status as of 7 October 2026.** Everything below works. Email is the only thing
parked, and it was paused deliberately — not blocked by a fault.

## Why it's parked

Password reset and email verification are implemented and working in code
(`src/lib/mail.ts`, `src/app/api/forgot-password`, `src/app/api/register`). They
silently no-op because no `RESEND_API_KEY` is set, so mail is written to a file
on the server instead of being sent.

Getting email working needs **SPF, DKIM and MX DNS records**. Those can only be
added to a domain you own. Vercel does not permit DNS changes to `vercel.app`
subdomains, so `wishing-well-seven.vercel.app` can never send email. This is a
platform rule, not a misconfiguration.

The free fallback does not help either: Resend's `onboarding@resend.dev` can
only send to the address on the Resend account itself. Anyone else returns 403.

## The one-line fix when you resume

Buy a domain (~£5–10, one-off), point it at Vercel, then:

1. Add the domain in Resend → **Domains** → **Add Domain** (use a subdomain,
   e.g. `send.yourdomain.com`, which is what Resend recommends)
2. Add the three records Resend generates to the domain's DNS provider
3. Resend → **Verify** (usually ~15 minutes)
4. In Vercel → **Settings** → **Environment Variables**, set:
   - `RESEND_API_KEY` — from Resend → **API Keys** → **Create API Key**
   - `MAIL_FROM` — `Wishing Well <hello@yourdomain.com>`
   - `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` — the new domain, **with
     `https://`**. A bare hostname fails the build; this was fixed defensively
     in `siteUrl()` but the value still needs the scheme.
5. Redeploy

Both `MAIL_FROM` and the `from:` in `sendMail` must match the verified domain
exactly, subdomain included, or the API returns 403.

## What family can do today (no email needed)

Registration, sign-in and full use were verified against production — real
account created, signed in, wishlist returned. `emailConfirmed` only drives a
banner in `VerifyEmailBanner.tsx`; it is **not** an access gate, so unverified
users are not blocked from anything.

## The two known gaps to keep in view

- **Unverified banner** never clears, because no email is ever sent.
- **Forgotten password = permanently locked out.** This is the real risk. If
  anyone is locked out, a password has to be changed directly in the database.
  With roughly ten family members using this, the odds of it happening are not
  small.

If the domain is not bought, the honest alternative is to hide the
verify-your-email prompt so the app stops promising something it cannot deliver.

## Housekeeping

A test account was created in production while verifying the signup flow:

```
smoke-test-1791399404@example.com   /   SmokeTest12345
```

Delete it whenever convenient — there is no admin UI for this yet.

## Also parked

- **Google sign-in** shows a button but needs `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET`, plus an authorised redirect URI of
  `https://<domain>/api/auth/callback/google`. Worth doing at the same time as
  the domain, since both need the new URL.