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

## Access From Outside Using GitHub

If you want public access without Vercel, use GitHub Codespaces.

1. Open the repository on GitHub.
2. Select `Code` -> `Codespaces` -> `Create codespace on master`.
3. In the Codespaces terminal, run:

```bash
npm --prefix release-governance-studio run dev -- -H 0.0.0.0 -p 4200
```

4. Open the `Ports` panel in Codespaces.
5. For port `4200`, set visibility to `Public`.
6. Share the generated `https://...app.github.dev` URL.

This gives full app functionality, including Next.js API routes.
