# Personal Dashboard 💻📈✈️

> A cloud-native, Next.js-based personal assistant dashboard for tracking investment portfolios, travel journeys (flights, trains, visits), and watched movies. 
> Fully integrated with **Microsoft Entra ID (Azure AD)** for enterprise-grade secure authentication and **Alibaba Cloud (Tablestore/OTS, OSS, FC)** for high-availability, serverless data storage and hosting.

---

## 🌟 Key Features

### 1. 📈 Wealth & Investment Portfolio
* **Real-time NAV Tracking**: Direct asset valuation and holding status updates (quantity, purchase NAV, current NAV).
* **Comprehensive Analytics**: Auto-calculated unrealized PnL, PnL %, cash dividends, and total returns.
* **Asset & Risk Allocation**: Charts and graphs visualizing holdings categorized by risk level (R1 to R5 with standard categorization rules), buying channel (bank/broker), and issuer.
* **Audit Staleness Alerts**: Automated warnings for outdated valuations (30 days limit for R4/R5 high-risk assets, 90 days limit for R3 medium-risk assets) with high-visibility indicators.
* **Defensive Asset Focus**: Dedicated view highlighting defensive allocations (e.g., healthcare, solid fixed income) to enforce defensive investing principles.

### 2. ✈️ Travel & Journey Companion
* **Visits Logs**: Map-based and timeline-based record of attraction visits, hotels, dining, and landmarks, with user ratings, costs, thoughts, and tips.
* **Media Vault**: Dynamic photo galleries showcasing travel photos backed by Alibaba Cloud Object Storage Service (OSS).
* **Transit Trackers**: 
  * **Flights**: Historical flight database with airlines, flight numbers, routes, distances, and total mileage statistics.
  * **Trains**: Train trip tracker supporting high-speed trains (G-series, D-series) with durations, seat types (such as Business Class), and station-to-station routing.

### 3. 🎬 Cinema Room
* **Movie Log**: Archive of watched movies, synced with user ratings (1-5 stars) and watched dates.
* **Rich Metadata**: Automatically parsed directors, production countries, languages, film genres, and release years.
* **Director Stats**: Statistical breakdown of favorite directors and top-rated movies (5-Star Top list).
* **Douban Integration**: Clean links to Douban Subject profiles for easily viewing movie details and posters.

---

## 🛠️ Architecture & Tech Stack

```
           +------------------------------------------+
           |       Microsoft Entra ID (Azure AD)      |
           |          OIDC Security Gateway           |
           +--------------------+---------------------+
                                | OAuth 2.0 / JWT
                                v
+------------------+     +------+------+     +-----------------------+
|  Client Browser  | <-> |  Next.js UI | <-> | Alibaba Cloud OTS/OSS |
|  (Shadcn, Tremor)|     | (Vercel/FC) |     |  (Serverless Storage) |
+------------------+     +-------------+     +-----------------------+
```

* **Frontend Framework**: **Next.js 14+ (App Router)** with **TypeScript** and **React 18**.
* **Styling & Components**: **Tailwind CSS**, **Shadcn/ui** (for modular components), and **Tremor / Recharts** (for high-fidelity financial/travel charts).
* **Authentication**: **NextAuth.js** integrated with **Microsoft Entra ID** (OIDC), ensuring strict personal access.
* **Database (Structured Data)**: **Alibaba Cloud Tablestore (OTS)** — fully managed, serverless NoSQL database offering single-digit millisecond latency and absolute scalability.
* **Object Storage (Unstructured Media)**: **Alibaba Cloud Object Storage Service (OSS)** for secure travel photos, PDF statements, and movie posters.
* **Serverless Deployment**: **Alibaba Cloud Function Compute (FC)** Custom Runtime or Docker containers.

---

## 📁 Repository Structure

```
├── .github/workflows/      # CI/CD deployment pipelines
├── app/                    # Next.js App Router
│   ├── api/                # API Route Handlers (OTS & OSS adapters)
│   ├── auth/               # NextAuth routing and sign-in pages
│   ├── portfolio/          # Portfolio views & valuation analytics
│   ├── travel/             # Travel logs, flight & train statistics, photo gallery
│   ├── movies/             # Cinema room and movie catalog
│   ├── layout.tsx          # Global navigation layout
│   └── page.tsx            # Main executive dashboard landing page
├── components/             # Reusable UI components (Shadcn, charts, cards)
│   ├── ui/                 # Atomic Shadcn components (button, dialog, select, etc.)
│   ├── portfolio-chart.tsx # Asset and risk allocation charts
│   ├── travel-map.tsx      # SVG/Map visualization of visited cities
│   └── movie-card.tsx      # Movie poster card with hover ratings
├── lib/                    # Core library modules
│   ├── ots.ts              # Alibaba Cloud Tablestore (OTS) Client & CRUD handlers
│   ├── oss.ts              # Alibaba Cloud Object Storage Service (OSS) Client
│   └── auth.ts             # NextAuth configuration and Azure AD provider options
├── public/                 # Static assets (icons, placeholder images)
├── scripts/                # SQLite-to-OTS database migration tools
│   ├── migrate_portfolio.py
│   ├── migrate_travel.py
│   └── migrate_movies.py
├── TECHNICAL_SPEC.md       # Technical specification & system architecture
└── package.json            # Node dependency configuration
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have the following installed:
* Node.js (v18.x or v20.x+)
* npm / pnpm / yarn
* Python 3.8+ (for running migration scripts)

### 2. Environment Setup
Create a `.env.local` file in the root directory and configure the variables:

```env
# Next.js Core
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-key-change-in-prod

# Microsoft Entra ID (Azure AD) Authentication
AZURE_AD_CLIENT_ID=your-azure-ad-client-id
AZURE_AD_CLIENT_SECRET=your-azure-ad-client-secret
AZURE_AD_TENANT_ID=your-azure-ad-tenant-id

# Alibaba Cloud Credentials
ALIBABA_CLOUD_ACCESS_KEY_ID=your-access-key-id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your-access-key-secret

# Alibaba Cloud OTS (Tablestore) Configuration
OTS_ENDPOINT=https://your-instance.cn-shanghai.ots.aliyuncs.com
OTS_INSTANCE_NAME=your-ots-instance-name

# Alibaba Cloud OSS Configuration
OSS_BUCKET=your-oss-bucket-name
OSS_REGION=oss-cn-shanghai
OSS_ENDPOINT=oss-cn-shanghai.aliyuncs.com
```

### 3. Installation
```bash
# Clone the repository
git clone https://github.com/deltamaster/personal-dashboard.git
cd personal-dashboard

# Install dependencies
npm install
```

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📘 Detailed Documentation
* For complete database schemas, API specs, and migration pathways, see [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md).
* For Alibaba Cloud integration details, refer to the [Alibaba Cloud FC Deployment Runbook](./docs/deployment.md).
