export default {
  expo: {
    name: 'Agentic SDLC',
    slug: 'agentic-sdlc-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'agenticsdlc',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || 'com.agenticsdlc.mobile',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      package: process.env.EXPO_PUBLIC_ANDROID_PACKAGE || 'com.agenticsdlc.mobile'
    },
    plugins: ['expo-asset'],
    extra: {
      eas: {
        projectId: '503be4df-a891-4578-b071-59c68532439a',
        owner: 'alaa59'
      },
      webAppUrl: process.env.EXPO_PUBLIC_WEB_URL || 'https://your-web-app-url.example.com'
    }
  }
}
