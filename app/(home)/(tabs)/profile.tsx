import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Settings, Wallet } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import Card from '@/components/ui/Card';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/lib/utils/toast';

function shortenAddress(address: string | null): string {
  if (!address) return '—';
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export default function ProfileScreen() {
  const { profile } = useUser();
  const { walletAddress } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const copyAddress = async () => {
    if (!walletAddress) return;
    await Clipboard.setStringAsync(walletAddress);
    toast.success('Wallet address copied');
  };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <View className="flex-row items-center justify-between mb-6">
            <ThemedText type="h3">Profile</ThemedText>
            <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
              <Settings color={theme[500]} size={22} />
            </Pressable>
          </View>

          <Card className="mb-4">
            <ThemedText type="body-lg-semibold">{profile?.displayName ?? '—'}</ThemedText>
            <ThemedText type="body-sm" style={{ color: theme[500] }}>
              @{profile?.username ?? '—'}
            </ThemedText>
            <View className="mt-3 flex-row items-center gap-2">
              <View
                className="px-2 py-1 rounded-full"
                style={{ backgroundColor: theme[100] }}
              >
                <ThemedText type="caption-semibold" style={{ color: theme[700] }}>
                  {profile?.role?.toUpperCase() ?? 'NO ROLE'}
                </ThemedText>
              </View>
            </View>
            {!!profile?.bio && (
              <ThemedText type="body-sm" className="mt-3" style={{ color: theme[700] }}>
                {profile.bio}
              </ThemedText>
            )}
          </Card>

          <Pressable onPress={copyAddress}>
            <Card>
              <View className="flex-row items-center gap-3">
                <Wallet color={theme[700]} size={20} />
                <View className="flex-1">
                  <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                    SOLANA WALLET (DEVNET)
                  </ThemedText>
                  <ThemedText type="body-md-semibold" className="mt-0.5">
                    {shortenAddress(walletAddress)}
                  </ThemedText>
                </View>
                <ThemedText type="body-sm" style={{ color: theme[500] }}>
                  Copy
                </ThemedText>
              </View>
            </Card>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
