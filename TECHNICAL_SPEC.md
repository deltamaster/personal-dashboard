# Technical Specification: Personal Dashboard 🛠️📐

This document outlines the technical design, database architecture, authentication flows, and API specifications for the cloud-native Personal Dashboard.

---

## 1. System Architecture

The application is built on **Next.js 14+ (App Router)** as a full-stack, serverless-ready framework. It integrates securely with **Microsoft Entra ID** for identity management and delegates all database and file storage to **Alibaba Cloud Serverless Services**.

```
+---------------------------------------------------------------------------------------------------------+
|                                              User Browser                                               |
|               [Frontend UI] (Next.js SSR Pages, Tailwind, Shadcn/ui Components, Tremor Charts)           |
+-----------------------------------+-----------------------------------+---------------------------------+
                                    |                                   ^
                           HTTPS    | Client Requests                   | Server-Sent Rendered Pages / JSON
                                    v                                   |
+-----------------------------------+-----------------------------------+---------------------------------+
|                                        Next.js App Server (FC)                                          |
|                                                                                                         |
|   +-----------------------+     +--------------------------+     +----------------------------------+   |
|   |   Route Protection    |     |    NextAuth.js Client    |     |           API Handlers           |   |
|   |      Middleware       | --> | (Microsoft Entra Provider)| --> | (OTS Adapter / OSS Media Client)  |   |
|   +-----------------------+     +--------------------------+     ++--------------------------------+    |
+-------------------------------------------------------------------|-------------------------------------+
                                                                    |
                                        +---------------------------+---------------------------+
                                        | Tablestore SDK (OTS)                                  | OSS SDK
                                        v                                                       v
+-------------------------------------------------------+       +-----------------------------------------+
|                  Alibaba Cloud OTS                    |       |            Alibaba Cloud OSS            |
|       (Serverless NoSQL Structured Database)          |       |         (Unstructured Blob Storage)     |
|                                                       |       |                                         |
|  - Table: pd_holdings      - Table: pd_snapshots      |       |  Bucket: personal-dashboard-vault       |
|  - Table: pd_visits        - Table: pd_visit_images   |       |  Directories:                           |
|  - Table: pd_flights       - Table: pd_trains         |       |  - /travel_images/                      |
|  - Table: pd_movies                                   |       |  - /portfolio_statements/               |
|                                                       |       |  - /movie_posters/                      |
+-------------------------------------------------------+       +-----------------------------------------+
```

---

## 2. Authentication Flow (Microsoft Entra ID / Azure AD)

Authentication uses OIDC (OpenID Connect) protocol powered by **NextAuth.js (Auth.js v5)** and configured against Hansen’s customized **Microsoft Entra ID** tenant.

### 2.1 NextAuth Setup (`lib/auth.ts`)
```typescript
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import * as jose from "jose"; // For JWKS Public Key signature validation

// Microsoft Entra ID (Azure AD) OIDC Implicit Flow with Public Key Validation (JWKS)
// Since this is a serverless-friendly public flow, we do NOT require any clientSecret.
// Instead, Microsoft redirects back with an `id_token` (JWT) via browser form_post.
// Our backend validates Microsoft's cryptographic signature against Microsoft's public keys.
export const authOptions = {
  providers: [
    CredentialsProvider({
      id: "azure-ad-implicit",
      name: "Microsoft Entra ID",
      credentials: {
        id_token: { label: "ID Token", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.id_token) return null;
        
        try {
          // 1. Fetch Microsoft's public keys (JWKS endpoint)
          const JWKS = jose.createRemoteJWKSet(
            new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys")
          );
          
          // 2. Cryptographically verify the signature, audience (Client ID), and issuer of the id_token
          const { payload } = await jose.jwtVerify(credentials.id_token, JWKS, {
            audience: process.env.AZURE_AD_CLIENT_ID!,
            issuer: `https://login.microsoftonline.com/common/v2.0`
          });
          
          // 3. Extract and return verified user profile data
          const email = (payload.email || payload.preferred_username) as string;
          const name = payload.name as string;
          
          return { id: payload.sub!, email, name };
        } catch (error) {
          console.error("Cryptographic validation of Microsoft ID Token failed:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account, profile }: any) {
      if (account && profile) {
        token.email = profile.email;
        token.name = profile.name;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.email = token.email;
        session.user.name = token.name;
      }
      // Strict Authorization check: Restrict access only to Hansen Hu
      const allowedEmails = ["huhansen318@hotmail.com"]; 
      if (!session.user.email || !allowedEmails.includes(session.user.email)) {
        throw new Error("Unauthorized user access attempt blocked.");
      }
      return session;
    }
  },
  pages: {
    signIn: "/auth/signin", // Customized sleek Microsoft-branded sign-in page
    error: "/auth/error"
  }
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
```

### 2.2 Middleware Protection (`middleware.ts`)
Ensures all dashboards and API routes (except the public login page) require an active session token.
```typescript
import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/signin"
  }
});

export const config = {
  matcher: [
    "/((?!api/auth|auth/signin|_next/static|_next/image|favicon.ico).*)"
  ]
};
```

---

## 3. Database Architecture (Alibaba Cloud Tablestore / OTS)

Alibaba Cloud **Tablestore (OTS)** is a wide-column NoSQL database. It requires primary keys to be specified during table creation, while non-primary key attributes are added dynamically. 
To support high-performance queries without secondary key index overheads, we leverage **OTS Search Indexes (多元索引)**, which enable full-text search, multi-column filters, range queries, and sorting.

### 3.1 Table Schemas & PK Designs

#### Table 1: `pd_holdings` (Investment Holdings)
* **Description**: Tracks portfolio holdings across various banks, issuers, and asset types.
* **Primary Key**:
  * `holding_id` (String): Unique UUID for each asset holding.
* **Dynamic Attributes (Attribute Columns)**:

| Attribute Name | OTS Type | Description / Constraints |
|---|---|---|
| `name` | String | Chinese name of the investment (Required) |
| `name_en` | String | English name of the investment |
| `ticker` | String | Code / ticker (e.g., QDII fund ticker or ticker code) |
| `asset_type` | String | enum: `fund` / `stock` / `structured_deposit` / `bond` / `etf` |
| `issuer` | String | Issuer institution (e.g., JPM, Fidelity, BlackRock) |
| `bank` | String | Buying channel / bank (e.g., HSBC, CMB) |
| `risk_level` | Integer | Risk rating `1` (R1) through `5` (R5) |
| `currency` | String | Currency code, e.g., `CNY`, `USD`, `HKD` |
| `quantity` | Double | Number of units held |
| `purchase_nav` | Double | Buying net asset value (NAV) per unit |
| `current_nav` | Double | Current net asset value (NAV) per unit |
| `purchase_amount` | Double | Total purchase cost |
| `current_value` | Double | Current market valuation |
| `unrealized_pnl` | Double | Current unrealized profit/loss |
| `unrealized_pct` | Double | Current unrealized return % |
| `cash_dividend` | Double | Accumulated received cash dividends |
| `total_return` | Double | Total return (`current_value - purchase_amount + cash_dividend`) |
| `total_return_pct` | Double | Total return % |
| `coupon_rate` | Double | Structured deposit coupon rate (optional) |
| `knockin_level` | Double | Structured product knock-in level (optional) |
| `autocall_level` | Double | Structured product autocall level (optional) |
| `strike_level` | Double | Structured product strike level (optional) |
| `maturity` | String | Structured product maturity date (YYYY-MM-DD) |
| `purchase_date` | String | Date of purchase (YYYY-MM-DD) |
| `notes` | String | Custom notes or remarks |
| `created_at` | String | ISO 8601 creation time |
| `updated_at` | String | ISO 8601 update time (only updated when NAV changes!) |

#### Table 2: `pd_snapshots` (Portfolio Historical Valuation Snapshots)
* **Description**: Tracks portfolio aggregate valuations historically to render wealth growth charts.
* **Primary Key**:
  * `snapshot_date` (String): Valuation snapshot date (YYYY-MM-DD).
* **Dynamic Attributes**:

| Attribute Name | OTS Type | Description |
|---|---|---|
| `total_value` | Double | Aggregate portfolio market value |
| `total_pnl` | Double | Aggregate portfolio accumulated profit/loss |
| `total_dividend`| Double | Aggregate portfolio total dividends received |
| `total_return` | Double | Aggregate portfolio total returns |
| `created_at` | String | ISO 8601 creation timestamp |

#### Table 3: `pd_visits` (Attraction Visits)
* **Description**: Holds records of visited spots, dining locations, and hotels.
* **Primary Key**:
  * `visit_id` (String): Unique UUID.
* **Dynamic Attributes**:

| Attribute Name | OTS Type | Description |
|---|---|---|
| `date` | String | Visit date (YYYY-MM-DD) |
| `province` | String | Province / Municipality |
| `city` | String | City name |
| `attraction` | String | Attraction / spot name |
| `attraction_en` | String | English name of attraction |
| `type` | String | enum: `景点` / `美食` / `酒店` / `博物馆` / `购物` / `其他` |
| `country` | String | Country name (default: "中国") |
| `rating` | Integer | Rating `1` to `5` |
| `cost` | Double | Total expense |
| `cost_currency` | String | Expense currency (default: "CNY") |
| `thoughts` | String | Extensive thoughts or memories |
| `highlights` | String | Highlights or recommendation reasons |
| `tips` | String | Practical travel tips and advice |
| `revisit` | Integer | Binary flag: `0` (No) or `1` (Yes) |
| `created_at` | String | ISO 8601 creation timestamp |
| `updated_at` | String | ISO 8601 modification timestamp |

#### Table 4: `pd_visit_images` (Visit Gallery Links)
* **Description**: Stores links to visit photographs backed by Alibaba Cloud OSS.
* **Primary Key**:
  * `image_id` (String): Unique UUID.
* **Dynamic Attributes**:

| Attribute Name | OTS Type | Description |
|---|---|---|
| `visit_id` | String | UUID matching the target `pd_visits` entry |
| `oss_url` | String | Public / CDN Alibaba Cloud OSS URL of the image |
| `width` | Integer | Image width in pixels |
| `height` | Integer | Image height in pixels |
| `description` | String | Captions or brief description |
| `created_at` | String | ISO 8601 creation timestamp |

#### Table 5: `pd_flights` (Flight Logs)
* **Description**: Tracks personal flights.
* **Primary Key**:
  * `flight_id` (String): Unique UUID.
* **Dynamic Attributes**:

| Attribute Name | OTS Type | Description |
|---|---|---|
| `flight_date` | String | Flight date (YYYY-MM-DD) |
| `airline` | String | Airline company (e.g., 中国东航) |
| `flight_number` | String | Flight number (e.g., MU5101) |
| `departure_city`| String | Starting city |
| `departure_time`| String | Departure hour-minute (HH:MM) |
| `arrival_city` | String | Destination city |
| `arrival_time` | String | Arrival hour-minute (HH:MM) |
| `distance_km` | Double | Flight path distance in kilometers |
| `ticket_no` | String | Passenger ticket number |
| `status` | String | Tickets usage status (default: "已使用") |
| `created_at` | String | ISO 8601 creation timestamp |

#### Table 6: `pd_trains` (Train Travel Logs)
* **Description**: Tracks personal train journeys.
* **Primary Key**:
  * `train_id` (String): Unique UUID.
* **Dynamic Attributes**:

| Attribute Name | OTS Type | Description |
|---|---|---|
| `train_date` | String | Journey date (YYYY-MM-DD) |
| `train_type` | String | Type code (e.g., 高铁 G / 动车 D) |
| `train_number` | String | Train number (e.g., G688) |
| `departure_station` | String| Starting station (e.g., 杭州西) |
| `departure_time`| String | Departure time (HH:MM) |
| `arrival_station`| String | Arriving station (e.g., 上海虹桥) |
| `arrival_time` | String | Arrival time (HH:MM) |
| `duration_minutes` | Integer| Computed journey duration in minutes |
| `seat_type` | String | Class of seating (e.g., 商务座, 一等座) |
| `ticket_no` | String | Ticket transaction identifier |
| `status` | String | Tickets usage status (default: "已使用") |
| `created_at` | String | ISO 8601 creation timestamp |

#### Table 7: `pd_movies` (Cinema Archive)
* **Description**: Watched films log.
* **Primary Key**:
  * `douban_subject_id` (String): Douban identifier, acts as primary key.
* **Dynamic Attributes**:

| Attribute Name | OTS Type | Description |
|---|---|---|
| `title_primary` | String | Primary Chinese name |
| `title_alt` | String | Alternative / English name |
| `intro` | String | Structured introductory raw string from Douban |
| `user_rating` | Integer | Rating star count `1` to `5` |
| `watched_date` | String | Viewing date (YYYY-MM-DD) |
| `movie_url` | String | Douban URL link |
| `poster_url` | String | Poster image URL |
| `comment_id` | String | Personal Douban comment reference ID |
| `release_year` | Integer | Year of release |
| `director` | String | Directing credits, delimiter: ` / ` |
| `country` | String | Producing regions, delimiter: ` / ` |
| `language` | String | Movie language spoken |
| `duration_minutes` | Integer| Duration in minutes |
| `genres` | String | Film genres, delimiter: ` / ` |
| `created_at` | String | ISO 8601 creation timestamp |
| `updated_at` | String | ISO 8601 update timestamp |

---

## 4. API Specification

All Next.js endpoints are defined under `app/api/` and enforce Azure AD authentication. If unauthenticated, they return `401 Unauthorized`.

### 4.1 Portfolio Endpoints

#### `GET /api/portfolio/holdings`
* **Response**:
```json
[
  {
    "holding_id": "8a3d11b2-c07a-4934-8b63-d1df52b0f3e8",
    "name": "贝莱德世界健康科学",
    "ticker": "LU0122379950",
    "asset_type": "fund",
    "bank": "HSBC",
    "risk_level": 3,
    "currency": "USD",
    "quantity": 1250.45,
    "purchase_nav": 102.50,
    "current_nav": 108.20,
    "purchase_amount": 128171.12,
    "current_value": 135298.69,
    "unrealized_pnl": 7127.57,
    "unrealized_pct": 5.56,
    "updated_at": "2026-06-09T08:00:00Z"
  }
]
```

#### `POST /api/portfolio/holdings`
* **Request Body**: (Submit newly acquired asset details)
* **Valuation Time Update Constraint**: Pure metadata changes (e.g., correcting names/remarks) must **NOT** alter the `updated_at` value. Only actual portfolio valuation changes (buying more shares, recording updated net asset value or current value) must update `updated_at = ISO-8601('now')`.

#### `PUT /api/portfolio/holdings/[id]`
* **Request Body**: (Submit updated current NAV or metadata edits)

---

### 4.2 Travel Endpoints

#### `GET /api/travel/visits`
* **Response**: Returns a full list of logged visits. Supports query params: `city`, `province`, `type` utilizing OTS Search Index.

#### `POST /api/travel/visits`
* **Request Body**: Creates a new visit record.

#### `POST /api/media/upload`
* **Description**: Upload travel photographs or statement PDFs. Returns pre-signed upload URLs targeting the Alibaba Cloud OSS bucket, allowing direct upload from browser to OSS, avoiding routing large binary streams through Next.js server.
* **Response**:
```json
{
  "uploadUrl": "https://personal-dashboard-vault.oss-cn-shanghai.aliyuncs.com/travel_images/img_3f92b1a8.jpg?OSSAccessKeyId=...",
  "ossUrl": "https://personal-dashboard-vault.oss-cn-shanghai.aliyuncs.com/travel_images/img_3f92b1a8.jpg"
}
```

---

## 5. Frontend UI/UX Design

The visual design is structured as a premium, highly responsive **single-page multi-tab application** styled with **Tailwind CSS** and **Shadcn/ui** components.

### 5.1 Executive Dashboard (Overview)
* **Hero Section**: Personalized greeting ("Welcome back, Hansen Hu") with quick metrics: Total Net Asset Value, Total Countries/Cities Visited, Total Movies Watched.
* **Weather Widget**: Real-time localized weather forecast, defaulting to Shanghai.
* **Activity Stream**: Recent activities (e.g., "Recently returned from Hangzhou West to Shanghai Hongqiao on G688").

### 5.2 Portfolio Dashboard Tab
* **Risk Meter (R1-R5)**: Visual charts showing portfolio allocations distributed by Risk Level (Green for R1/R2, Amber for R3, Red for R4/R5).
* **Audit Staleness Alerts**: Asset holding row is wrapped in a **bright red high-visibility border warning frame** if:
  * Risk level is R4/R5 and `updated_at` is older than **30 days**.
  * Risk level is R3 and `updated_at` is older than **90 days**.
* **Defensive Asset Shield**: Dedicated widget showcasing the ratio of defensive long-term holdings (e.g., healthcare equity, short-term bonds) protecting the portfolio.
* **Allocation Charts**: Interactive Recharts pie/donut charts showing allocations grouped by Bank Channel (e.g., HSBC, CMB) and Asset Class (e.g., stocks, bonds, structured deposits).

### 5.3 Travel tab
* **Interactive Map**: SVG-based map highlighting visited provinces in China. Hovering on a province displays visited cities and attractions list.
* **Timeline Journey**: Vertical chronological timeline listing visits, flights, and trains, interspersed with photo grids fetched directly from Alibaba Cloud OSS.
* **Transit Statistics**: Total flight kilometers, top airlines flown, total high-speed rail time, and preferred train seating (e.g., Business Seating).

### 5.4 Cinema Room tab
* **Poster Catalog**: Responsive card-based layout showcasing movie posters with hover actions displaying rating stars (1-5), watched dates, and custom comments.
* **Analytics**: Bar charts showing watched movies count by release year, and a word-cloud or bar chart representing directors sorted by frequency and rating averages.

---

## 6. Data Migration Path (SQLite to Alibaba Cloud OTS)

To migrate historical records from the existing SQLite databases (`portfolio.db`, `travel.db`, `flights.db`, `movies.db`) to Alibaba Cloud Tablestore (OTS), we define a standard migration script.

```python
# scripts/migrate_portfolio.py (Specification Outline)
import sqlite3
import uuid
import datetime
from aliyun.tablestore import OTSClient, Row, PutRowItem

# Local SQLite databases
LOCAL_DB = "../data/portfolio.db"
OTS_INSTANCE = "personal-dashboard-instance"
OTS_TABLE = "pd_holdings"

def migrate():
    # 1. Connect to local SQLite
    conn = sqlite3.connect(LOCAL_DB)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM holdings")
    rows = c.fetchall()
    
    # 2. Connect to Alibaba Cloud OTS
    client = OTSClient(
        endpoint="https://{}.cn-shanghai.ots.aliyuncs.com".format(OTS_INSTANCE),
        access_key_id="ALIBABA_CLOUD_ACCESS_KEY_ID",
        access_key_secret="ALIBABA_CLOUD_ACCESS_KEY_SECRET",
        instance_name=OTS_INSTANCE
    )
    
    # 3. Batch migrate records
    for row in rows:
        holding_id = str(uuid.uuid4()) # Generate unique PK
        
        # Construct Tablestore Primary Key
        primary_key = [('holding_id', holding_id)]
        
        # Map dynamic attributes
        attribute_columns = [
            ('name', row['name']),
            ('name_en', row['name_en']),
            ('ticker', row['ticker']),
            ('asset_type', row['asset_type']),
            ('bank', row['bank']),
            ('risk_level', row['risk_level']),
            ('currency', row['currency']),
            ('quantity', row['quantity']),
            ('purchase_nav', row['purchase_nav']),
            ('current_nav', row['current_nav']),
            ('purchase_amount', row['purchase_amount']),
            ('current_value', row['current_value']),
            ('unrealized_pnl', row['unrealized_pnl']),
            ('unrealized_pct', row['unrealized_pct']),
            ('created_at', row['created_at'] or datetime.datetime.now().isoformat()),
            ('updated_at', row['updated_at'] or datetime.datetime.now().isoformat())
        ]
        
        row_item = Row(primary_key, attribute_columns)
        client.put_row(OTS_TABLE, row_item)
        print(f"Migrated: {row['name']} -> OTS")
        
    conn.close()
    print("Migration of Portfolio holdings complete!")

if __name__ == "__main__":
    migrate()
```

Similar migrations are created for:
* `migrate_travel.py`: Migrates `visits` to `pd_visits`, upload photos to Alibaba Cloud OSS, and inserts paths to `pd_visit_images`.
* `migrate_transit.py`: Migrates `flights` and `trains` to `pd_flights` and `pd_trains` respectively.
* `migrate_movies.py`: Migrates `movies` to `pd_movies` using `douban_subject_id` directly as the Tablestore primary key.
