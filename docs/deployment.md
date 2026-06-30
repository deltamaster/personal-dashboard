# Deployment Runbook

Alibaba Cloud provisioning and deploy steps. **Not executed yet.**

Constants and env vars: [AGENTS.md](../AGENTS.md). Table/index definitions: [TECHNICAL_SPEC.md](../TECHNICAL_SPEC.md).

---

## 1. Provision (one-time)

**Preferred:** [terraform/README.md](../terraform/README.md) — OTS, OSS, ACR, FC, CDN via `terraform apply`.  
RAM user + role are **not** created by Terraform (use existing credentials + AssumeRole).

Manual checklist (if not using Terraform):

### OTS

Instance `pd-dashboard` in cn-shanghai. Create 7 tables (PKs in spec). Create search indexes. Launch empty.

### OSS `huhansen-web` (public)

Static website hosting enabled. Public read policy. Holds Next.js `out/` only — no user data.

### OSS `personal-dashboard-vault` (private)

Block all public access. Prefixes: `travel_images/`, `portfolio_statements/`. CORS: allow `PUT` from `https://huhansen.cn`.

### CDN `huhansen.cn`

Domain already registered with Alibaba.


| Path     | Origin                                      |
| -------- | ------------------------------------------- |
| `/api/*` | FC HTTP trigger                             |
| `/*`     | `huhansen-web.oss-cn-shanghai.aliyuncs.com` |


Cache: long TTL on hashed static assets; no cache on `/api/*`; short/no cache on HTML. Enable HTTPS. Point DNS to CDN CNAME.

### ACR + FC

- ACR namespace `personal-dashboard`, image `api:latest`
- FC v3 function `api`, custom container, port 3000, 512 MB
- **`minInstances: 0`** — required
- HTTP trigger → CDN `/api/*` origin
- FC env vars: see [AGENTS.md § Environment variables](../AGENTS.md#environment-variables). Set `AUTH_URL=https://huhansen.cn`. FC uses the same `ALIBABA_CLOUD_ROLE_ARN` AssumeRole flow as local dev (`ALIBABA_CLOUD_*` base AK + `resourceadmin` role); Terraform `fc_env` and **Deploy API** workflow both sync these vars.

---

## 2. Deploy

### Static UI → OSS

```bash
npm run build
ossutil cp -r out/ oss://huhansen-web/ --update
# optional: CDN purge /*.html
```

### API → FC

```bash
npm run build:api
docker build -t <acr>/personal-dashboard/api:latest .
docker push <acr>/personal-dashboard/api:latest
# update FC function to new image
```

### CI/CD (planned, push to `main`)

1. Lint + type-check
2. Job `deploy-static`: build → ossutil sync
3. Job `deploy-api`: docker build → push ACR → update FC

GitHub secrets: `ALIBABA_CLOUD_ACCESS_KEY_ID`, `ALIBABA_CLOUD_ACCESS_KEY_SECRET`, ACR credentials.

---

## 3. Verify


| Check                                        | Expected                                    |
| -------------------------------------------- | ------------------------------------------- |
| `https://huhansen.cn/`                       | Static shell loads                          |
| `/auth/signin`                               | Microsoft button                            |
| Sign in as allowlisted email                 | Dashboard + session cookie on `huhansen.cn` |
| Sign in as other account                     | `/auth/error`                               |
| `GET /api/portfolio/holdings` without cookie | 401                                         |
| Same with session                            | 200 JSON                                    |
| Vault object URL without signature           | 403                                         |
| Web bucket JS/CSS URL                        | 200 public                                  |


---

## 4. Cost (single user, light use)

≈ **¥10–30/month** — mostly OSS storage + CDN. FC ≈ ¥0 at this traffic. No hourly compute charges.

---

## 5. Migration

Deferred. See [TECHNICAL_SPEC.md § Migration](../TECHNICAL_SPEC.md#migration-deferred).