import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { WebView } from 'react-native-webview'

const FALLBACK_URL = 'https://your-web-app-url.example.com'

export default function App() {
  const webViewRef = useRef(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const appUrl = useMemo(() => {
    return process.env.EXPO_PUBLIC_WEB_URL || FALLBACK_URL
  }, [])

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack()
        return true
      }
      return false
    })

    return () => subscription.remove()
  }, [canGoBack])

  function handleReload() {
    setHasError(false)
    setReloadKey((prev) => prev + 1)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.title}>Agentic SDLC Mobile</Text>
        <TouchableOpacity style={styles.reloadBtn} onPress={handleReload}>
          <Text style={styles.reloadText}>Reload</Text>
        </TouchableOpacity>
      </View>

      {hasError ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Cannot load platform</Text>
          <Text style={styles.errorText}>Set EXPO_PUBLIC_WEB_URL to your deployed web URL, then reload.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleReload}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          key={reloadKey}
          ref={webViewRef}
          source={{ uri: appUrl }}
          onNavigationStateChange={(state) => setCanGoBack(Boolean(state.canGoBack))}
          onError={() => setHasError(true)}
          startInLoadingState
          pullToRefreshEnabled
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowsBackForwardNavigationGestures
          renderLoading={() => (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color="#1f5fbc" />
              <Text style={styles.loaderText}>Loading workspace...</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f8ff'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#d4e3f6',
    backgroundColor: '#ffffff'
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#133459'
  },
  reloadBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1f5fbc'
  },
  reloadText: {
    color: '#ffffff',
    fontWeight: '700'
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f4f8ff'
  },
  loaderText: {
    color: '#3d5672',
    fontSize: 13
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#9f1d1d'
  },
  errorText: {
    textAlign: 'center',
    color: '#435b74'
  },
  retryBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#9f1d1d'
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '700'
  }
})
