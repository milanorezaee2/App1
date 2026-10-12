import { useEffect, useState } from 'react';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';
import { Platform, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT_SOURCES } from '@/lib/fontSources';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getPairingState, isOnboardingComplete } from '@/lib/storage';
import { isSupabaseConfigured } from '@/lib/pairing';
import { Colors, LtrDirection } from '@/lib/theme';
import { useRealAgent } from '@/lib/useRealAgent';

SplashScreen.preventAutoHideAsync();

function RuntimeGate() {
  const pathname = usePathname();
  // The multi-language learning app never mounts the legacy device runtime.
  if (!pathname.startsWith('/agent') && !pathname.startsWith('/permissions')) return null;
  return <CompanionRuntime />;
}

function CompanionRuntime() {
  const pathname = usePathname();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    Promise.all([getPairingState(), isOnboardingComplete()])
      .then(([pairing, complete]) => {
        setDeviceId(pairing?.deviceId ?? null);
        setEnabled(!!pairing && complete && isSupabaseConfigured());
      })
      .catch(() => {
        setDeviceId(null);
        setEnabled(false);
      });
  }, [pathname]);

  // Runs invisibly while the user studies: heartbeat, device status and
  // supported commands continue without exposing a complicated control UI.
  useRealAgent(deviceId, enabled);
  return null;
}

/**
 * Phone-2 companion only. There is no role chooser and no controller route in
 * this APK; it always boots into the companion connection screen.
 */
export default function RootLayout() {
  useFrameworkReady();
  const [fontsLoaded, fontError] = useFonts(FONT_SOURCES);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AppFrame />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

/**
 * Keep app content out of Android's status/navigation bars and use the same
 * predictable LTR structural canvas as the web export. Persian text direction
 * is applied per text node by AppText, not by mirroring the whole Yoga tree.
 */
function AppFrame() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const darkHeaderRoute = pathname === '/course/lesson' || pathname.startsWith('/learn/ru/lesson');
  const topInsetColor = darkHeaderRoute ? '#4A3A9A' : '#F8F6FB';
  const statusBarStyle = darkHeaderRoute ? 'light' : 'dark';
  const bottomInsetColor = Colors.neutral[950];

  return (
    <View style={{ flex: 1, backgroundColor: bottomInsetColor }}>
      {Platform.OS !== 'web' && insets.top > 0 ? (
        <View pointerEvents="none" style={{ height: insets.top, backgroundColor: topInsetColor }} />
      ) : null}
      <View style={{ flex: 1, ...LtrDirection }}>
        <RuntimeGate />
        <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
          <Stack.Screen name="index" />
          <Stack.Screen name="agent" />
          <Stack.Screen name="permissions" />
          <Stack.Screen name="lang/index" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </View>
      {Platform.OS !== 'web' && insets.bottom > 0 ? (
        <View pointerEvents="none" style={{ height: insets.bottom, backgroundColor: bottomInsetColor }} />
      ) : null}
      <StatusBar style={statusBarStyle} />
    </View>
  );
}
