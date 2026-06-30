# Terraform — Alibaba Cloud provisioning (GitHub Actions)

Provisions OTS, OSS, FC (zip / custom runtime), and (optionally) CDN. **Runs on GitHub Actions** — you do not need Terraform installed locally.

Does **not** create RAM users/roles. Uses your existing RAM user + AssumeRole.

## Region stacks

| Stack | Region | GitHub environment | State cache key | Auto on push |
|---|---|---|---|---|
| **Singapore (active)** | `ap-southeast-1` | `personal-dashboard` | `terraform-state-ap-southeast-1` | yes |
| **Shanghai (paused)** | `cn-shanghai` | `personal-dashboard` | `terraform-state-cn-shanghai` | manual only |

Both stacks use the **same** GitHub environment secrets. `auth_url` / `domain` come from per-stack tfvars (`pd.huhansen.com` / `pd.huhansen.cn`).

| Stack | Subdomain | CDN scope |
|---|---|---|
| Singapore | `pd.huhansen.com` | `overseas` (no ICP) |
| Shanghai | `pd.huhansen.cn` | `domestic` (ICP required) |

## QA / test stack (`terraform/qa/`)

A **separate root** that provisions **OTS + OSS + a media CDN** (no FC — the QA API runs locally) for an isolated test environment. It has its own state (`terraform-state-qa`) and never touches the production Singapore/Shanghai resources.

| Resource | Name (default) | ARN / notes |
|---|---|---|
| OTS | `pd-dash-qa` + 7 tables + 6 search indexes | `acs:ots:ap-southeast-1:<account>:instance/pd-dash-qa` |
| OSS | `pd-web-qa`, `pd-vault-qa` (**public-read in QA** so photos serve via CDN) | `acs:oss:*:<account>:pd-vault-qa` |
| CDN | `pd-qa.huhansen.com` → origin `pd-vault-qa` (photos) | output `cdn_cname` |

Run it: **Actions → Terraform QA → action `apply`** (uses the same `personal-dashboard` environment secrets; only needs `ALIBABA_CLOUD_*` + `ALIBABA_CLOUD_ROLE_ARN` — no Auth/FC secrets). PRs touching `terraform/qa/**` run `plan` automatically. After apply:
1. Copy output `cdn_cname` → add Cloudflare CNAME `pd-qa` → `<cdn_cname>` (**DNS only / grey cloud**).
2. Seed dummy data: `node scripts/qa-seed.mjs`.
3. In `.env.local`: point at the outputs (`OTS_ENDPOINT`, `OTS_INSTANCE_NAME`, `OSS_VAULT_BUCKET`), set `MEDIA_PUBLIC_BASE_URL=https://pd-qa.huhansen.com` (so stored photo URLs use the CDN), and `MICROSOFT_AUTH_ENABLED=false`.

> The QA photo bucket is **public-read** (CDN serves it) — a QA-only relaxation; prod keeps the vault private + presigned URLs. CDN domain creation requires verifying domain ownership in the Alibaba CDN console (a TXT record) before apply succeeds; set `create_cdn_domain = false` to provision OTS/OSS first, then enable it.

Local validate/plan (optional, read-only):

```bash
cd terraform/qa
terraform init
ALICLOUD_ACCESS_KEY=... ALICLOUD_SECRET_KEY=... TF_VAR_role_arn=acs:ram::<acct>:role/<role> \
  terraform plan -var-file=qa.tfvars
```

> The provision role needs create permissions for OTS (`ots:CreateInstance`/`CreateTable`/`CreateSearchIndex`) and OSS (`oss:PutBucket*`).

## FC deployment model

API runs as **FC Custom Runtime** — no ACR or Docker required. **CDN** (when `create_cdn_domain = true`) is managed in Terraform:

| Path | Origin |
|---|---|
| `/*` (default) | OSS web bucket |
| `/api/*` | FC HTTP trigger (`advanced_origin`) |

Singapore: `create_cdn_domain = true` in `env/ap-southeast-1.tfvars`. If you already created the domain in the console, the import script adopts it before apply.

## 1. GitHub secrets

Add these to the **`personal-dashboard`** environment:

| Secret | Description |
|---|---|
| `ALIBABA_CLOUD_*`, `ALIBABA_CLOUD_ROLE_ARN` | RAM user (AssumeRole only) + `resourceadmin` role — used by Terraform, FC runtime, and local `.env.local` |
| `AUTH_*` | Auth.js + Azure OAuth |
| `AUTH_URL` | Shanghai only — `https://pd.huhansen.cn` (overrides tfvars on cn-shanghai apply) |

## 2. Run provisioning

**Singapore:** push changes under `terraform/` to `main`, or  
**Actions → Terraform → stack `ap-southeast-1` → apply**

**Shanghai:** **Actions → Terraform → stack `cn-shanghai` → apply** (manual only)

After first apply:

1. Copy `fc_http_trigger_url` from workflow output
2. Update `auth_url` in `env/ap-southeast-1.tfvars` (Singapore) or keep `AUTH_URL` secret (Shanghai)
3. Re-run Terraform apply if auth env changed
4. Run **Deploy API** then **Deploy Web**

## 3. CDN + DNS

Terraform manages CDN when `create_cdn_domain = true` (Singapore: enabled). After apply, copy output `cdn_cname` to Cloudflare.

### Singapore — `pd.huhansen.com` (Cloudflare)

1. **Terraform apply** creates/updates CDN + OSS/FC routing (or imports existing domain)
2. Cloudflare DNS (**灰云 / DNS only**):

| 类型 | 名称 | 目标 |
|---|---|---|
| CNAME | `pd` | Terraform output `cdn_cname` |

3. Azure redirect URI: `https://pd.huhansen.com/api/auth/callback/microsoft-entra-id`

If the domain already exists in the CDN console, the import step adopts it — no need to delete first.

### Shanghai — `pd.huhansen.cn` (after ICP)

Same pattern with scope **仅中国内地**, origin `huhansen-web.oss-cn-shanghai.aliyuncs.com`, DNS CNAME `pd` → CDN CNAME.

## What gets created

### Singapore (`env/ap-southeast-1.tfvars`)

| Resource | Name |
|---|---|
| OTS | `pd-dash-sg` + tables + indexes |
| OSS | `pd-web-sg` (public), `pd-vault-sg` (private, holds `fc/api.zip`) |
| FC v3 | `api` custom runtime + HTTP trigger |

### Shanghai (`env/cn-shanghai.tfvars`)

| Resource | Name |
|---|---|
| OTS | `pd-dashboard` |
| OSS | `huhansen-web`, `personal-dashboard-vault` |
| FC v3 | `api` |

## Local Terraform (optional)

```bash
cd terraform
terraform init
terraform apply -var-file=env/ap-southeast-1.tfvars
```

Copy `terraform.tfvars.example` for local credentials (gitignored).
