# Terraform — Alibaba Cloud provisioning (GitHub Actions)

Provisions OTS, OSS, FC, and (optionally) CDN. **Runs on GitHub Actions** — you do not need Terraform installed locally.

Does **not** create RAM users/roles. Uses your existing RAM user + AssumeRole.

## Region stacks

| Stack | Region | GitHub environment | State cache key | Auto on push |
|---|---|---|---|---|
| **Singapore (active)** | `ap-southeast-1` | `personal-dashboard` | `terraform-state-ap-southeast-1` | yes |
| **Shanghai (paused)** | `cn-shanghai` | `personal-dashboard` | `terraform-state-cn-shanghai` | manual only |

Both stacks use the **same** GitHub environment secrets. Singapore `auth_url` comes from `env/ap-southeast-1.tfvars` (update after first FC apply); Shanghai uses the `AUTH_URL` secret (`https://huhansen.cn`).

## 1. GitHub secrets

Add these to the **`personal-dashboard`** environment (shared by both stacks):

| Secret | Description |
|---|---|
| `ALIBABA_CLOUD_*`, `ALIBABA_CLOUD_ROLE_ARN` | RAM user + provision role |
| `ACR_REGISTRY` / `ACR_USERNAME` / `ACR_PASSWORD` | ACR (same registry for both stacks if cross-region pull works) |
| `AUTH_*` | Auth.js + Azure OAuth |
| `AUTH_URL` | Shanghai only — `https://huhansen.cn` (used when applying cn-shanghai stack) |

Singapore FC `auth_url` is set in `env/ap-southeast-1.tfvars` — update it to the FC trigger URL after the first Singapore apply.

Terraform **does not** create ACR. In **Container Registry console** for each region:

1. Create Personal Edition instance → copy login server to `ACR_REGISTRY`
2. Set registry login password
3. Namespace **`personal-dashboard`**, repo **`api`**

## 3. Run provisioning

**Singapore (default):** push changes under `terraform/` to `main`, or  
**Actions → Terraform → stack `ap-southeast-1` → apply**

**Shanghai:** **Actions → Terraform → stack `cn-shanghai` → apply** (not triggered on push)

After first Singapore apply:

1. Copy `fc_http_trigger_url` from workflow output
2. Set `AUTH_URL` secret on `personal-dashboard-sg` to that URL
3. Re-run Terraform apply (updates FC env)
4. Run **Deploy Web** / **Deploy API** (default to Singapore)

## 4. CDN (Shanghai only, after ICP)

When `huhansen.cn` is ready: CDN console → origin `huhansen-web.oss-cn-shanghai.aliyuncs.com`, path `/api/*` → FC trigger, HTTPS + CNAME.

Set `create_cdn_domain = true` in `env/cn-shanghai.tfvars` after domain registration if desired.

## What gets created

### Singapore (`env/ap-southeast-1.tfvars`)

| Resource | Name |
|---|---|
| OTS | `pd-dash-sg` + 7 tables + 6 indexes |
| OSS | `pd-web-sg` (public), `pd-vault-sg` (private) |
| FC v3 | `api` + HTTP trigger |
| CDN | skipped |

Static site URL (after Deploy Web): `http://pd-web-sg.oss-ap-southeast-1.aliyuncs.com`

### Shanghai (`env/cn-shanghai.tfvars`)

| Resource | Name |
|---|---|
| OTS | `pd-dashboard` |
| OSS | `huhansen-web`, `personal-dashboard-vault` |
| FC v3 | `api` |
| CDN | manual — `huhansen.cn` |

## Local Terraform (optional)

```bash
cd terraform
terraform init
terraform apply -var-file=env/ap-southeast-1.tfvars
```

Copy `terraform.tfvars.example` for local credentials (gitignored).
