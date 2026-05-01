import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { LoadingScreen } from '@/components/base/LoadingScreen';

/**
 * Root redirect. Three-state routing:
 *  - No Privy user        → /(auth)/sign-in
 *  - Privy user, no role  → /(auth)/role-select
 *  - Privy user with role → /(home)/(tabs)/browse
 */
export default function IndexPage() {
  const { user, isReady, isBridging } = useAuth();
  const { profile, loading: profileLoading } = useUser();

  if (!isReady || isBridging) return <LoadingScreen />;
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (profileLoading) return <LoadingScreen />;
  if (!profile?.role) return <Redirect href="/(auth)/role-select" />;
  return <Redirect href="/(home)/(tabs)/browse" />;
}
