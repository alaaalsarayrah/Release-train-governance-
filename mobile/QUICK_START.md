# iOS Build - Quick Reference Card

Keep this open while building your iOS app!

---

## Before You Start

✅ Already configured:
- Web app deployed: https://thesis-agentic-scrum.vercel.app
- EAS project created
- iOS bundle and credentials configured

🔑 You'll need:
- Apple ID: `alaa59@hotmail.com`
- Apple ID password
- 2FA code (if enabled)

---

## Build Commands (Copy & Paste)

### Step 1: Verify Configuration
```powershell
cd d:\Project\mobile
npm run check:release:ios
```
✅ Expected: All checks pass

### Step 2: Start Build
```powershell
cd d:\Project\mobile
eas build --platform ios --profile production
```

### Step 3: Submit to App Store
```powershell
cd d:\Project\mobile
eas submit --platform ios --profile production
```

---

## What to Type During Build

| Prompt | Your Response |
|--------|---------------|
| **Apple ID:** | `alaa59@hotmail.com` |
| **Password:** | (Your Apple ID password) |
| **2FA Code:** | (Check your device for 6-digit code) |
| **Create Distribution Certificate?** | `Yes` (or press Enter) |
| **Create Provisioning Profile?** | `Yes` (or press Enter) |

---

## Build Progress

Build takes **10-20 minutes**. You'll see:

1. ✅ Credentials configured
2. ✅ Code uploaded to EAS
3. ✅ Dependencies installed
4. ✅ iOS app built (.ipa created)
5. ✅ App signed with your certificate

**Track online**: https://expo.dev/accounts/alaa59/projects/agentic-sdlc-mobile/builds

---

## After Build Completes

### If Successful ✅
```powershell
# Submit to App Store
cd d:\Project\mobile
eas submit --platform ios --profile production
```

Then go to: https://appstoreconnect.apple.com
- Complete app metadata
- Add screenshots
- Submit for review

### If Failed ❌

**Check the error message**, then try:

```powershell
# Reset credentials and try again
cd d:\Project\mobile
eas build --platform ios --clear-credentials
eas build --platform ios --profile production
```

Or get help:
- EAS Docs: https://docs.expo.dev/build/introduction/
- Expo Forums: https://forums.expo.dev

---

## Common Issues

### "Invalid Apple ID or Password"
- Verify at https://appleid.apple.com
- Generate app-specific password if 2FA is enabled

### "Certificate already exists"
```powershell
eas build --platform ios --clear-credentials
eas build --platform ios --profile production
```

### "Build stuck or not starting"
- Check https://status.expo.dev
- Try again in a few minutes

---

## Screenshots for App Store

You'll need:
- **6.5" iPhone**: 1284 x 2778 pixels (3-10 images)
- **5.5" iPhone**: 1242 x 2208 pixels (3-10 images)

**How to capture:**
1. Install app via TestFlight after build
2. Take screenshots with device
3. Or use iOS Simulator (Mac required)
4. Or create mockups in Figma/Adobe XD

---

## Your Configuration

- **Apple ID**: alaa59@hotmail.com
- **iOS Bundle ID**: com.agenticsdlc.mobile
- **App Store Connect ID**: 6760270670
- **Team ID**: PTP63TYJJF
- **Web App**: https://thesis-agentic-scrum.vercel.app
- **EAS Project**: 503be4df-a891-4578-b071-59c68532439a

---

## Useful Commands

```powershell
# Check build status
cd d:\Project\mobile
eas build:list --platform ios

# View credentials
eas credentials

# Cancel running build
# (Press Ctrl+C in terminal, or cancel on web)
```

---

## Need Help?

📚 **Detailed Guide**: [IOS_BUILD_GUIDE.md](./IOS_BUILD_GUIDE.md)  
📚 **Full Deployment**: [../DEPLOYMENT.md](../DEPLOYMENT.md)  
📧 **Email**: alaa59@hotmail.com  
🌐 **EAS Docs**: https://docs.expo.dev/build/introduction/

---

**⏱️ Estimated Time**: 30-45 minutes (including build time)  
**💰 Cost**: Free (EAS includes free builds for personal accounts)  
**📱 Result**: iOS .ipa file ready for App Store submission

---

## Ready to Build?

```powershell
cd d:\Project\mobile
eas build --platform ios --profile production
```

Good luck! 🚀
