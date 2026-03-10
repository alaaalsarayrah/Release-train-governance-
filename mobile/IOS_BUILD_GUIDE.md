# iOS Build Guide - Step by Step

This guide walks you through building and submitting the iOS app to the App Store.

## Prerequisites Checklist

- [x] Apple Developer Account (active)
- [x] App Store Connect app created (ID: 6760270670)
- [x] EAS CLI installed globally (`npm install -g eas-cli`)
- [x] Logged into EAS (`eas login` or already authenticated as `alaa59`)
- [x] Web app deployed to production (https://thesis-agentic-scrum.vercel.app)
- [x] Mobile app configured with production URL
- [ ] Apple ID password ready
- [ ] App-specific password ready (if 2FA enabled)

## Step 1: Verify Configuration

Open PowerShell and navigate to the mobile directory:

```powershell
cd d:\Project\mobile
```

Run the preflight check:

```powershell
npm run check:release:ios
```

Expected output:
```
✓ OK: EXPO_PUBLIC_WEB_URL is set
✓ OK: EXPO_PUBLIC_IOS_BUNDLE_ID is set
✓ OK: eas.json is valid JSON
✓ OK: eas.json ios appleId configured
✓ OK: eas.json ios ascAppId configured
✓ OK: eas.json ios appleTeamId configured
Release preflight passed. Ready for EAS build + submit.
```

## Step 2: Start Interactive Build

Run the build command:

```powershell
cd d:\Project\mobile
eas build --platform ios --profile production
```

## Step 3: Credential Prompts

You'll see several prompts. Here's what to expect and how to respond:

### Prompt 1: Apple ID

```
? Apple ID: »
```

**Response**: Enter `alaa59@hotmail.com`

### Prompt 2: Apple ID Password

```
? Apple ID password: »
```

**Response**: Enter your Apple ID password  
**Note**: Password input is hidden

### Prompt 3: Two-Factor Authentication (if enabled)

```
? Two-factor authentication code: »
```

**Response**: 
- Check your trusted Apple device for the 6-digit code
- Or use an app-specific password if you've generated one
- Enter the code when prompted

### Prompt 4: Distribution Certificate

```
? Would you like to create a new Distribution Certificate? »
```

**Response**: Select `Yes` (or press Enter for default)

**What this does**: 
- Creates an Apple Distribution Certificate
- Stored securely on Expo servers
- Required to sign iOS apps for App Store

### Prompt 5: Provisioning Profile

```
? Would you like to create a new Provisioning Profile? »
```

**Response**: Select `Yes` (or press Enter for default)

**What this does**:
- Creates an App Store provisioning profile
- Links your app bundle ID to the distribution certificate
- Enables installation on devices via App Store

## Step 4: Wait for Build

After credential setup, EAS will:

1. **Upload** your code to EAS Build servers
2. **Install** dependencies (npm packages)
3. **Build** the iOS app binary (.ipa file)
4. **Sign** the app with your credentials

**Build time**: Typically 10-20 minutes

You'll see output like:
```
✔ Build started, it may take a few minutes to complete.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Build details: https://expo.dev/accounts/alaa59/projects/agentic-sdlc-mobile/builds/[build-id]
```

**You can:**
- Close the terminal (build continues on EAS servers)
- Visit the build URL to monitor progress
- Get a notification when build completes

## Step 5: Download Build Artifact (Optional)

After build completes, you can download the .ipa file:

1. Visit https://expo.dev/accounts/alaa59/projects/agentic-sdlc-mobile/builds
2. Find your production iOS build
3. Click "Download" to get the .ipa file

**Use case**: Testing on physical devices via TestFlight or direct installation

## Step 6: Submit to App Store Connect

Option A: **Command Line** (Recommended)

```powershell
cd d:\Project\mobile
eas submit --platform ios --profile production
```

This will:
- Use the latest successful iOS build
- Upload to App Store Connect automatically
- Submit to the app you configured (ASC App ID: 6760270670)

Option B: **Web Interface**

1. Visit https://expo.dev/accounts/alaa59/projects/agentic-sdlc-mobile/builds
2. Find your production iOS build
3. Click "Submit to store"
4. Follow the prompts

Option C: **Manual Upload via Transporter**

1. Download the .ipa file (see Step 5)
2. Install Apple Transporter app (Mac required)
3. Open Transporter, drag and drop the .ipa
4. Submit to App Store Connect

## Step 7: Complete App Store Listing

Go to https://appstoreconnect.apple.com and complete your app submission:

### Required Information

1. **App Information**
   - Name: `Agentic SDLC`
   - Subtitle: `AI-Powered Software Development`
   - Category: `Business` or `Developer Tools`
   - Content Rights: Your name or organization

2. **Pricing and Availability**
   - Price: Free (or set your price)
   - Availability: All countries

3. **App Privacy**
   - Privacy Policy URL: (you'll need to host this)
   - Privacy practices questionnaire

4. **Screenshots** (Required sizes)
   - 6.5" iPhone (1284 x 2778 pixels) - 3-10 images
   - 5.5" iPhone (1242 x 2208 pixels) - 3-10 images
   - Optional: iPad screenshots

5. **App Description**
   - Promotional text: Short highlight (170 chars)
   - Description: Full app description (4000 chars max)
   - Keywords: Comma-separated (100 chars max)
   - Support URL: Your support website
   - Marketing URL: (optional)

6. **App Review Information**
   - Contact information
   - Demo account (if login required)
   - Notes for reviewer

### Screenshot Tips

You can capture screenshots using:

**Method 1: iOS Simulator**
```powershell
# Install and run on simulator
cd d:\Project\mobile
expo start --ios
# Then: Cmd+S (Mac) or use Device → Screenshots
```

**Method 2: Physical Device**
- Install via TestFlight
- Take screenshots with device buttons
- AirDrop or email to your computer

**Method 3: Design Tools**
- Create mockups in Figma, Adobe XD, or Sketch
- Use screenshot templates for App Store

## Step 8: Submit for Review

1. Review all information in App Store Connect
2. Click "Add for Review"
3. Answer content questionnaire
4. Submit for Review

**Review time**: Usually 24-48 hours

## Troubleshooting

### Error: Invalid Apple ID or Password

**Cause**: Wrong credentials or 2FA issue

**Solution**: 
1. Verify credentials at https://appleid.apple.com
2. Generate app-specific password:
   - Go to https://appleid.apple.com
   - Sign in → Security → App-Specific Passwords
   - Generate new password
   - Use this instead of your regular password

### Error: Certificate Already Exists

**Cause**: Certificate exists but not in EAS

**Solution**: Let EAS manage it:
```powershell
eas build --platform ios --profile production --clear-credentials
```

### Error: Bundle Identifier Already in Use

**Cause**: Bundle ID registered to different team

**Solution**:
1. Check https://developer.apple.com/account/resources/identifiers/list
2. Verify ownership
3. Update `EXPO_PUBLIC_IOS_BUNDLE_ID` in `.env` if needed

### Build Gets Stuck

**Cause**: Network or server issue

**Solution**:
1. Cancel: Ctrl+C
2. Retry: `eas build --platform ios --profile production`
3. Check status: https://status.expo.dev

### Submission Fails

**Cause**: Missing or invalid metadata

**Solution**:
1. Check App Store Connect for error details
2. Ensure all required fields are complete
3. Verify app ID matches: 6760270670

## Next Steps After Approval

1. **Release Options**
   - Manual release: Hold for manual release after approval
   - Automatic release: Publish immediately after approval
   - Scheduled release: Pick a future date/time

2. **TestFlight** (Optional Beta Testing)
   - Add internal testers (up to 100)
   - Add external testers (up to 10,000)
   - Collect feedback before public release

3. **Marketing**
   - Announce on social media
   - Add app URL to your website
   - Prepare launch blog post

4. **Monitoring**
   - Check App Store Connect → Analytics
   - Monitor crash reports
   - Respond to user reviews

## Additional Resources

- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **App Store Guidelines**: https://developer.apple.com/app-store/review/guidelines/
- **Expo Forums**: https://forums.expo.dev
- **Apple Developer Forums**: https://developer.apple.com/forums/

## Quick Reference

```powershell
# Verify configuration
cd d:\Project\mobile
npm run check:release:ios

# Build iOS app
eas build --platform ios --profile production

# Check build status
eas build:list --platform ios

# Submit to App Store
eas submit --platform ios --profile production

# View credentials
eas credentials

# Reset credentials (if needed)
eas build --platform ios --clear-credentials
```

## Contact

For issues or questions:
- Email: alaa59@hotmail.com
- EAS Project: https://expo.dev/accounts/alaa59/projects/agentic-sdlc-mobile
