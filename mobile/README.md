# Agentic SDLC Mobile App

This folder contains an Expo mobile shell for the existing Next.js platform.
The app loads your deployed web app inside a native WebView and is configured for App Store and Google Play builds via EAS.

## 1) Prerequisites

- Node.js 18+
- Expo account
- EAS CLI
- Apple Developer account (for iOS)
- Google Play Console account (for Android)

Install tooling:

```powershell
npm i -g eas-cli
```

## 2) Configure environment

```powershell
cd d:\Project\mobile
copy .env.example .env
```

Update `.env` values:

- `EXPO_PUBLIC_WEB_URL`: your production site URL (must be reachable from phones)
- `EXPO_PUBLIC_IOS_BUNDLE_ID`: unique iOS bundle id
- `EXPO_PUBLIC_ANDROID_PACKAGE`: unique Android package id

## 3) Install and run locally

```powershell
cd d:\Project\mobile
npm install
npm run start
```

Use Expo Go on a device or emulator.

## 4) Build store binaries

```powershell
cd d:\Project\mobile
eas login
eas build:configure
npm run build:android
npm run build:ios
```

Run preflight checks before build/submit:

```powershell
cd d:\Project\mobile
npm run check:release
```

## 5) Submit to stores

Before submit, update `eas.json` with real values:

- iOS: `appleId`, `ascAppId`, `appleTeamId`
- Android: `serviceAccountKeyPath`

Submit:

```powershell
cd d:\Project\mobile
npm run submit:android
npm run submit:ios
```

One-command release flows:

```powershell
cd d:\Project\mobile
npm run release:android
npm run release:ios
```

## Notes

- Replace default branding assets before production store submission.
- If the app cannot load, verify `EXPO_PUBLIC_WEB_URL` and your deployed site availability.
