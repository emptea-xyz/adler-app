import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { LoadingScreen } from '@/components/base/LoadingScreen';
import { STORAGE_KEYS } from '@/lib/constants/storageKeys';
import { viewModeFor } from '@/lib/utils/role';

/**
 * Root redirect. Four-state routing:
 *  - No Privy user                          → /(auth)/sign-in
 *  - Privy user, no role, intro unseen      → /(auth)/intro
 *  - Privy user, no role                    → /(auth)/role-select
 *  - Privy user with role                   → /(home)/(tabs)/browse
 */
export default function IndexPage() {
  const { user, isReady, isBridging } = useAuth();
  const { profile, loading: profileLoading } = useUser();
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_SEEN)
      .then((v) => setSeenOnboarding(v === 'true'))
      .catch(() => setSeenOnboarding(true)); // fail closed: don't loop the intro
  }, []);

  if (!isReady || isBridging || seenOnboarding === null) return <LoadingScreen />;
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (profileLoading) return <LoadingScreen />;
  if (viewModeFor(profile) === null) {
    // Step-1 routing still leans on the legacy role-select screen as a soft
    // first-run nudge. Step 2 deletes role-select and replaces it with an
    // inline <ProfileGate>, at which point the redirect collapses to
    // intro → /browse and the gate handles the rest.
    if (!seenOnboarding) return <Redirect href="/(auth)/intro" />;
    return <Redirect href="/(auth)/role-select" />;
  }
  return <Redirect href="/(home)/(tabs)/browse" />;
}
