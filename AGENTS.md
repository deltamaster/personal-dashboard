# AGENTS.md — Personal Dashboard

> **Read this first.** Single source of truth for AI agents and implementers.
> Repo status: **movies module implemented** — portfolio/travel pending. Cloud not provisioned yet.

## Doc map

| Read when… | Document |
|---|---|
| Starting any task | This file (`AGENTS.md`) |
| Implementing auth, data models, APIs, UI | [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) |
| Provisioning or deploying to Alibaba Cloud | [docs/deployment.md](./docs/deployment.md) |
| Human-oriented product overview | [README.md](./README.md) |

Do not duplicate content across these files. If something conflicts, **AGENTS.md wins**.

---

## Product scope

Personal dashboard for one user (`huhansen318@hotmail.com`):

| Module | Data |
|---|---|
| **Portfolio** | Holdings, NAV, PnL, risk (R1–R5), staleness alerts |
| **Travel** | Visits, flights, trains, private photo gallery |
| **Movies** | Douban-linked watch log, ratings, director stats |

Launch with **empty/manual data**. SQLite migration is deferred (see [TECHNICAL_SPEC.md § Migration](./TECHNICAL_SPEC.md#migration-deferred)).

---

## Hard constraints

| Rule | Value |
|---|---|
| Users | Exactly one — `huhansen318@hotmail.com` |
| Microsoft accounts | **Personal (consumer) only** — no work/school |
| Cloud | **Alibaba Cloud only** — no Vercel, no AWS |
| Compute billing | **No hourly/always-on cost** — FC pay-per-invocation; static UI on OSS |
| Domain | `huhansen.cn` (registered with Alibaba) |
| Region | `ap-southeast-1` (Singapore — active stack; Shanghai paused) |
| OSS web bucket | **Public read** — static HTML/JS/CSS only |
| OSS vault bucket | **Private** — presigned URLs only; block all public access |
| Auth protocol | OAuth 2.0 Authorization Code — **not** Implicit Flow |
| Static UI | Next.js `output: "export"` — no SSR in production |
| API auth | Session check in **every** API handler (client guard is UX only) |

---

## Constants

```
DOMAIN= huhansen.cn
AUTH_URL_PROD= https://huhansen.cn
ALLOWED_USER_EMAIL= huhansen318@hotmail.com
MICROSOFT_ISSUER= https://login.microsoftonline.com/consumers/v2.0
MICROSOFT_CONSUMER_TENANT_ID= 9188040d-6ce5-4aae-b5-5e4b370a0ae8  # fixed, do not env-var

OTS_INSTANCE= pd-dash-sg
OTS_ENDPOINT= https://pd-dash-sg.ap-southeast-1.ots.aliyuncs.com

OSS_WEB_BUCKET= pd-web-sg              # public static site
OSS_VAULT_BUCKET= pd-vault-sg          # private media
OSS_REGION= oss-ap-southeast-1

FC_SERVICE= personal-dashboard
FC_FUNCTION= api
FC_MIN_INSTANCES= 0                   # required — zero idle cost
```

---

## Architecture

```
https://huhansen.cn
        │
   Alibaba CDN (+ SSL)
        │
        ├── /*      → OSS huhansen-web     (Next.js static export, public)
        └── /api/*  → FC HTTP trigger       (Auth.js + REST API, pay-per-use)
                            │
                            ├── OTS (7 tables)
                            └── OSS personal-dashboard-vault (presigned only)
```

**Two deploy artifacts** (cannot be one Next.js build):

| Artifact | Build | Destination |
|---|---|---|
| Static UI | `next build` → `out/` | `oss://huhansen-web/` |
| API server | `build:api` → Docker standalone | FC custom container via ACR |

Auth routes live on FC at `/api/auth/*`. CDN keeps a single browser origin so session cookies work.

---

## Environment variables

Full list — defined once here; [docs/deployment.md](./docs/deployment.md) shows which go on FC.

```env
# Auth.js
AUTH_URL=http://localhost:3000          # prod: https://huhansen.cn
AUTH_SECRET=

# Microsoft (personal accounts only; no AZURE_AD_TENANT_ID)
AUTH_MICROSOFT_ENTRA_ID_ID=
AUTH_MICROSOFT_ENTRA_ID_SECRET=
ALLOWED_USER_EMAIL=huhansen318@hotmail.com

# Alibaba RAM user (AssumeRole only) + role for OTS/OSS (local + FC runtime)
ALIBABA_CLOUD_ACCESS_KEY_ID=
ALIBABA_CLOUD_ACCESS_KEY_SECRET=
ALIBABA_CLOUD_ROLE_ARN=acs:ram::1197388755513152:role/resourceadmin
# Local dev session name; FC uses personal-dashboard-fc (set in Terraform / Deploy API)
ALIBABA_CLOUD_ROLE_SESSION_NAME=personal-dashboard
ALIBABA_CLOUD_REGION=ap-southeast-1

# OTS
OTS_ENDPOINT=https://pd-dash-sg.ap-southeast-1.ots.aliyuncs.com
OTS_INSTANCE_NAME=pd-dash-sg

# OSS
OSS_WEB_BUCKET=pd-web-sg
OSS_WEB_REGION=oss-ap-southeast-1
OSS_VAULT_BUCKET=pd-vault-sg
OSS_VAULT_REGION=oss-ap-southeast-1
OSS_VAULT_ENDPOINT=oss-ap-southeast-1.aliyuncs.com
```

---

## Planned repo layout

```
app/
  api/           → FC only (Auth.js + REST)
  auth/          → static export (signin, error)
  portfolio/ travel/ movies/
components/
  auth-guard.tsx → client-side route protection
lib/
  auth.ts ots.ts oss.ts
docs/deployment.md
TECHNICAL_SPEC.md
AGENTS.md
```

---

## Implementation order

1. Azure app registration (personal accounts; redirect `https://huhansen.cn/api/auth/callback/microsoft-entra-id`)
2. Alibaba provisioning — see [docs/deployment.md](./docs/deployment.md)
3. Scaffold Next.js: static export + separate API build + Auth.js + `AuthGuard`
4. Features: portfolio → travel → movies (manual/test data)
5. CI/CD: static → OSS, API → ACR → FC
6. Migration *(later)* — SQLite import scripts

---

## Agent checklist (before marking work done)

- [ ] Single-user allowlist enforced in `signIn` callback, not just client UI
- [ ] Every `app/api/**` handler calls `auth()` and returns 401 if missing
- [ ] Vault bucket never publicly readable; photos use presigned GET/PUT
- [ ] Web bucket contains only static assets — no user data
- [ ] `AUTH_URL` in prod is `https://huhansen.cn`, not FC trigger URL
- [ ] FC `minInstances` = 0
- [ ] Portfolio `updated_at` only changes on valuation edits (see spec § Computed fields)

---

## Cursor Cloud specific instructions

Dev environment is plain Next.js 14 (App Router). **Node 24** Active LTS (see `.nvmrc`; CI uses `node-version-file`). FC bundles the matching Node **linux-x64** binary in `api.zip` (`./node/bin/node`); Deploy API syncs `customRuntimeConfig` on every deploy. Standard commands live in `package.json` `scripts` and `docs/SETUP.md`; key notes below.

**Local env file (gitignored):** copy `.env.example` → `.env.local`. At minimum set `AUTH_SECRET` (`openssl rand -base64 32`).

**Critical gotcha — API routes need OAuth vars to even load:** `auth.ts` calls `getOAuthCredentials()` at module load and *throws* if `AUTH_MICROSOFT_ENTRA_ID_ID` / `AUTH_MICROSOFT_ENTRA_ID_SECRET` are missing (outside production build). Because every `app/api/**` route imports `@/auth`, a missing pair makes **all** API routes (including `/api/auth/session`) return HTTP 500, not 401. For any local API work set both vars — placeholder strings are enough to load the modules and exercise the 401 auth-gate; real Azure values are only needed for an actual Microsoft login.

**Running without cloud backends:** set `QA_DUMMY_DATA=1` to serve built-in sample data for **all** modules (movies/portfolio/travel) without Alibaba OTS, or use the per-module flags `PORTFOLIO_DUMMY_DATA=1` / `TRAVEL_DUMMY_DATA=1` / `MOVIES_DUMMY_DATA=1` (these per-module flags are dev-only; `QA_DUMMY_DATA` works in any env). All routes still require a valid session unless auth is bypassed (below).

**QA / agent environment (bypass auth):** set `MICROSOFT_AUTH_ENABLED=false` **and** `NEXT_PUBLIC_MICROSOFT_AUTH_ENABLED=false` (both — the `NEXT_PUBLIC_` one is baked into the client bundle at build time). Then auth is bypassed: `requireSession()` returns a stub owner session (API routes skip the 401), `auth.ts` no longer throws on missing OAuth creds, and the client `SessionProvider` reports an authenticated "QA User". Combine with `QA_DUMMY_DATA=1` for a fully offline QA env.

**QA cloud stack (Terraform):** QA is a **third stack on the main root** via `terraform/env/qa.tfvars` (state key `terraform-state-qa-hosted`) — a full hosted clone of prod (`pd-dash-qa`, `pd-web-qa`, `pd-vault-qa`, FC `api-qa`, CDN `pd-qa.huhansen.com`) with **Microsoft auth enforced** (no bypass). Run via **Actions → Terraform → stack `qa`**, then **Deploy API**/**Deploy Web** with stack `qa`. The apply adopts the previously-created QA resources via `scripts/import-existing.sh`. Photos upload server-side to `pd-web-qa` (FC env `OSS_MEDIA_BUCKET`). See `terraform/README.md`. The live `pd-dash-sg`/`pd-dashboard` are **production** — never seed/pollute them.

**Local QA against the cloud:** to run the app locally pointed at the QA data with auth bypassed, set in `.env.local`: `MICROSOFT_AUTH_ENABLED=false`, `NEXT_PUBLIC_MICROSOFT_AUTH_ENABLED=false`, `OTS_INSTANCE_NAME=pd-dash-qa`, `OTS_ENDPOINT=https://pd-dash-qa.ap-southeast-1.ots.aliyuncs.com`. `scripts/qa-seed.mjs` seeds dummy rows into a QA instance (refuses prod instance names).

**Photo URLs (`MEDIA_PUBLIC_BASE_URL`):** visit photos are uploaded to the vault bucket and rendered directly from `oss_url`. When `MEDIA_PUBLIC_BASE_URL` is set (e.g. the QA CDN `https://pd-qa.huhansen.com`), `lib/oss.ts toPublicMediaUrl()` stores/serves `oss_url` as `<base>/<objectKey>` so images load via the CDN custom domain (write-time in the images route + read-time in `normalizeImage`). Unset = bare object key (unchanged prod behavior).

**Region stacks:** Singapore (`ap-southeast-1`, `pd.huhansen.com`) and Shanghai (`cn-shanghai`, `pd.huhansen.cn`) are both production. QA stays on Singapore only (`pd-qa.huhansen.com`). For local dev against live data, pick the stack you need — Singapore: `OTS_INSTANCE_NAME=pd-dash-sg`, `OTS_ENDPOINT=https://pd-dash-sg.ap-southeast-1.ots.aliyuncs.com`; Shanghai: `OTS_INSTANCE_NAME=pd-dashboard`, `OTS_ENDPOINT=https://pd-dashboard.cn-shanghai.ots.aliyuncs.com`, vault `personal-dashboard-vault`, web `huhansen-web`. **Writes need the RAM user to have `ots:PutRow`/`UpdateRow`/`DeleteRow`** — a read-only key returns `OTSNoPermissionAccess` (ImplicitDeny) on create/edit.

**What true end-to-end needs (external secrets):** a real Microsoft Entra *consumer* OAuth app (`AUTH_MICROSOFT_ENTRA_ID_ID/SECRET`) plus the allowlisted account (`huhansen318@hotmail.com`) to sign in, and Alibaba OTS creds (`ALIBABA_CLOUD_ACCESS_KEY_ID/SECRET`, `OTS_ENDPOINT`, `OTS_INSTANCE_NAME`) for movie reads/writes. Without these you can still run/lint/build everything and exercise the authenticated UI against dummy Portfolio/Travel data.

**Commands:** `npm run dev` (port 3000, via `scripts/dev.mjs`), `npm run lint`, `npm run typecheck`, `npm run build` (static export — temporarily stashes `app/api` into `.api-stash/`), `npm run build:api` (standalone — temporarily stashes UI pages into `.ui-stash/` and writes a throwaway `pages/`). If a build is interrupted, restore stashed dirs before retrying. `npm run lint` emits non-blocking `react-hooks/exhaustive-deps` warnings in `app/movies/page.tsx`.
