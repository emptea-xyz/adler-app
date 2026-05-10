import React, { useEffect, useCallback, useState } from "react";
import { Slot, useRouter } from "expo-router";
import { useFonts } from "expo-font";
import { Geist_400Regular, Geist_600SemiBold } from "@expo-google-fonts/geist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, StatusBar, useColorScheme } from "react-native";
import ToastManager from "toastify-react-native";
import * as SplashScreen from "expo-splash-screen";
import { PrivyProvider } from "@privy-io/expo";

import "../global.css";
import { toastConfig } from "@/components/ui/ToastConfig";
import ErrorBoundary from "@/components/base/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProvider } from "@/contexts/UserContext";
import { QueryProvider } from "@/contexts/QueryProvider";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { MONO_PALETTE } from "@/constants/ThemePalettes";
import { OfflineBanner } from "@/components/base/OfflineBanner";
import {
  addNotificationResponseListener,
  readInitialNotificationHref,
  setupForegroundHandler,
} from "@/lib/services/pushService";

// Show banners + sound when a push lands while the app is in the foreground.
// Module-scoped so it runs once per JS bundle, not per render.
setupForegroundHandler();

function DynamicStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />;
}

SplashScreen.preventAutoHideAsync().catch(() => {});

const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID || "";
const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;

function RootLayoutContent() {
  const systemScheme = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    readInitialNotificationHref()
      .then((href) => {
        if (!mounted || !href) return;
        router.push(href as any);
      })
      .catch(() => null);
    const sub = addNotificationResponseListener((href) => {
      router.push(href as any);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [router]);

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID}
      config={{
        embedded: {
          solana: { createOnLogin: 'users-without-wallets' },
        },
      }}
    >
      <View style={{ flex: 1, backgroundColor: systemScheme === 'dark' ? MONO_PALETTE[950] : MONO_PALETTE[50] }}>
        <QueryProvider>
          <ThemeProvider>
            <DynamicStatusBar />
            <AuthProvider>
              <OfflineBanner />
              <UserProvider>
                <ViewModeProvider>
                  <Slot />
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'box-none', zIndex: 9999, elevation: 9999 }}>
                    <ToastManager config={toastConfig} position="top" topOffset={60} animationInTiming={50} />
                  </View>
                </ViewModeProvider>
              </UserProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
      </View>
    </PrivyProvider>
  );
}

function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_600SemiBold,
  });

  useEffect(() => {
    setAppIsReady(true);
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && (fontsLoaded || fontError)) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady, fontsLoaded, fontError]);

  if (!appIsReady || (!fontsLoaded && !fontError)) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <RootLayoutContent />
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

export default RootLayout;
