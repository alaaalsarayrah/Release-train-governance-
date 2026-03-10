# Release Governance Studio

Standalone Next.js app for release-governance visualization and configuration.

## Features

- Panel 1 timeline view (`/panel-1-timeline`)
- Panel 2 flowchart view (`/panel-2-flowchart`)
- Panel 3 parallel-track view (`/panel-3-parallel-track`)
- Configuration center (`/config`)
- Environment configuration (`/config/environments`)
- Release train configuration (`/config/release-trains`)
- Production freeze configuration (`/config/production-freezes`)
- JSON-backed API at `/api/config`

## Run

```bash
npm install
npm run dev
```

App runs on port `4200` by default.
