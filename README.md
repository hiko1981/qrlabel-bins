## QRLABEL Bins (Affaldsspand) — MVP

Web-only scanning med WebAuthn/Passkeys (device-binding).

### Scan URLs

- Canonical scan: `https://qrlabel.one/k/<token>`
- QR label URL: `https://qrx.dk/k/<locator_token>`
- Redirect: `qrx.dk/*` → `qrlabel.one/k/<token>` (via `src/middleware.ts`)

### Roller

- `public`: ingen passkey
- `owner`: passkey
- `worker`: passkey

### Lokal udvikling

1) Kopiér env:

`cp .env.example .env.local`

2) Start:

`pnpm dev`

### QR label test

Generér QR med center-logo og dekod den igen lokalt:

`pnpm run verify:qr`

### Supabase schema

Migrations ligger i `supabase/migrations`.

### Admin (MVP issuance)

Alle admin endpoints kræver `x-admin-key: $ADMIN_API_KEY` eller `Authorization: Bearer $ADMIN_API_KEY`.

- Opret spand + token: `POST /api/admin/create-bin` `{ "label": "...", "municipality": "..." }`
- Udsted member + claim-link: `POST /api/admin/issue-member` `{ "binToken": "...", "role": "owner"|"worker" }`
- Test Web Push: `POST /api/admin/test-push` `{ "principalId": "..." }`

Claim-link åbnes på den enhed der skal bindes: `GET /claim/<claimToken>` → “Opret passkey”.

### Web Push

Owners (og workers) kan aktivere notifikationer via `/owner` eller på `/k/<token>` efter login.
