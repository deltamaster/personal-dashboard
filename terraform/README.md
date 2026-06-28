# Terraform — Alibaba Cloud provisioning (GitHub Actions)

Provisions OTS, OSS, ACR, FC, and CDN. **Runs on GitHub Actions** — you do not need Terraform installed locally.

Does **not** create RAM users/roles. Uses your existing RAM user + AssumeRole.

## 1. GitHub secrets

Add these in **GitHub → Settings → Secrets and variables → Actions**:

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

Your RAM user also needs permission to create/write the Terraform state bucket (`personal-dashboard-tfstate`), or create that bucket once in the OSS console.

## 2. One-time: ACR instance

Create a **Container Registry Personal Edition** instance in cn-shanghai. Copy the login server URL into the `ACR_REGISTRY` secret.

## 3. Run provisioning

**Actions → Terraform → Run workflow → apply**

Or push changes under `terraform/` to `main` (auto-applies).

On first run the workflow will:

1. Create an OSS bucket `personal-dashboard-tfstate` for Terraform state
2. Create ACR namespace/repo
3. Push a placeholder `nginx:alpine` image (FC needs an image before the function can start)
4. Apply all resources (OTS, OSS, FC, CDN, …)

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
| ACR | namespace `personal-dashboard`, repo `api` |
| FC v3 | function `api`, HTTP trigger, min instances 0 |
| CDN | `huhansen.cn` → OSS (static) |

## Local Terraform (optional)

Only if you want to plan/apply from your machine. Install Terraform ≥ 1.3, copy `terraform.tfvars.example` → `terraform.tfvars`, run `terraform init` with the same backend config as the workflow.
