# Deployment Guide

This document provides complete deployment instructions for both the web application and mobile apps.

## Production Status

✅ **Web App (Next.js)**: Successfully deployed to Vercel  
🔗 **Production URL**: https://thesis-agentic-scrum.vercel.app

⏳ **iOS App**: Configuration complete, awaiting credential setup  
⏳ **Android App**: Configuration pending

---

## Web Application Deployment

### Vercel (Production - Currently Active)

The web application is deployed to Vercel at: https://thesis-agentic-scrum.vercel.app

**To redeploy or update:**

```powershell
cd d:\Project
npx vercel --prod
```

**First-time setup:**

1. Install Vercel CLI globally:
   ```powershell
   npm install -g vercel
   ```

2. Login to Vercel:
   ```powershell
   npx vercel login
   ```

3. Deploy:
   ```powershell
   cd d:\Project
   npx vercel --prod --name thesis-agentic-scrum
   ```

**Environment Variables** (if needed):
- Go to https://vercel.com/dashboard
- Select your project
- Navigate to Settings → Environment Variables
- Add any required variables

### Docker Deployment

**Build the Docker image:**

```powershell
cd d:\Project
docker build -t thesis-agentic-scrum .
```

**Run with persistent uploads:**

```powershell
docker run --rm -p 3000:3000 `
  -v d:/Project/public/uploads:/app/public/uploads `
  thesis-agentic-scrum
```

**Using Docker Compose:**

```powershell
cd d:\Project
docker-compose up --build
```

The volume mount ensures uploaded files persist across container restarts.

### Local Development

```powershell
cd d:\Project
npm install
npm run dev
```

Open http://localhost:3000

---

## Mobile App Deployment

### Prerequisites

1. **Expo Account**: https://expo.dev
2. **Apple Developer Account**: https://developer.apple.com (iOS)
3. **Google Play Console Account**: https://play.google.com/console (Android)

### Configuration

The mobile app is configured with:
- **EAS Project ID**: `503be4df-a891-4578-b071-59c68532439a`
- **Owner**: `alaa59`
- **Web URL**: `https://thesis-agentic-scrum.vercel.app`
- **iOS Bundle ID**: `com.agenticsdlc.mobile`
- **Apple ID**: `alaa59@hotmail.com`
- **ASC App ID**: `6760270670`
- **Apple Team ID**: `PTP63TYJJF`

### iOS Build and Submission

**Current Status**: ⏳ Awaiting credential setup

**Step 1: Run Preflight Check**

```powershell
cd d:\Project\mobile
npm run check:release:ios
```

**Step 2: Build iOS App (Interactive)**

This step requires your Apple credentials:

```powershell
cd d:\Project\mobile
eas build --platform ios --profile production
```

You'll be prompted for:
- Apple ID: `alaa59@hotmail.com`
- Apple ID password
- App-specific password (if 2FA enabled)
- Confirmation to create/manage certificates

**Alternative: Web Build**

1. Visit https://expo.dev/accounts/alaa59/projects/agentic-sdlc-mobile
2. Click "Builds" → "Create a build"
3. Select iOS platform and production profile
4. Follow the credential prompts

**Step 3: Submit to App Store Connect**

After build completes:

```powershell
cd d:\Project\mobile
npm run submit:ios
```

Or submit via web: https://expo.dev/accounts/alaa59/projects/agentic-sdlc-mobile/builds

**Step 4: App Store Listing**

1. Go to https://appstoreconnect.apple.com
2. Navigate to your app (ID: 6760270670)
3. Complete app metadata:
   - Description
   - Screenshots (6.5" and 5.5" iPhone)
   - Privacy policy URL
   - Support URL
4. Submit for review

### Android Build and Submission

**Prerequisites:**
1. Create Google Play Console account
2. Generate service account JSON
3. Save as `d:\Project\mobile\play-service-account.json`

**Step 1: Configure Environment**

Update `d:\Project\mobile\.env`:

```bash
EXPO_PUBLIC_ANDROID_PACKAGE=com.agenticsdlc.mobile
```

**Step 2: Run Preflight Check**

```powershell
cd d:\Project\mobile
npm run check:release:android
```

**Step 3: Build Android App**

```powershell
cd d:\Project\mobile
eas build --platform android --profile production
```

**Step 4: Submit to Google Play**

```powershell
cd d:\Project\mobile
npm run submit:android
```

**Step 5: Google Play Listing**

1. Go to https://play.google.com/console
2. Complete store listing
3. Submit for review

---

## Troubleshooting

### iOS Build Fails with Credential Error

**Error**: `Distribution Certificate is not validated for non-interactive builds`

**Solution**: Run interactive build:
```powershell
cd d:\Project\mobile
eas build --platform ios --profile production
```

### Vercel Deployment Fails

**Error**: Project name validation

**Solution**: Specify project name:
```powershell
npx vercel --prod --name thesis-agentic-scrum
```

### Docker Upload Issues

**Error**: Files not persisting

**Solution**: Ensure volume mount:
```powershell
docker run -v d:/Project/public/uploads:/app/public/uploads thesis-agentic-scrum
```

---

## Monitoring and Logs

### Vercel Logs

```powershell
npx vercel logs https://thesis-agentic-scrum.vercel.app
```

Or view in dashboard: https://vercel.com/dashboard

### EAS Build Logs

View at: https://expo.dev/accounts/alaa59/projects/agentic-sdlc-mobile/builds

### Docker Logs

```powershell
docker logs <container_id>
```

---

## Next Steps

- [ ] Complete iOS credential setup and build
- [ ] Configure Android service account
- [ ] Add app screenshots for stores
- [ ] Set up continuous deployment (GitHub Actions + Vercel)
- [ ] Configure production environment variables
- [ ] Set up monitoring and analytics

---

## Support

- **Web App Issues**: Check Vercel dashboard or logs
- **Mobile Build Issues**: https://docs.expo.dev/build/introduction/
- **General Questions**: Contact alaa59@hotmail.com
