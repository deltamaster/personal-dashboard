# Technical Specification

Implementation reference. **Constraints, constants, and env vars live in [AGENTS.md](./AGENTS.md)** — do not duplicate them here.

---

## Authentication

Auth.js v5 + Microsoft Entra ID provider, `consumers` tenant. Authorization Code flow with client secret on FC.

### Azure app registration

1. [App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) → New registration
2. Account type: **Personal Microsoft accounts only**
3. Redirect URIs:
   - `http://localhost:3000/api/auth/callback/microsoft-entra-id`
   - `https://huhansen.cn/api/auth/callback/microsoft-entra-id`
4. Create client secret under Certificates & secrets
5. Enable ID tokens under Authentication
6. Scopes: default `openid`, `profile`, `email` only

### `auth.ts`

```typescript
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

const ALLOWED_EMAIL = process.env.ALLOWED_USER_EMAIL!;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: "https://login.microsoftonline.com/consumers/v2.0",
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email ?? profile?.preferred_username;
      return email === ALLOWED_EMAIL;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  pages: { signIn: "/auth/signin", error: "/auth/error" },
});
```

### `app/api/auth/[...nextauth]/route.ts`

```typescript
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

### Route protection

Production UI is static (no server middleware). Two layers:

1. **`AuthGuard`** component — redirects unauthenticated users to `/auth/signin`
2. **`auth()` in every API handler** — returns 401 (authoritative)

```typescript
// components/auth-guard.tsx
"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);
  if (status === "loading") return <div>Loading…</div>;
  if (status === "unauthenticated") return null;
  return <>{children}</>;
}
```

Public pages: `/auth/signin`, `/auth/error`. Sign-in page calls `signIn("microsoft-entra-id")`. Error page message: "Access denied. This application is restricted to the owner."

### API handler pattern

```typescript
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ...
}
```

---

## Database (Tablestore / OTS)

Wide-column NoSQL. PK set at table creation; other columns schemaless. Use **Search Indexes** for filtered queries.

### Search indexes

| Table | Index | Columns |
|---|---|---|
| `pd_holdings` | `idx_holdings` | `bank`, `asset_type`, `risk_level`, `currency`, `updated_at` |
| `pd_visits` | `idx_visits` | `city`, `province`, `type`, `date`, `country` |
| `pd_flights` | `idx_flights` | `flight_date`, `airline`, `departure_city`, `arrival_city` |
| `pd_trains` | `idx_trains` | `train_date`, `train_number`, `departure_station`, `arrival_station` |
| `pd_movies` | `idx_movies` | `director`, `release_year`, `user_rating`, `watched_date` |
| `pd_visit_images` | `idx_visit_images` | `visit_id` |

`pd_snapshots` — no index; range scan on `snapshot_date` PK.

### Table schemas

#### `pd_holdings` — PK: `holding_id` (String, UUID)

| Attribute | Type | Notes |
|---|---|---|
| `name` | String | Required (Chinese) |
| `name_en`, `ticker`, `issuer`, `bank` | String | |
| `asset_type` | String | `fund` / `stock` / `structured_deposit` / `bond` / `etf` |
| `risk_level` | Integer | 1–5 |
| `currency` | String | `CNY`, `USD`, `HKD` |
| `quantity`, `purchase_nav`, `current_nav` | Double | |
| `purchase_amount`, `current_value` | Double | |
| `unrealized_pnl`, `unrealized_pct` | Double | Stored computed |
| `cash_dividend`, `total_return`, `total_return_pct` | Double | Stored computed |
| `coupon_rate`, `knockin_level`, `autocall_level`, `strike_level` | Double | Structured products |
| `maturity`, `purchase_date` | String | YYYY-MM-DD |
| `notes` | String | |
| `created_at`, `updated_at` | String | ISO 8601; see computed field policy |

#### `pd_snapshots` — PK: `snapshot_date` (String, YYYY-MM-DD)

`total_value`, `total_pnl`, `total_dividend`, `total_return` (Double), `created_at` (String)

#### `pd_visits` — PK: `visit_id` (String, UUID)

`date`, `province`, `city`, `attraction`, `attraction_en`, `type` (`景点`/`美食`/`酒店`/`博物馆`/`购物`/`其他`), `country` (default `中国`), `rating` (1–5), `cost`, `cost_currency` (default `CNY`), `thoughts`, `highlights`, `tips`, `revisit` (0/1), `created_at`, `updated_at`

#### `pd_visit_images` — PK: `image_id` (String, UUID)

`visit_id`, `oss_url`, `width`, `height`, `description`, `created_at`

#### `pd_flights` — PK: `flight_id` (String, UUID)

`flight_date`, `airline`, `flight_number`, `departure_city`, `departure_time`, `arrival_city`, `arrival_time`, `distance_km`, `ticket_no`, `status` (default `已使用`), `created_at`

#### `pd_trains` — PK: `train_id` (String, UUID)

`train_date`, `train_type`, `train_number`, `departure_station`, `departure_time`, `arrival_station`, `arrival_time`, `duration_minutes`, `seat_type`, `ticket_no`, `status` (default `已使用`), `created_at`

#### `pd_movies` — PK: `douban_subject_id` (String)

`title_primary`, `title_alt`, `intro`, `user_rating` (1–5), `watched_date`, `movie_url`, `poster_url` (external Douban CDN OK), `comment_id`, `release_year`, `director`, `country`, `language`, `duration_minutes`, `genres` (multi-value fields use ` / ` delimiter), `created_at`, `updated_at`

### Computed field policy

Recalculate on write when `quantity`, `current_nav`, `purchase_amount`, or `cash_dividend` change:

```
unrealized_pnl   = current_value - purchase_amount
unrealized_pct   = unrealized_pnl / purchase_amount * 100
total_return     = current_value - purchase_amount + cash_dividend
total_return_pct = total_return / purchase_amount * 100
```

Bump `updated_at` **only** on valuation changes — not metadata edits (`name`, `notes`, etc.).

---

## API routes

All under `app/api/`, deployed to FC. Require session; return `401` if absent.

### Portfolio

| Method | Path |
|---|---|
| GET/POST | `/api/portfolio/holdings` |
| PUT/DELETE | `/api/portfolio/holdings/[id]` |
| GET/POST | `/api/portfolio/snapshots` |

### Travel

| Method | Path |
|---|---|
| GET/POST | `/api/travel/visits` |
| PUT | `/api/travel/visits/[id]` |
| GET/POST | `/api/travel/flights` |
| GET/POST | `/api/travel/trains` |
| POST | `/api/media/upload` |

**Media upload flow:** FC returns presigned PUT URL → browser uploads to vault → client POSTs metadata to create `pd_visit_images` row. Display via FC-issued presigned GET URLs (short TTL). Vault never public.

**POST /api/media/upload** response shape:

```json
{ "uploadUrl": "...?...", "objectKey": "travel_images/img_3f92b1a8.jpg" }
```

### Movies

| Method | Path |
|---|---|
| GET/POST | `/api/movies` |
| PUT | `/api/movies/[doubanId]` |

---

## UI

Next.js App Router, Tailwind, Shadcn/ui, Tremor/Recharts. Multi-tab layout.

| Tab | Key elements |
|---|---|
| **Dashboard** | Greeting, total NAV / cities / movies, Shanghai weather, recent activity |
| **Portfolio** | R1–R5 chart; red border if R4/R5 stale >30d or R3 >90d; defensive ratio; donuts by bank/asset class |
| **Travel** | China province SVG map; timeline + OSS photo grids; flight km / airline / rail stats |
| **Movies** | Poster cards; charts by year and director |

---

## Build model

```javascript
// next.config.js — static UI build
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};
```

- **Static UI:** `npm run build` → sync `out/` to `huhansen-web`
- **API:** separate `build:api` → Docker standalone → FC (see [docs/deployment.md](./docs/deployment.md))

API routes are excluded from static export. Exact split (monorepo vs dual script) decided at scaffold time.

---

## Migration (deferred)

Out of scope for v1. Future scripts under `scripts/` will import SQLite → OTS:

| Source | Target |
|---|---|
| `portfolio.db` | `pd_holdings`, `pd_snapshots` |
| `travel.db` | `pd_visits`, `pd_visit_images` + vault upload |
| `flights.db` | `pd_flights`, `pd_trains` |
| `movies.db` | `pd_movies` |
