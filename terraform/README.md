# Terraform — Alibaba Cloud provisioning (GitHub Actions)

Provisions OTS, OSS, FC (zip / custom runtime), and (optionally) CDN. **Runs on GitHub Actions** — you do not need Terraform installed locally.

Does **not** create RAM users/roles. Uses your existing RAM user + AssumeRole.

**Cost:** all Terraform resources must comply with [AGENTS.md § Cost control](../AGENTS.md#cost-control-principles) — prefer pay-per-use; never add reserved CU, search indexes, or `minInstances > 0` without documented justification.

## Region stacks

| Stack | Region | GitHub environment | State cache key | Auto on push |
|---|---|---|---|---|
| **Shanghai (prod)** | `cn-shanghai` | `personal-dashboard` | `terraform-state-cn-shanghai` | yes (`main`) |
| **QA** | `ap-southeast-1` | `personal-dashboard` | `terraform-state-qa-hosted` | yes (non-`main`) |

Both stacks use the **same** GitHub environment secrets. `auth_url` / `domain` come from per-stack tfvars (`pd.huhansen.cn` / `pd-qa.huhansen.com`).

| Stack | Subdomain | CDN scope |
|---|---|---|
| Shanghai prod | `pd.huhansen.cn` | `domestic` (ICP required) |
| QA | `pd-qa.huhansen.com` | `overseas` (no ICP) |

## QA stack — full hosted clone (`env/qa.tfvars`)

QA is a **hosted clone of prod** on the same Terraform root (not a separate root): static frontend on OSS + **FC API** + CDN at `pd-qa.huhansen.com`, with **Microsoft auth enforced** (no bypass). It reuses all prod FC/CDN logic; only the names/domain differ.

| Resource | QA name |
|---|---|
| OTS | `pd-dash-qa` (+ 7 tables, no search indexes) |
| OSS | `pd-web-qa` (public static + photos), `pd-vault-qa` (private; holds `fc/api-qa.zip`) |
| FC v3 | `api-qa` + HTTP trigger + custom domain `api.pd-qa.huhansen.com` |
| CDN | `pd-qa.huhansen.com` → `/*` web bucket, `/api/*` → FC |

State key: **`terraform-state-qa-hosted`** (distinct from the retired data-only root). **Push to any non-`main` branch** that touches `terraform/**` runs **Terraform → apply** on QA automatically (same as Deploy API/Web). Manual override: **Actions → Terraform → stack `qa`**. The apply job runs `scripts/import-existing.sh` first (`FC_FUNCTION=api-qa`, `CDN_DOMAIN=pd-qa.huhansen.com`) so the OTS instance / buckets / CDN domain already created earlier are **adopted**, then reconfigured (CDN origin → web bucket + `/api/*` rules).

> ⚠️ Review the **plan** before apply — confirm it shows adopt/update, not destroy of `pd-dash-qa` (QA data).

Then deploy + DNS (same pattern as prod, just `pd-qa`):
1. **Push to any non-`main` branch** (or **Actions → Deploy API → stack `qa`**) — builds + ships the API to `api-qa`.
2. Same for **Deploy Web** — non-`main` pushes target `pd-web-qa` and purge CDN. **`main` pushes deploy Shanghai prod (`cn-shanghai`).**
3. Cloudflare: `CNAME pd-qa → <cdn_cname output>` and DNS-only `CNAME api.pd-qa → {account_id}.ap-southeast-1.fc.aliyuncs.com`.
4. Azure: add redirect URI `https://pd-qa.huhansen.com/api/auth/callback/microsoft-entra-id`.

Photos are uploaded server-side by `api-qa` to `pd-web-qa` and served at `https://pd-qa.huhansen.com/travel/images/...` (the FC env sets `OSS_MEDIA_BUCKET=pd-web-qa`). No `MEDIA_PUBLIC_BASE_URL` needed (it falls back to `AUTH_URL`).

## FC deployment model

API runs as **FC Custom Runtime** — no ACR or Docker required. **CDN** (when `create_cdn_domain = true`) is managed in Terraform:

| Path | Origin |
|---|---|
| `/*` (default) | OSS web bucket |
| `/api/*` | FC HTTP trigger (`advanced_origin`) |

Both prod and QA use `create_cdn_domain = true` (`env/cn-shanghai.tfvars`, `env/qa.tfvars`). If you already created the domain in the console, the import script adopts it before apply.

**Shanghai FC runtime migration:** if an old `custom-container` function exists, `import-existing.sh` deletes it via **AssumeRole** (raw RAM user lacks `fc:DeleteFunction`), clears Terraform state, and skips re-import so apply creates `custom.debian10` zip runtime. Do not re-import the legacy function manually.

## 1. GitHub secrets

Add these to the **`personal-dashboard`** environment:

| Secret | Description |
|---|---|
| `ALIBABA_CLOUD_*`, `ALIBABA_CLOUD_ROLE_ARN` | RAM user (AssumeRole only) + `resourceadmin` role — used by Terraform, FC runtime, and local `.env.local` |
| `AUTH_*` | Auth.js + Azure OAuth |
| `AUTH_URL` | Shanghai prod — `https://pd.huhansen.cn` (overrides tfvars on cn-shanghai apply) |

## 2. Run provisioning

**Branch routing (same as Deploy API/Web):**

| Trigger | Terraform targets |
|---|---|
| **Push to `main`** (`terraform/**`) | `cn-shanghai` (apply) |
| **Push to other branches** (`terraform/**`) | `qa` (apply) |
| **Pull request** | `cn-shanghai` (plan only) |
| **workflow_dispatch** | Pick stack (`cn-shanghai` or `qa`) + plan or apply |

**Shanghai prod:** push changes under `terraform/` to `main`, or  
**Actions → Terraform → pick stack → plan/apply** (single stack)

After first apply:

1. Copy `fc_http_trigger_url` from workflow output
2. Keep `AUTH_URL` secret as `https://pd.huhansen.cn` (Shanghai)
3. Re-run Terraform apply if auth env changed
4. Run **Deploy API** then **Deploy Web**

## 3. CDN + DNS

Terraform manages CDN when `create_cdn_domain = true`. After apply, copy output `cdn_cname` to DNS.

### Shanghai prod — `pd.huhansen.cn` (Alibaba DNS, ICP complete)

**Before first CDN apply:** verify root domain `huhansen.cn` in CDN (one-time). CI runs `scripts/cdn-verify-root-domain.sh`; if verification fails, Terraform still applies OTS/OSS/FC but skips CDN (`create_cdn_domain=false`).

Add this TXT record in **Alibaba Cloud DNS** for `huhansen.cn`:

| 类型 | 主机记录 | 记录值 |
|---|---|---|
| TXT | `verification` | output of `aliyun cdn DescribeVerifyContent --DomainName huhansen.cn` |

Wait ~10 minutes, then re-run **Terraform apply**. After verification succeeds, CDN + path rules are created automatically.

1. **Terraform apply** (stack `cn-shanghai`) creates/updates CDN + OSS/FC routing
2. In **Alibaba Cloud DNS** for `huhansen.cn` (no Cloudflare needed):

| 类型 | 主机记录 | 目标 |
|---|---|---|
| CNAME | `pd` | Terraform output `cdn_cname` |
| CNAME | `api.pd` | Terraform output `fc_custom_domain_cname` (`1197388755513152.cn-shanghai.fc.aliyuncs.com`) |

> **Order:** add the `api.pd` CNAME **before** Terraform binds the FC custom domain (`DomainNameNotResolved` if missing). CI skips `create_fc_custom_domain` until DNS resolves, then re-apply to bind OAuth/CDN `/api/*` routing.

3. Azure redirect URI: `https://pd.huhansen.cn/api/auth/callback/microsoft-entra-id`

**HTTPS:** `env/cn-shanghai.tfvars` sets `cdn_https_enabled = true` and `cdn_cas_cert_id` to the CAS **CertificateId** (numeric — not the `cas_dv-cn-…` InstanceId). Terraform attaches the cert via `certificate_config` (`cert_type = cas`, `cert_region = cn-hangzhou`) and enables HTTP→HTTPS redirect (`https_force`). Order/renew the cert in the CAS console; update `cdn_cas_cert_id` when it changes.

**TLS policy:** Terraform sets CDN `https_tls_version` on HTTPS domains (`cdn_tls.tf`): TLS 1.0/1.1 off, TLS 1.2/1.3 on, `ciphersuitegroup = strict` (Enhanced cipher suite). Applies to `pd.huhansen.cn` and `www.huhansen.cn` when HTTPS is active.

Optional: `scripts/cdn-ensure-cas-cert.sh` can order a free DV cert locally/CI if you leave `cdn_cas_cert_id` empty — not used in the default Shanghai workflow.

CDN scope: **仅中国内地**. Static origin: `huhansen-web.oss-cn-shanghai.aliyuncs.com`.

### Public personal site — `www.huhansen.cn`

Static cyberpunk intro page (no API). Source: `public-site/` → OSS `huhansen-www` → CDN `www.huhansen.cn`.

1. **Terraform apply** (stack `cn-shanghai`, `create_www_site = true` in tfvars) creates bucket + CDN
2. Alibaba DNS for `huhansen.cn`:

| 类型 | 主机记录 | 目标 |
|---|---|---|
| CNAME | `www` | Terraform output `www_cdn_cname` |

3. **HTTPS:** order a CAS DV cert for `www.huhansen.cn` (`CDN_DOMAIN=www.huhansen.cn bash scripts/cdn-ensure-cas-cert.sh`), set `www_cdn_cas_cert_id` in `env/cn-shanghai.tfvars`, re-apply
4. **Deploy:** push changes under `public-site/` or run **Actions → Deploy Public Site**

**CDN cache (`cdn_cache.tf` + deploy workflows):**

| Asset | CDN edge TTL | OSS `Cache-Control` |
|---|---|---|
| `.html` | 1 second (deploy also purges CDN) | `max-age=0, must-revalidate` |
| `.css`, `.js`, images, fonts | 30 days | `max-age=2592000` |
| `robots.txt`, `sitemap.xml` | 1 hour | `max-age=3600` |

Dashboard (`pd.huhansen.cn`) uses the same static-asset CDN rules; Next.js hashed files under `_next/static/` get `immutable` + 1 year at upload.

Footer displays ICP: 沪ICP备2026030261号-1

## FC custom domain state (all stacks)

`terraform/moved.tf` records the `api` → `api[0]` address change when `create_fc_custom_domain` gained `count`. **Before every apply**, `scripts/import-existing.sh` runs `reconcile_fc_custom_domain_state`:

| Situation | Action |
|---|---|
| Both `api` and `api[0]` in state | **state rm** legacy `api` only (does not touch cloud) |
| Only legacy `api` in state | **state mv** → `api[0]` |
| Domain missing in FC but still in state | **state rm** so next apply **creates** it |
| Domain exists in FC, not in state | import into `api[0]` |

Without this, a cached pre-`count` state causes Terraform to **destroy** the live `api.{domain}` when removing the orphan — the QA failure mode in Jul 2026.

## OTS (no search indexes)

Terraform provisions **7 data tables only** (`terraform/ots.tf`). We intentionally do **not** create Tablestore **多元索引** (search indexes).

| Reason | Detail |
|---|---|
| App queries | API uses `GetRange` scans; UI search/filter is client-side — SearchIndex APIs are unused |
| Billing | Each index on a 高性能型 instance accrues automatic **预留读能力** on the `#search_index` billing line (~¥5–6 per instance every few days in 2026), while actual 按量读/写 CU stayed within the free tier |
| Data safety | Removing indexes does **not** delete table rows |

**Apply to drop existing indexes:** merge to `main` applies Shanghai prod; push to any other branch applies QA first (see [terraform/README § Branch routing](./README.md#2-run-provisioning)). Review the plan — expect `destroy` on six `alicloud_ots_search_index` resources per stack that still has them in state. If indexes were created outside Terraform, delete in the [OTS console](https://otsnext.console.aliyun.com/) (数据表 → 索引管理).

Previously removed indexes: `idx_holdings`, `idx_visits`, `idx_flights`, `idx_trains`, `idx_movies`, `idx_visit_images`. Re-add only when implementing server-side filtered queries (see [TECHNICAL_SPEC.md § Query strategy](../TECHNICAL_SPEC.md#query-strategy--no-search-indexes)).

## What gets created

### Shanghai prod (`env/cn-shanghai.tfvars`)

| Resource | Name |
|---|---|
| OTS | `pd-dashboard` (7 tables, no search indexes) |
| OSS | `huhansen-web`, `personal-dashboard-vault` |
| OSS (public site) | `huhansen-www` → CDN `www.huhansen.cn` |
| FC v3 | `api` |

## Local Terraform (optional)

```bash
cd terraform
terraform init
terraform apply -var-file=env/cn-shanghai.tfvars
```

Copy `terraform.tfvars.example` for local credentials (gitignored).
