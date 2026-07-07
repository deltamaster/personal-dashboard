# Setup Guide — Manual Steps

Complete these **before** the app works in production or locally with real data.

## 1. Azure app registration

1. [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) → **New registration**
2. Name: `personal-dashboard`
3. Account type: **Personal Microsoft accounts only**
4. Redirect URIs (Web):
   - `http://localhost:3000/api/auth/callback/microsoft-entra-id` (local dev)
   - `https://pd.huhansen.cn/api/auth/callback/microsoft-entra-id` (Shanghai prod)
   - `https://pd-qa.huhansen.com/api/auth/callback/microsoft-entra-id` (QA)
5. **Certificates & secrets** → New client secret → copy value
6. **Authentication** → enable ID tokens
7. Copy **Application (client) ID**

## 2. Alibaba Cloud provisioning (GitHub Actions)

### One-time in Alibaba console

Activate **OSS** in each region you use (if not already). No container registry required — API deploys as a zip to OSS.

### GitHub secrets

Add secrets first (see [terraform/README.md](../terraform/README.md)), then run:

**Actions → Terraform → Run workflow → apply**

Pushes to `main` that touch `terraform/` also auto-apply.

## 3. Local development

```bash
cp .env.example .env.local
# Fill in AUTH_* and ALIBABA_* values (Shanghai prod: cn-shanghai, pd-dashboard, personal-dashboard-vault)

# Node 24 (see .nvmrc)
npm install
npm run dev
```

Open http://localhost:3000 → sign in with `huhansen318@hotmail.com` → Movies tab.

## 4. GitHub repository secrets

Add these in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Example / description |
|---|---|
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | RAM user access key |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | RAM user secret |
| `ALIBABA_CLOUD_ROLE_ARN` | `acs:ram::…:role/…` (AssumeRole for Terraform and deploy workflows) |
| `AUTH_SECRET` | Auth.js secret (prod) |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Azure client ID |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Azure client secret |

Deploy workflows use fixed values for `OSS_ENDPOINT`, `OSS_WEB_BUCKET`, `FC_REGION`, and `FC_FUNCTION` (see workflow files). You do not need separate secrets for those unless you override them.

Run **Terraform**, **Deploy Web**, and **Deploy API** automatically on push:

| Branch | Targets |
|---|---|
| **`main`** | Shanghai prod |
| **Other branches** | QA only |

Pull requests against `main` run Terraform **plan** (Shanghai prod) when `terraform/**` changes.

## 5. First deploy

1. Push to `main` on GitHub
2. **Deploy Web** workflow uploads `out/` → `huhansen-web`
3. **Deploy API** workflow builds Next.js → zip → OSS → updates FC
4. Verify: https://pd.huhansen.cn/auth/signin/ (prod) or https://pd-qa.huhansen.com/auth/signin/ (QA)

## 6. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Sign-in redirects to wrong URL | `AUTH_URL` on FC must match the stack subdomain (`https://pd.huhansen.cn` or `https://pd-qa.huhansen.com`) |
| `ExternalRedirectForbidden` on Microsoft sign-in | FC blocks OAuth redirects on `*.fcapp.run`. Add DNS CNAME `api.pd` → `{account_id}.{region}.fc.aliyuncs.com` (Cloudflare DNS-only for `.com`, Alibaba DNS for `.cn`), then re-run Terraform to bind the FC custom domain. |
| Terraform `ConfigParentExceedLimit` on CDN | Each rule-engine condition allows one child config. Terraform CI runs `scripts/cdn-sync-api-origin.sh` before apply to import or prune orphan children under **api-path**. Or delete extras manually in CDN console (duplicate `origin_dns_host`, `/api/` cache rule with parent, etc.), then re-run Terraform. |
| 401 on `/api/movies` | Not signed in, or session cookie blocked (check CDN forwards `/api/*`) |
| 500 on `/api/movies` | OTS not provisioned, wrong credentials, or `pd_movies` table missing |
| Static page loads but API fails | CDN path rule for `/api/*` not pointing to FC |
| Access denied after Microsoft login | Signed in with wrong Microsoft account |
