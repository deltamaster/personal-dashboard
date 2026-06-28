# Setup Guide — Manual Steps

Complete these **before** the app works in production or locally with real data.

## 1. Azure app registration

1. [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) → **New registration**
2. Name: `personal-dashboard`
3. Account type: **Personal Microsoft accounts only**
4. Redirect URIs (Web):
   - `http://localhost:3000/api/auth/callback/microsoft-entra-id` (local dev)
   - `https://huhansen.cn/api/auth/callback/microsoft-entra-id` (production)
5. **Certificates & secrets** → New client secret → copy value
6. **Authentication** → enable ID tokens
7. Copy **Application (client) ID**

## 2. Alibaba Cloud provisioning (GitHub Actions)

### One-time in Alibaba console

**Container Registry (Personal Edition):** create namespace `personal-dashboard` and repo `api`, set registry password. See [terraform/README.md](../terraform/README.md).

### GitHub secrets

Add secrets first (see [terraform/README.md](../terraform/README.md)), then run:

**Actions → Terraform → Run workflow → apply**

Pushes to `main` that touch `terraform/` also auto-apply.

## 3. Local development

```bash
cp .env.example .env.local
# Fill in AUTH_* and ALIBABA_* values

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
| `ACR_REGISTRY` | `crpi-xxxxx.cn-shanghai.personal.cr.aliyuncs.com` |
| `ACR_USERNAME` | ACR login username |
| `ACR_PASSWORD` | ACR login password |
| `AUTH_SECRET` | Auth.js secret (prod) |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Azure client ID |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Azure client secret |

Deploy workflows use fixed values for `OSS_ENDPOINT`, `OSS_WEB_BUCKET`, `FC_REGION`, and `FC_FUNCTION` (see workflow files). You do not need separate secrets for those unless you override them.

Run **Terraform** workflow before **Deploy Web** / **Deploy API**.

## 5. First deploy

1. Push to `main` on GitHub
2. **Deploy Web** workflow uploads `out/` → `huhansen-web`
3. **Deploy API** workflow builds Docker → ACR → updates FC
4. Verify: https://huhansen.cn/auth/signin/

## 6. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Sign-in redirects to wrong URL | `AUTH_URL` on FC must be `https://huhansen.cn` |
| 401 on `/api/movies` | Not signed in, or session cookie blocked (check CDN forwards `/api/*`) |
| 500 on `/api/movies` | OTS not provisioned, wrong credentials, or `pd_movies` table missing |
| Static page loads but API fails | CDN path rule for `/api/*` not pointing to FC |
| Access denied after Microsoft login | Signed in with wrong Microsoft account |
