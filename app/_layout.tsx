import React, { useEffect, useState, Component, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as Updates from 'expo-updates';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { AnimatedSplashScreen } from '@/components/AnimatedSplashScreen';

SplashScreen.preventAutoHideAsync();

interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.warn('RootErrorBoundary caught error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#f0f7fe', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 8, textAlign: 'center' }}>
            FruitMap
          </Text>
          <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
            The app encountered a temporary error. Tap below to refresh.
          </Text>
          {this.state.error ? (
            <View style={{ backgroundColor: '#fee2e2', borderRadius: 12, padding: 12, marginBottom: 20, width: '100%', maxWidth: 400 }}>
              <Text style={{ fontSize: 12, color: '#dc2626', textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                {this.state.error.message || String(this.state.error)}
              </Text>
            </View>
          ) : null}
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ backgroundColor: '#0284c7', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 24 }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>Refresh App</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

class SplashBoundary extends Component<{ onSkip: () => void; children: ReactNode }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    console.warn('SplashBoundary caught error, skipping splash:', err);
    this.props.onSkip();
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function RootLayout() {
  useFrameworkReady();
  const [splashComplete, setSplashComplete] = useState(false);

  useEffect(() => {
    async function checkForUpdates() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
        }
      } catch (error) {
        console.log('OTA Update Error:', error);
      }
    }

    if (!__DEV__) {
      checkForUpdates();
    }
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <RootErrorBoundary>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="exchange/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="item/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="profile/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="dark" />
      </AuthProvider>
      {!splashComplete && (
        <SplashBoundary onSkip={() => setSplashComplete(true)}>
          <AnimatedSplashScreen onAnimationComplete={() => setSplashComplete(true)} />
        </SplashBoundary>
      )}
    </RootErrorBoundary>
  );
}

export { theme };
