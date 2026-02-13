# Deploy (Vercel + Supabase)

## Domains

**Product domain:** `qrlabel.one`  
**QR label domain:** `qrx.dk` (redirects to `qrlabel.one`)

**MANUAL STEP:** Add `qrlabel.one` and `qrx.dk` as domains on the Vercel project, and configure DNS to point both to this Vercel project. The redirect behavior for `qrx.dk` is implemented in `src/middleware.ts`.

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

Hvis `https://qrlabel-bins.vercel.app/` giver 404, så er domænet ikke korrekt aliased til projektet.

**MANUAL STEP:**
1) Vercel Dashboard → `hikmet-altuns-projects` → `qrlabel-bins`
2) `Settings` → `Domains`
3) Sikr at `qrlabel-bins.vercel.app` står på listen og peger på dette projekt
4) Hvis den mangler: tilføj domænet eller brug en anden `*.vercel.app` URL der er listet under deployment “Aliases”

## Smoke test (after protection is off)

Kør lokalt mod production:

`pnpm run smoke:qr -- --base=https://qrlabel-bins.vercel.app --token=JcX5YxtiBOc8aYmP`

## Supabase

Migrations live in `supabase/migrations`. Push with:

`supabase db push`

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

I denne MVP returnerer `/api/claim/start` kun en `devCode` udenfor production. I production skal koden sendes via en provider.

**MANUAL STEP:** Vælg og konfigurér en provider:

- Email: Postmark/SendGrid/Resend
- SMS: Twilio/MessageBird

Implementér afsendelse i `src/app/api/claim/start/route.ts` og sæt nødvendige env vars på Vercel.

## Fallback (SMS / Email)

**MANUAL STEP:** If you want SMS/email fallbacks, connect a provider (e.g. Twilio/MessageBird for SMS, SendGrid/Postmark for email) and implement a sender in server routes. This repo does not ship with provider credentials by default.
