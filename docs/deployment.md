# Deployment Runbook

Alibaba Cloud provisioning and deploy steps. Constants and env vars: [AGENTS.md](../AGENTS.md). OTS table schemas: [TECHNICAL_SPEC.md](../TECHNICAL_SPEC.md).

**Preferred:** [terraform/README.md](../terraform/README.md) — OTS, OSS, FC, CDN via GitHub Actions **Terraform** workflow. RAM user + role are **not** created by Terraform (use existing credentials + AssumeRole).

| Stack | Region | Domain | Terraform | Deploy on `main` push |
|---|---|---|---|---|
| Shanghai (prod) | `cn-shanghai` | `pd.huhansen.cn` | yes | yes |
| QA | `ap-southeast-1` | `pd-qa.huhansen.com` | auto on non-`main` push | other branches only |

---

## 1. Provision (one-time)

Run **Actions → Terraform → apply** for the target stack. Shanghai requires ICP on `huhansen.cn` before CDN (`cdn_scope = domestic`).

After first apply:

1. Add DNS records (Alibaba DNS for `.cn` — see [terraform/README.md § CDN + DNS](../terraform/README.md))
2. Add Azure redirect URI for the stack subdomain
3. Run **Deploy API** then **Deploy Web** for that stack

**Retired SG prod (`pd.huhansen.com`):** removed Jul 2026. One-off teardown script: `scripts/destroy-sg-prod.sh` (requires AssumeRole). Remove Azure redirect URI and Cloudflare DNS for `pd.huhansen.com` manually.

---

## 2. Deploy

**Push to `main`:** **Deploy Web** and **Deploy API** run automatically for Shanghai prod. Non-`main` branches deploy QA only. Manual runs: pick a single stack in workflow_dispatch.

| Artifact | Build | Destination |
|---|---|---|
| Static UI | `npm run build` → `out/` | OSS web bucket |
| Public site | `public-site/` (static HTML) | OSS `huhansen-www` → `www.huhansen.cn` |
| API | `npm run build:api` → `api.zip` | OSS vault → FC custom runtime |

**Public site (`www.huhansen.cn`):** provision via Terraform (Shanghai stack, `create_www_site = true`). Deploy with **Actions → Deploy Public Site** or push changes under `public-site/`. DNS: CNAME `www` → Terraform output `www_cdn_cname`. Hero layout/typography constraints: [public-site/LAYOUT.md](../public-site/LAYOUT.md).

---

## 3. Verify

| Check | Expected |
|---|---|
| `https://pd.huhansen.cn/` | Static shell loads |
| `/auth/signin` | Microsoft button |
| Sign in as allowlisted email | Dashboard + session cookie |
| Sign in as other account | `/auth/error` |
| `GET /api/portfolio/holdings` without cookie | 401 |
| Same with session | 200 JSON |
| Vault object URL without signature | 403 |
| Web bucket JS/CSS URL | 200 public |

---

## 4. Cost (single user, light use)

Principles (avoid hourly/reserved billing): [AGENTS.md § Cost control](../AGENTS.md#cost-control-principles).

≈ **¥10–30/month** per stack when following those rules — mostly OSS storage + CDN egress. FC ≈ ¥0 at this traffic. **No** FC provisioned instances, **no** OTS search indexes or reserved CU.

Watch for bill lines that charge while idle: OTS `#search_index` **预留读能力**, FC **预留实例**, NAT/SLB hourly fees.

---

## 5. Migration

Deferred. See [TECHNICAL_SPEC.md § Migration](../TECHNICAL_SPEC.md#migration-deferred).
