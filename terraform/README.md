# Terraform — Alibaba Cloud provisioning (GitHub Actions)

Provisions OTS, OSS, FC (zip / custom runtime), and (optionally) CDN. **Runs on GitHub Actions** — you do not need Terraform installed locally.

Does **not** create RAM users/roles. Uses your existing RAM user + AssumeRole.

## Region stacks

| Stack | Region | GitHub environment | State cache key | Auto on push |
|---|---|---|---|---|
| **Singapore (overseas prod)** | `ap-southeast-1` | `personal-dashboard` | `terraform-state-ap-southeast-1` | yes |
| **Shanghai (mainland prod)** | `cn-shanghai` | `personal-dashboard` | `terraform-state-cn-shanghai` | yes |

Both stacks use the **same** GitHub environment secrets. `auth_url` / `domain` come from per-stack tfvars (`pd.huhansen.com` / `pd.huhansen.cn`).

| Stack | Subdomain | CDN scope |
|---|---|---|
| Singapore | `pd.huhansen.com` | `overseas` (no ICP) |
| Shanghai | `pd.huhansen.cn` | `domestic` (ICP required) |

## QA stack — full hosted clone (`env/qa.tfvars`)

QA is a **third stack on this same root** (not a separate root): static frontend on OSS + **FC API** + CDN at `pd-qa.huhansen.com`, with **Microsoft auth enforced** (no bypass). It reuses all prod FC/CDN logic; only the names/domain differ.

| Resource | QA name |
|---|---|
| OTS | `pd-dash-qa` (+ tables + indexes) |
| OSS | `pd-web-qa` (public static + photos), `pd-vault-qa` (private; holds `fc/api-qa.zip`) |
| FC v3 | `api-qa` + HTTP trigger + custom domain `api.pd-qa.huhansen.com` |
| CDN | `pd-qa.huhansen.com` → `/*` web bucket, `/api/*` → FC |

State key: **`terraform-state-qa-hosted`** (distinct from the retired data-only root). Run via **Actions → Terraform → stack `qa` → action `plan`/`apply`** (manual only). The apply job runs `scripts/import-existing.sh` first (`FC_FUNCTION=api-qa`, `CDN_DOMAIN=pd-qa.huhansen.com`) so the OTS instance / buckets / CDN domain already created earlier are **adopted**, then reconfigured (CDN origin → web bucket + `/api/*` rules).

> ⚠️ Review the **plan** before apply — confirm it shows adopt/update, not destroy of `pd-dash-qa` (QA data).

Then deploy + DNS (same pattern as prod, just `pd-qa`):
1. **Push to any non-`main` branch** (or **Actions → Deploy API → stack `qa`**) — builds + ships the API to `api-qa`.
2. Same for **Deploy Web** — non-`main` pushes target `pd-web-qa` and purge CDN. **`main` pushes deploy both prod stacks (`ap-southeast-1` + `cn-shanghai`) in parallel.**
3. Cloudflare: `CNAME pd-qa → <cdn_cname output>` and DNS-only `CNAME api.pd-qa → {account_id}.ap-southeast-1.fc.aliyuncs.com`.
4. Azure: add redirect URI `https://pd-qa.huhansen.com/api/auth/callback/microsoft-entra-id`.

Photos are uploaded server-side by `api-qa` to `pd-web-qa` and served at `https://pd-qa.huhansen.com/travel/images/...` (the FC env sets `OSS_MEDIA_BUCKET=pd-web-qa`). No `MEDIA_PUBLIC_BASE_URL` needed (it falls back to `AUTH_URL`).

## FC deployment model

API runs as **FC Custom Runtime** — no ACR or Docker required. **CDN** (when `create_cdn_domain = true`) is managed in Terraform:

| Path | Origin |
|---|---|
| `/*` (default) | OSS web bucket |
| `/api/*` | FC HTTP trigger (`advanced_origin`) |

Both prod stacks use `create_cdn_domain = true` (`env/ap-southeast-1.tfvars`, `env/cn-shanghai.tfvars`). If you already created the domain in the console, the import script adopts it before apply.

**Shanghai FC runtime migration:** if an old `custom-container` function exists, `import-existing.sh` deletes it via **AssumeRole** (raw RAM user lacks `fc:DeleteFunction`), clears Terraform state, and skips re-import so apply creates `custom.debian10` zip runtime. Do not re-import the legacy function manually.

## 1. GitHub secrets

Add these to the **`personal-dashboard`** environment:

| Secret | Description |
|---|---|
| `ALIBABA_CLOUD_*`, `ALIBABA_CLOUD_ROLE_ARN` | RAM user (AssumeRole only) + `resourceadmin` role — used by Terraform, FC runtime, and local `.env.local` |
| `AUTH_*` | Auth.js + Azure OAuth |
| `AUTH_URL` | Shanghai only — `https://pd.huhansen.cn` (overrides tfvars on cn-shanghai apply) |

## 2. Run provisioning

**Singapore + Shanghai:** push changes under `terraform/` to `main` (both stacks apply in parallel), or  
**Actions → Terraform → pick stack → plan/apply** (single stack)

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

### Shanghai — `pd.huhansen.cn` (Alibaba DNS, ICP complete)

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

Optional: `scripts/cdn-ensure-cas-cert.sh` can order a free DV cert locally/CI if you leave `cdn_cas_cert_id` empty — not used in the default Shanghai workflow.

CDN scope: **仅中国内地**. Static origin: `huhansen-web.oss-cn-shanghai.aliyuncs.com`.

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
