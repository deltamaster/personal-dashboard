# Deployment Runbook

Alibaba Cloud provisioning and deploy steps. Constants and env vars: [AGENTS.md](../AGENTS.md). Table/index definitions: [TECHNICAL_SPEC.md](../TECHNICAL_SPEC.md).

**Preferred:** [terraform/README.md](../terraform/README.md) — OTS, OSS, FC, CDN via GitHub Actions **Terraform** workflow. RAM user + role are **not** created by Terraform (use existing credentials + AssumeRole).

| Stack | Region | Domain | Terraform | Deploy on `main` push |
|---|---|---|---|---|
| Singapore (overseas) | `ap-southeast-1` | `pd.huhansen.com` | yes | yes |
| Shanghai (mainland) | `cn-shanghai` | `pd.huhansen.cn` | yes | yes |
| QA (Singapore only) | `ap-southeast-1` | `pd-qa.huhansen.com` | manual | other branches only |

---

## 1. Provision (one-time)

Run **Actions → Terraform → apply** for the target stack. Shanghai requires ICP on `huhansen.cn` before CDN (`cdn_scope = domestic`).

After first apply:

1. Add DNS records (Cloudflare for `.com`, Alibaba DNS for `.cn` — see [terraform/README.md § CDN + DNS](../terraform/README.md))
2. Add Azure redirect URI for the stack subdomain
3. Run **Deploy API** then **Deploy Web** for that stack

---

## 2. Deploy

**Push to `main`:** **Deploy Web** and **Deploy API** run automatically in parallel for Singapore and Shanghai (matrix). Non-`main` branches deploy QA only. Manual runs: pick a single stack in workflow_dispatch.

| Artifact | Build | Destination |
|---|---|---|
| Static UI | `npm run build` → `out/` | OSS web bucket |
| API | `npm run build:api` → `api.zip` | OSS vault → FC custom runtime |

---

## 3. Verify

| Check | Expected |
|---|---|
| `https://pd.huhansen.com/` or `https://pd.huhansen.cn/` | Static shell loads |
| `/auth/signin` | Microsoft button |
| Sign in as allowlisted email | Dashboard + session cookie |
| Sign in as other account | `/auth/error` |
| `GET /api/portfolio/holdings` without cookie | 401 |
| Same with session | 200 JSON |
| Vault object URL without signature | 403 |
| Web bucket JS/CSS URL | 200 public |

---

## 4. Cost (single user, light use)

≈ **¥10–30/month** per stack — mostly OSS storage + CDN. FC ≈ ¥0 at this traffic. No hourly compute charges (`minInstances: 0`).

---

## 5. Migration

Deferred. See [TECHNICAL_SPEC.md § Migration](../TECHNICAL_SPEC.md#migration-deferred).
