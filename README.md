# Personal Dashboard

Personal dashboard for portfolio tracking, travel logs, and movie watchlists — single-user, hosted on Alibaba Cloud.

**Status:** Movies module implemented. See [docs/SETUP.md](./docs/SETUP.md) for provisioning and deploy.

## Features

- **Portfolio** — NAV, PnL, risk allocation (R1–R5), staleness alerts
- **Travel** — Visits, flights, trains, private photo gallery
- **Movies** — Douban-linked log with ratings and director stats

## Documentation

| Document | Purpose |
|---|---|
| [AGENTS.md](./AGENTS.md) | **Start here** — constraints, architecture, env vars, agent checklist |
| [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) | Auth code, OTS schemas, API routes, UI spec |
| [docs/SETUP.md](./docs/SETUP.md) | **Manual steps** — Azure, Alibaba, GitHub secrets |
| [docs/deployment.md](./docs/deployment.md) | Alibaba Cloud provisioning reference |

## Quick facts

- **User:** `huhansen318@hotmail.com` (personal Microsoft account only)
- **Domain:** [huhansen.cn](https://huhansen.cn) — CDN routes static to OSS, `/api/*` to FC
- **Cost model:** No always-on compute; FC billed per invocation only
