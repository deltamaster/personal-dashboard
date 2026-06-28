# Terraform — Alibaba Cloud provisioning (GitHub Actions)

Provisions OTS, OSS, FC (zip / custom runtime), and (optionally) CDN. **Runs on GitHub Actions** — you do not need Terraform installed locally.

Does **not** create RAM users/roles. Uses your existing RAM user + AssumeRole.

## Region stacks

| Stack | Region | GitHub environment | State cache key | Auto on push |
|---|---|---|---|---|
| **Singapore (active)** | `ap-southeast-1` | `personal-dashboard` | `terraform-state-ap-southeast-1` | yes |
| **Shanghai (paused)** | `cn-shanghai` | `personal-dashboard` | `terraform-state-cn-shanghai` | manual only |

Both stacks use the **same** GitHub environment secrets. Singapore `auth_url` comes from `env/ap-southeast-1.tfvars`; Shanghai uses the `AUTH_URL` secret (`https://huhansen.cn`).

## FC deployment model

API runs as **FC Custom Runtime** — no ACR or Docker required:

1. **Deploy API** builds Next.js standalone → zips → uploads to private OSS (`fc/api.zip` in vault bucket)
2. FC pulls code from OSS and runs `node server.js` on port 9000

This avoids the Personal Edition ACR limit (one instance per account) and works identically in both regions.

## 1. GitHub secrets

Add these to the **`personal-dashboard`** environment:

| Secret | Description |
|---|---|
| `ALIBABA_CLOUD_*`, `ALIBABA_CLOUD_ROLE_ARN` | RAM user + provision role |
| `AUTH_*` | Auth.js + Azure OAuth |
| `AUTH_URL` | Shanghai only — `https://huhansen.cn` (cn-shanghai Terraform apply) |

## 2. Run provisioning

**Singapore:** push changes under `terraform/` to `main`, or  
**Actions → Terraform → stack `ap-southeast-1` → apply**

**Shanghai:** **Actions → Terraform → stack `cn-shanghai` → apply** (manual only)

After first apply:

1. Copy `fc_http_trigger_url` from workflow output
2. Update `auth_url` in `env/ap-southeast-1.tfvars` (Singapore) or keep `AUTH_URL` secret (Shanghai)
3. Re-run Terraform apply if auth env changed
4. Run **Deploy API** then **Deploy Web**

## 3. CDN (Shanghai only, after ICP)

When `huhansen.cn` is ready: CDN console → origin OSS web bucket, path `/api/*` → FC trigger, HTTPS + CNAME.

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
