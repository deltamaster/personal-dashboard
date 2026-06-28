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

1. Push a placeholder `nginx:alpine` image to ACR (namespace/repo must exist — see step 2)
2. Apply all resources (OTS, OSS, FC, CDN, …)
3. Save Terraform state to GitHub Actions cache

## 4. After Terraform succeeds

1. **CDN console** — add path rule: `/api/*` → FC HTTP trigger origin (see workflow summary / FC console for trigger URL). Enable HTTPS; CNAME `huhansen.cn` to CDN.
2. Run **Deploy Web** and **Deploy API** workflows to publish the app.

## 5. Re-run Terraform

Re-run when you change `terraform/` or when FC auth env vars change.

## What gets created

| Resource | Name |
|---|---|
| OTS instance | `personal-dashboard` |
| OTS tables | 7 × `pd_*` + 6 search indexes |
| OSS | `huhansen-web` (public), `personal-dashboard-vault` (private) |
| ACR | namespace `personal-dashboard`, repo `api` (manual — see README) |
| FC v3 | function `api`, HTTP trigger, min instances 0 |
| CDN | `huhansen.cn` → OSS (static) |

## Local Terraform (optional)

Only if you want to plan/apply from your machine. Install Terraform ≥ 1.3, copy `terraform.tfvars.example` → `terraform.tfvars`, run `terraform init` with the same backend config as the workflow.
