# Terraform — Alibaba Cloud provisioning (GitHub Actions)

Provisions OTS, OSS, ACR, FC, and CDN. **Runs on GitHub Actions** — you do not need Terraform installed locally.

Does **not** create RAM users/roles. Uses your existing RAM user + AssumeRole.

## 1. GitHub secrets

Add these as **environment secrets** on the `personal-dashboard` environment  
(Settings → Environments → personal-dashboard → Environment secrets).

Repository secrets also work, but environment secrets are preferred.

| Secret | Required | Description |
|---|---|---|
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | yes | RAM user AccessKey |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | yes | RAM user secret |
| `ALIBABA_CLOUD_ROLE_ARN` | yes | Role ARN to assume, e.g. `acs:ram::1234567890123456:role/YourRole` |
| `ACR_REGISTRY` | yes | ACR login server from console, e.g. `crpi-xxxxx.cn-shanghai.personal.cr.aliyuncs.com` |
| `ACR_USERNAME` | yes | ACR login username |
| `ACR_PASSWORD` | yes | ACR login password |
| `AUTH_SECRET` | yes | Same as production Auth.js secret |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | yes | Azure app client ID |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | yes | Azure app client secret |

Also set deploy secrets (`OSS_ENDPOINT`, `OSS_WEB_BUCKET`, `FC_REGION`, `FC_FUNCTION`) — see [SETUP.md](../docs/SETUP.md).

Your RAM user needs `sts:AssumeRole` on the provision role. Terraform uses the role via the Alicloud provider `assume_role` block.

**Terraform state** is stored in GitHub Actions cache (not OSS). Each apply also uploads a state backup artifact. This avoids OSS `UserDisable` errors on accounts where programmatic OSS API access is restricted.

## 2. One-time: ACR (Personal Edition)

Terraform **does not** create ACR resources — Personal Edition (`crpi-*.personal.cr.aliyuncs.com`) rejects the legacy Terraform CR API with `user jurisdiction error`.

In **Container Registry console** (cn-shanghai):

1. Create Personal Edition instance if needed → copy login server to `ACR_REGISTRY`
2. Set a **registry login password** (ACR → instance → access credentials)
3. Create namespace: **`personal-dashboard`** (exact name)
4. Create repository: **`api`** (private) inside that namespace

Push fails with `denied` if either is missing or names differ from the above.

Then add `ACR_USERNAME` / `ACR_PASSWORD` to GitHub environment secrets.

## 3. Run provisioning

**Actions → Terraform → Run workflow → apply**

Or push changes under `terraform/` to `main` (auto-applies).

On first run the workflow will:

1. Import the OTS instance if it already exists but is missing from state
2. Push a placeholder `nginx:alpine` image to ACR (namespace/repo must exist — see step 2)
3. Apply OTS tables/indexes, FC v3, and related resources
4. Save Terraform state to GitHub Actions cache

**OSS buckets** and **CDN domain** are **not** created by Terraform by default (this account returns `UserDisable` on OSS API and CDN requires domain registration). Create them manually — see sections 4 and 5 below.

## 4. One-time: OSS buckets (console)

Create in **OSS console** (cn-shanghai):

| Bucket | ACL | Settings |
|---|---|---|
| `huhansen-web` | Public read | Static website: index `index.html`, error `404.html` |
| `personal-dashboard-vault` | Private | CORS: allow `PUT`/`GET`/`HEAD` from `https://huhansen.cn` |

To let Terraform manage buckets instead (if your account allows OSS API), set `create_oss_buckets = true` in a `.tfvars` file or `TF_VAR_create_oss_buckets=true`.

## 5. One-time: CDN (console)

Before adding `huhansen.cn` to CDN, the domain must be **registered with Alibaba CDN** (domain verification / ICP as required).

In **CDN console**:

1. Add domain `huhansen.cn` → origin `huhansen-web.oss-cn-shanghai.aliyuncs.com`
2. Path rule: `/api/*` → FC HTTP trigger URL (from Terraform output / FC console)
3. Enable HTTPS; CNAME DNS to CDN

To let Terraform create the CDN domain after registration succeeds, set `create_cdn_domain = true`.

## 6. After Terraform succeeds

1. **CDN console** — if not already done (see §5 above): path rule `/api/*` → FC HTTP trigger origin. Enable HTTPS; CNAME `huhansen.cn` to CDN.
2. **OSS console** — if not already done (see §4 above): create `huhansen-web` and `personal-dashboard-vault`.
3. Run **Deploy Web** and **Deploy API** workflows to publish the app.

## 7. Re-run Terraform

Re-run when you change `terraform/` or when FC auth env vars change.

## What gets created

| Resource | Name |
|---|---|
| OTS instance | `pd-dashboard` (max 16 chars) |
| OTS tables | 7 × `pd_*` + 6 search indexes |
| OSS | `huhansen-web`, `personal-dashboard-vault` (manual — see §4) |
| ACR | namespace `personal-dashboard`, repo `api` (manual — see §2) |
| FC v3 | function `api`, HTTP trigger, min instances 0 |
| CDN | `huhansen.cn` → OSS (manual — see §5) |

## Local Terraform (optional)

Only if you want to plan/apply from your machine. Install Terraform ≥ 1.3, copy `terraform.tfvars.example` → `terraform.tfvars`, run `terraform init` with the same backend config as the workflow.
