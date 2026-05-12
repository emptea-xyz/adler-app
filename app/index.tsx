import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { LoadingScreen } from '@/components/base/LoadingScreen';

/**
 * Two-state routing:
 *  - No Privy user        → /(auth)/sign-in
 *  - Privy user (any)     → /(home)/(tabs)/browse
 *
 * Profile bootstrap happens inside UserContext on first sign-in; the
 * profile doc has a default location: 'global', and the user can pick a
 * city from /settings/profile whenever.
 */
export default function IndexPage() {
  const { user, isReady, isBridging } = useAuth();
  const { loading: profileLoading } = useUser();

  if (!isReady || isBridging) return <LoadingScreen />;
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (profileLoading) return <LoadingScreen />;
  return <Redirect href="/(home)/(tabs)/browse" />;
}
