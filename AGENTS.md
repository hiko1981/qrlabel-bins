# QRLABEL Bins — scope & guardrails (Codex)

Denne fil er den “kontrakt”, der skal holde arbejdet inden for det aftalte scope for repoet `qrlabel-bins`.
Hvis en opgave falder udenfor scope, så stop og spørg først.

## 0) Hård grænse: AVIRA er urørt

- **AVIRA må ikke ændres**: ingen kode, assets, design, copy, domæner, redirects eller integrationer i AVIRA-projekter.
- Arbejd **kun** i dette repo (`qrlabel-bins`) og på de domæner/DB’er der hører til QRLABEL Bins.

## 1) Produktets kerne

QRLABEL Bins er et QR-baseret identitetssystem for affaldsbeholdere.

- Hver bin har en unik `locator_token`.
- QR-kode peger på `https://qrx.dk/k/<locator_token>`.
- `qrx.dk` redirecter til QRLABEL-host (pt. `https://qrlabel.eu/k/<locator_token>`).
- Systemet er **web-only** (ingen app), rollebaseret (**public / owner / worker**), device-bundet via passkeys, push-notifikationsbaseret og driftsegnet (events, hangtags, kvittering).

## 2) Roller og adgangsmodel (skal bevares)

**Public (ingen login)**
- Ved scanning ser man: adresse, fraktioner (venstre/højre), satellitfoto + præcis placering.
- Public kan: dele geolocation én gang og udløse event `misplaced_location_shared`.
- Ingen konto. Ingen tracking.

**Owner (passkey-bundet device)**
- Første gang: claim-link → opret passkey → aktivér web push.
- Herefter: single tap (FaceID/TouchID). Ingen MitID hver gang.
- Dashboard viser: bins i scope, ulæste hændelser øverst, hangtags, tømning/besøg, public “misplaced” lokation, link til kommunens MitID-portal, notifikation on/off.
- Owner får push ved: tømning, besøg, hangtag, public lokationsdeling.

**Worker (passkey-bundet device)**
- Ser: bin-info, fraktioner, rute-knap, kvitter besøg/tømning, læg hangtag (template + fritekst).
- Scope styres via: `route_id`, tidsvindue, ansættelsesstatus.
- Worker events udløser push til owner.

## 3) Events & notifikationer (kontrakt)

- Central tabel: `events` (bin events).
- Typer: `visit_confirmed`, `emptied_confirmed`, `tag_issued`, `misplaced_location_shared`.
- Owner view prioriterer: ulæste hangtags → misplaced → tømning/besøg.
- Push: service worker + VAPID + `push_subscriptions` + retry/revoke døde endpoints + locale per subscription.
- Single-tap flow: push → klik → passkey → inde.

## 4) QR-label generation (med AVIRA logo)

- QR: error correction level **H**, quiet zone, center logo (AVIRA mark) på hvid rounded plate.
- Output: PNG (1024x1024), SVG, PDF, `/label/<token>` preview-side, admin label UI.
- Scripts: `verify-qr` (dekoder QR og tester URL).

## 5) Infrastrukturstatus (må ikke “opfindes”)

- Repo: `hiko1981/qrlabel-bins`
- Supabase: schema + migrations (skal være i sync via migrations).
- Vercel: deployed (deployment protection kan blokere public scanning).
- Redirect: middleware håndterer `qrx.dk → qrlabel.one`.

## 6) Vigtige tekniske valg (må ikke brydes)

- WebAuthn (passkeys)
  - `rpID = qrlabel.one`
  - `origin = https://qrlabel.one`
  - Device-bound.
- **Ingen tokens i URL** (ingen JWT i URL).
- Session cookie (server-side), **ingen localStorage tokens**.
- Security: RLS i Supabase, scope enforcement, rate limiting på public location share.

## 7) Satellitfoto & placering (kontrakt)

- Bin har: `lat/lng`, `placement_side` (venstre/midt/højre), `placement_hint`.
- Vises for: public, owner, worker.
- Rute-knap åbner Apple/Google Maps med destination.

## 8) Claim & issuance (kontrakt)

- Owner claims: admin-simuleret issuance + claim links.
- Allowed contacts (email/tlf) er kilden til hvem der kan claim’e.
- `/claim-access` self-serve flow.
- OTP kræver real provider i prod.
- Flere owners/workers pr bin understøttes.

## 9) Arbejdsprincipper for ændringer

- Hold ændringer små og scope-fokuserede.
- Skift ikke domæner, rpID/origin, eller auth-model uden eksplicit accept.
- DB-ændringer skal ske via `supabase/migrations/*` og pushes med `supabase db push` (ingen “manual” schema tweaks).
- Undgå breaking changes i public scanning.

## 10) Definition of done for “scan routing”

Målet er:
- Scanning af **egen** bin (når session/owner-rolle findes) lander i owner hub.
- Scanning af **fremmed** bin viser public view.
- Første gang på en device: claim → passkey → push → derefter single-tap.
