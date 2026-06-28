# Terraform — Alibaba Cloud provisioning (GitHub Actions)

Provisions OTS, OSS, FC, and (optionally) CDN. **Runs on GitHub Actions** — you do not need Terraform installed locally.

Does **not** create RAM users/roles. Uses your existing RAM user + AssumeRole.

## Region stacks

| Stack | Region | GitHub environment | State cache key | Auto on push |
|---|---|---|---|---|
| **Singapore (active)** | `ap-southeast-1` | `personal-dashboard-sg` | `terraform-state-ap-southeast-1` | yes |
| **Shanghai (paused)** | `cn-shanghai` | `personal-dashboard` | `terraform-state-cn-shanghai` | manual only |

Per-stack settings live in `env/ap-southeast-1.tfvars` and `env/cn-shanghai.tfvars`.

Shanghai stays provisioned for production (`huhansen.cn`) once ICP filing completes. Until then, use Singapore.

## 1. GitHub secrets

Create **two** environments and copy the same secrets into each, except where noted:

### `personal-dashboard-sg` (Singapore — active)

| Secret | Value |
|---|---|
| `ALIBABA_CLOUD_*`, `ALIBABA_CLOUD_ROLE_ARN` | Same RAM user + role (must allow `ap-southeast-1`) |
| `ACR_REGISTRY` | Singapore Personal Edition login server, e.g. `crpi-xxxxx.ap-southeast-1.personal.cr.aliyuncs.com` |
| `ACR_USERNAME` / `ACR_PASSWORD` | Singapore ACR credentials |
| `AUTH_*` | Same Azure / Auth.js secrets |
| `AUTH_URL` | FC HTTP trigger URL after first apply, e.g. `https://api-xxxxx.ap-southeast-1.fcapp.run` |

### `personal-dashboard` (Shanghai — manual apply only)

Same secrets as above, but Shanghai `ACR_REGISTRY` and `AUTH_URL=https://huhansen.cn`.

**Terraform state** is stored in GitHub Actions cache (separate key per stack). Each apply also uploads a state backup artifact.

## 2. One-time: ACR (Personal Edition)

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
