# Agentic AI as Scrum Master — Thesis Starter Site

This repository is a minimal Next.js site to kick off a thesis about an agentic AI acting as a Scrum Master. It includes an interactive toy demo illustrating simple sprint planning heuristics.

Getting started (Windows PowerShell):

```powershell
cd d:\Project
npm install
npm run dev
```

Open http://localhost:3000 after `npm run dev`.

## Production Deployment

✅ **Web App**: https://thesis-agentic-scrum.vercel.app  
⏳ **iOS App**: Configuration complete, awaiting credential setup

📚 **Full deployment guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)  
📱 **iOS build guide**: See [mobile/IOS_BUILD_GUIDE.md](./mobile/IOS_BUILD_GUIDE.md)

**Data storage note:**
- On Vercel, writable local storage is runtime-only (`/tmp`).
- The app supports `REQUESTS_DB_PATH` override for SQLite path control.
- For durable production persistence, configure remote libSQL/Turso:
  - `REQUESTS_DB_URL=libsql://<database>.turso.io`
  - `REQUESTS_DB_AUTH_TOKEN=<token>`

## Features

- ✅ Thesis PDF upload and parsing
- ✅ SAFe sprint planning prototype with intelligent prioritization
- ✅ BRD document parsing and Azure DevOps integration
- ✅ Automated workflow: Business Analyst uploads BRD → System creates user stories in ADO backlog
- ✅ Mobile app wrapper (iOS/Android) using React Native WebView
- ✅ Bibliography and contact sections

## Quick Deployment

### Vercel (Recommended - Currently in Production)

The app is live at: https://thesis-agentic-scrum.vercel.app

To redeploy:

```powershell
cd d:\Project
npx vercel --prod
```

## Planning Smoke Test

Run the full planning + scenario-runner smoke test locally:

```powershell
cd d:\Project
npm run smoke:planning
```

Run against production:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/planning-smoke.ps1 -BaseUrl "https://thesis-agentic-scrum.vercel.app"
```

### Docker

Build and run locally:

```powershell
cd d:\Project
docker build -t thesis-agentic-scrum .
# Run with persistent uploads
docker run --rm -p 3000:3000 `
  -v d:/Project/public/uploads:/app/public/uploads `
  thesis-agentic-scrum
```

Or use Docker Compose:

```powershell
cd d:\Project
docker-compose up --build
```

## Mobile Application

A mobile wrapper is available in `mobile/` using Expo + React Native.

**Quick start:**

```powershell
cd d:\Project\mobile
npm install
npm start
```

**Configuration:**
- Production URL: `https://thesis-agentic-scrum.vercel.app` (already set in `.env`)
- iOS bundle ID: `com.agenticsdlc.mobile`
- See [mobile/IOS_BUILD_GUIDE.md](./mobile/IOS_BUILD_GUIDE.md) for step-by-step iOS build instructions

**Build for production:**

```powershell
cd d:\Project\mobile
# iOS requires interactive credential setup
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

📚 **Complete deployment guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Project Structure

```
d:\Project/
├── pages/
│   ├── index.js              # Homepage with navigation
│   ├── thesis.js             # Thesis PDF upload
│   ├── thesis-analyze.js     # Parsed thesis viewer
│   ├── safe-prototype.js     # SAFe sprint planning demo
│   ├── brd-workflow.js       # BRD → Azure DevOps workflow
│   ├── bibliography.js       # Bibliography page
│   ├── contact.js            # Contact form
│   └── api/
│       ├── upload.js         # File upload handler
│       ├── parse-thesis.js   # PDF parsing
│       ├── parse-brd.js      # DOCX parsing
│       ├── ado-config.js     # ADO configuration storage
│       └── sync-ado.js       # Create work items in ADO
├── components/
│   ├── SafeAgent.js          # SAFe prioritization logic
│   └── AdoConfig.js          # ADO configuration UI
├── mobile/
│   ├── App.js                # React Native WebView wrapper
│   ├── app.config.js         # Expo configuration
│   ├── eas.json              # EAS Build configuration
│   └── IOS_BUILD_GUIDE.md    # Detailed iOS build steps
├── public/uploads/           # Uploaded files (volume-mounted)
├── Dockerfile                # Docker build configuration
├── DEPLOYMENT.md             # Comprehensive deployment guide
└── README.md                 # This file
```

## Support

For questions or issues:
- **Email**: alaa59@hotmail.com
- **Web App**: https://thesis-agentic-scrum.vercel.app
- **EAS Project**: https://expo.dev/accounts/alaa59/projects/agentic-sdlc-mobile