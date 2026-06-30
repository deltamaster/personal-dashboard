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
| Region | `cn-shanghai` (all services same region) |
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

OTS_INSTANCE= pd-dashboard
OTS_ENDPOINT= https://pd-dashboard.cn-shanghai.ots.aliyuncs.com

OSS_WEB_BUCKET= huhansen-web          # public static site
OSS_VAULT_BUCKET= personal-dashboard-vault  # private media
OSS_REGION= oss-cn-shanghai

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
ALIBABA_CLOUD_REGION=cn-shanghai

# OTS
OTS_ENDPOINT=https://pd-dashboard.cn-shanghai.ots.aliyuncs.com
OTS_INSTANCE_NAME=pd-dashboard

# OSS
OSS_WEB_BUCKET=huhansen-web
OSS_WEB_REGION=oss-cn-shanghai
OSS_VAULT_BUCKET=personal-dashboard-vault
OSS_VAULT_REGION=oss-cn-shanghai
OSS_VAULT_ENDPOINT=oss-cn-shanghai.aliyuncs.com
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
