import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { LoadingScreen } from '@/components/base/LoadingScreen';
import { STORAGE_KEYS } from '@/lib/constants/storageKeys';

/**
 * Root redirect. Four-state routing:
 *  - No Privy user                               → /(auth)/sign-in
 *  - Privy user, dual-profile missing, intro new → /(auth)/onboarding/intro
 *  - Privy user, dual-profile missing            → /(auth)/onboarding/basics
 *  - Privy user with both profiles               → /(home)/(tabs)/browse
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
  if (!profile?.isCreator || !profile?.isBrand) {
    if (!seenOnboarding) return <Redirect href="/(auth)/onboarding/intro" />;
    return <Redirect href="/(auth)/onboarding/basics" />;
  }
  return <Redirect href="/(home)/(tabs)/browse" />;
}
