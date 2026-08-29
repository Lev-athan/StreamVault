# StreamVault

A streaming platform built with Next.js 14 (App Router), Supabase (Auth +
Storage + Postgres), and Stripe. Search-first landing page, free/premium
tiers with real quality and watch-limit enforcement, an admin upload panel,
and premium-only reviews/ratings.

## What's enforced, and how

| Rule | Where it's enforced |
|---|---|
| Free/guest: 480p max | Server picks the `video_path_480` rendition when minting the signed URL (`src/lib/access-control.ts`) |
| Free/guest: 2 episodes/series | Checked server-side against `watch_events` before a signed URL is ever issued (`/watch/[id]`, `/api/watch-progress`) |
| Free/guest: 20 min/movie | Player pauses client-side at the cap **and** the signed URL itself expires ~5 min after the cap, so a user can't just re-seek |
| Premium-only comments/ratings | Enforced by a Postgres RLS policy on `comments`, not just the UI |
| Admin-only uploads | Server checks `profiles.role = 'admin'` before any storage write; RLS also blocks non-admins directly |

Guests (no account) get the same limits as free accounts because they're
silently signed in via **Supabase anonymous auth** (`GuestSession.tsx`) —
this gives every visitor a real `auth.users` row so `watch_events` can track
them, without forcing signup just to sample content.

### Quality enforcement, honestly

Real per-resolution capping requires two actual encoded files. The schema
has an optional `video_path_480` column — if you only upload one file, free
users are still served the same master (best-effort browser-level cap only).
For true enforcement, transcode a 480p rendition per upload (e.g. an
`ffmpeg` step in a Supabase Edge Function, or a service like Mux/Cloudflare
Stream) and pass it as the "480p rendition" file in the admin upload form.

## Setup

### 1. Supabase project
1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/schema.sql` in full.
3. In **Authentication → Providers**, enable **Email**, and enable
   **Anonymous sign-ins** (used for guest tracking).
4. Storage buckets (`videos` private, `posters` public) are created by the
   schema script — verify them under **Storage**.
5. Copy `Project URL`, `anon public` key, and `service_role` key into
   `.env.local` (copy from `.env.local.example`).

### 2. Make yourself an admin
Sign up in the app normally, then in the SQL Editor:
```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

### 3. Stripe
1. Create a Product ("Premium") with a recurring monthly Price; copy its
   Price ID into `STRIPE_PREMIUM_MONTHLY_PRICE_ID`.
2. Copy your secret + publishable keys into `.env.local`.
3. For local development, forward webhooks:
   ```
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   and put the printed signing secret into `STRIPE_WEBHOOK_SECRET`. In
   production, add a webhook endpoint at `/api/stripe/webhook` listening for
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.created`, and `customer.subscription.deleted`.

### 4. Install & run
```bash
npm install
npm run dev
```

## Project structure

```
src/app/
  page.tsx                landing page — search bar
  login/, signup/          Supabase email/password auth
  browse/                  search + category results
  title/[id]/              details, episode list, reviews
  watch/[id]/               player, access checks, signed URLs
  admin/                    title list, gated to role=admin
  admin/upload/             new title form + add-episode form
  pricing/, account/        Stripe checkout + billing portal
  api/
    watch-progress/         access check, signed URL, heartbeat
    admin/upload/            multipart upload → Storage + DB
    stripe/checkout|portal|webhook/
src/components/             Navbar, SearchBar, VideoPlayer, CommentSection, ...
src/lib/
  access-control.ts         single source of truth for plan limits
  supabase/{client,server,admin}.ts
  stripe.ts
supabase/schema.sql          tables, RLS policies, storage buckets
```

## Notes & next steps

- `Database` in `src/lib/types.ts` is a loose placeholder — run
  `npx supabase gen types typescript` once your schema is deployed for real
  query type-safety.
- Admin uploads go straight to Supabase Storage through a Next.js API route,
  which buffers the file in memory — fine for demo-sized files, but for
  large video masters consider direct-to-storage resumable uploads (tus)
  instead.
- There's no video transcoding pipeline included (see "Quality enforcement"
  above) — that's the main piece to add for production use.
