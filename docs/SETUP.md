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

## 2. Alibaba Cloud provisioning

Follow [deployment.md](./deployment.md). Minimum for movies module:

| Resource | Name | Notes |
|---|---|---|
| OTS instance | `personal-dashboard` | cn-shanghai |
| OTS table | `pd_movies` | PK: `douban_subject_id` (String) |
| OSS bucket | `huhansen-web` | Public static site |
| OSS bucket | `personal-dashboard-vault` | Private (not needed for movies yet) |
| RAM user | `personal-dashboard-app` | AK with OTS + OSS permissions |
| ACR | namespace `personal-dashboard` | For API Docker image |
| FC | service `personal-dashboard`, function `api` | Custom container, **minInstances=0** |
| CDN | `huhansen.cn` | `/api/*` → FC, `/*` → OSS |

### Create `pd_movies` table (OTS console or CLI)

- Table name: `pd_movies`
- Primary key: `douban_subject_id` (String)
- No predefined columns (schemaless attributes)

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
| `OSS_ENDPOINT` | `oss-cn-shanghai.aliyuncs.com` |
| `OSS_WEB_BUCKET` | `huhansen-web` |
| `ACR_REGISTRY` | `crpi-xxxxx.cn-shanghai.personal.cr.aliyuncs.com` |
| `ACR_USERNAME` | ACR login username |
| `ACR_PASSWORD` | ACR login password |
| `FC_REGION` | `cn-shanghai` |
| `FC_SERVICE` | `personal-dashboard` |
| `FC_FUNCTION` | `api` |

FC environment variables (set in FC console, **not** GitHub):

```
AUTH_URL=https://huhansen.cn
AUTH_SECRET=<same secret as local, or generate new for prod>
AUTH_MICROSOFT_ENTRA_ID_ID=<from Azure>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<from Azure>
ALLOWED_USER_EMAIL=huhansen318@hotmail.com
ALIBABA_CLOUD_ACCESS_KEY_ID=<RAM key>
ALIBABA_CLOUD_ACCESS_KEY_SECRET=<RAM secret>
OTS_ENDPOINT=https://personal-dashboard.cn-shanghai.ots.aliyuncs.com
OTS_INSTANCE_NAME=personal-dashboard
OSS_VAULT_BUCKET=personal-dashboard-vault
OSS_VAULT_REGION=oss-cn-shanghai
OSS_VAULT_ENDPOINT=oss-cn-shanghai.aliyuncs.com
```

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
