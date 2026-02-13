# Deploy (Vercel + Supabase)

## Domains

**Product domain:** `qrlabel.one`  
**QR label domain:** `qrlabel.eu`

`qrlabel.eu` should point directly to this Vercel project (serving `/k/<token>`, `/label/<token>`, and the QR download endpoints).

### DNS records (recommended quick setup)

Set these records at your DNS provider:

- `A qrlabel.eu -> 76.76.21.21`
- `CNAME www.qrlabel.eu -> cname.vercel-dns.com` (or `A www.qrlabel.eu -> 76.76.21.21`)
- (optional app host) `A bins.qrlabel.one -> 76.76.21.21`

Notes:
- `qrlabel.one` apex is currently attached to another project in this Vercel team; do not move it if that project is AVIRA-related.

## Deployment protection

Hvis du har Vercel Authentication / Deployment Protection slået til, vil public scanning (`/k/<token>`) ikke virke.

**MANUAL STEP (click-by-click):**
1) Åbn Vercel Dashboard
2) Vælg team/scope: `hikmet-altuns-projects`
3) Åbn projektet: `qrlabel-bins`
4) Gå til `Settings` → `Security`
5) Find `Deployment Protection` / `Vercel Authentication` (navn kan variere)
6) Slå protection **Off** for **Production**
7) Gem ændringer

Når protection er slået fra skal disse virke offentligt:
- `/labels/sample`
- `/label/<token>`
- `/api/qr/png?token=<token>` (download)
- `/api/qr/svg?token=<token>` (download)
- `/api/qr/pdf?token=<token>` (download)
- `/api/qr/bundle?token=<token>` (download zip)

## Vercel domain alias (`*.vercel.app`)

For team-projekter er standard-domænet typisk `https://qrlabel-bins-hikmet-altuns-projects.vercel.app/`.

Hvis du prøver `https://qrlabel-bins.vercel.app/` og får 404, så er det domæne sandsynligvis ikke tilgængeligt/owned i teamet.

**MANUAL STEP:**
1) Vercel Dashboard → `hikmet-altuns-projects` → `qrlabel-bins`
2) `Settings` → `Domains`
3) Brug `qrlabel-bins-hikmet-altuns-projects.vercel.app` som den sikre `*.vercel.app` URL
4) Alternativt: brug den seneste production deployment URL (står i Vercel deployment “Aliases”)

## Smoke test (after protection is off)

Kør lokalt mod production:

`pnpm run smoke:qr -- --base=https://qrlabel-bins.vercel.app --token=JcX5YxtiBOc8aYmP`

## Supabase

Migrations live in `supabase/migrations`. Push with:

`supabase db push`

### Diagnose token lookup (admin)

Hvis `/k/<token>` viser “Kunne ikke hente bin-data…”, så kan du tjekke om token findes i DB, og om Supabase env virker:

`GET /api/admin/diagnose-token?token=<token>` med header `x-admin-key: <ADMIN_API_KEY>`

## Web Push (VAPID)

Set these env vars on Vercel (Production + Preview):

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `PUSH_SUBJECT` (e.g. `mailto:ops@qrlabel.one` or `https://qrlabel.one`)

**MANUAL STEP:** Generate keys (one-time) locally:

`node -e "const webpush=require('web-push'); console.log(webpush.generateVAPIDKeys())"`

Then set the values in Vercel env vars.

## Claim via email/SMS (OTP)

`/claim-access` bruger `POST /api/claim/start` + `POST /api/claim/verify`.

I production sendes koden via en provider (email/SMS). Uden provider vil `/api/claim/start` returnere `501`.

**MANUAL STEP:** Vælg og konfigurér en provider:

- Email: Resend (anbefalet)
- SMS: Twilio

Sæt disse env vars på Vercel (Production + Preview):

- Email (Resend): `RESEND_API_KEY`, `RESEND_FROM`
- SMS (Twilio): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

## Fallback (SMS / Email)

**MANUAL STEP:** If you want SMS/email fallbacks, connect a provider (e.g. Twilio/MessageBird for SMS, SendGrid/Postmark for email) and implement a sender in server routes. This repo does not ship with provider credentials by default.
