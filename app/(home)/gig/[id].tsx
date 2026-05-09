import React, { useState } from 'react';
import { View, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Button } from '@/components/ui/Button';
import { KPI } from '@/components/ui/KPI';
import { Pill, type PillIntent } from '@/components/ui/Pill';
import { CtaFooter } from '@/components/ui/CtaFooter';
import { ManageListingSheet } from '@/components/features/listing/ManageListingSheet';
import { ApplySheet } from '@/components/features/gig/ApplySheet';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getListing } from '@/lib/services/listingsService';
import { formatSol } from '@/lib/utils/formatNumber';
import { getProfile } from '@/lib/services/profileService';
import { qk } from '@/lib/constants/queryKeys';
import { viewModeFor } from '@/lib/utils/role';
import type { Gig, GigStatus } from '@/types/marketplace';

function gigStatusIntent(status: GigStatus): PillIntent {
  if (status === 'open') return 'cyan';
  if (status === 'awarded') return 'lime';
  return 'neutral';
}

export default function GigDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { profile } = useUser();
  const { theme } = useTheme();
  const router = useRouter();

  const [manageOpen, setManageOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  const gigQuery = useQuery({
    queryKey: id ? qk.listings.detail('gig', id) : ['listings', 'detail', 'gig', 'unknown'],
    enabled: !!id,
    queryFn: () => getListing('gig', id!),
  });

  const gig = gigQuery.data && gigQuery.data.kind === 'gig' ? (gigQuery.data as Gig) : null;

  const brandQuery = useQuery({
    queryKey: gig ? qk.profiles.detail(gig.brandId) : ['profiles', 'detail', 'unknown'],
    enabled: !!gig?.brandId,
    queryFn: () => getProfile(gig!.brandId),
  });

  const isCreator = viewModeFor(profile) === 'creator';
  const isOwnGig = !!user && gig?.brandId === user.id;
  const showApplyCta = !!gig && isCreator && !isOwnGig && gig.status === 'open';

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader
          title="Gig"
          onBack={() => router.back()}
          actionButton={
            isOwnGig && gig
              ? {
                  icon: MoreHorizontal,
                  onPress: () => setManageOpen(true),
                  accessibilityLabel: 'Manage gig',
                }
              : undefined
          }
        />

        {gigQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={theme[950]} />
          </View>
        ) : !gig ? (
          <View className="flex-1 items-center justify-center px-4">
            <ThemedText type="body-md" style={{ color: theme[500] }}>
              Gig not found.
            </ThemedText>
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 8,
                paddingBottom: showApplyCta ? 134 : 32,
                gap: 16,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ gap: 12 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                  }}
                >
                  <KPI size="md" amount={formatSol(gig.budgetSol)} unit="SOL" />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pill intent={gigStatusIntent(gig.status)} label={gig.status} />
                    {gig.escrowPda ? <Pill intent="lime" label="Funded" /> : null}
                    <Pill intent="pink" label="Gig" />
                  </View>
                </View>
                <ThemedText type="h4" style={{ color: theme[950] }} numberOfLines={3}>
                  {gig.title}
                </ThemedText>
              </View>

              <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 8 }}>
                <SectionLabel label="Brief" />
                <ThemedText type="body-md" style={{ color: theme[950] }}>
                  {gig.description}
                </ThemedText>
              </View>

              {!!gig.requirements && (
                <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 8 }}>
                  <SectionLabel label="Requirements" />
                  <ThemedText type="body-md" style={{ color: theme[950] }}>
                    {gig.requirements}
                  </ThemedText>
                </View>
              )}

              <Pressable
                onPress={() => {
                  if (!gig.brandId) return;
                  router.push(`/profile/${gig.brandId}`);
                }}
                style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 4 }}
              >
                <SectionLabel label="Brand" />
                <ThemedText type="body-md-semibold" style={{ color: theme[950] }}>
                  {brandQuery.data?.displayName ?? '—'}
                </ThemedText>
                <ThemedText type="body-sm" style={{ color: theme[500] }}>
                  @{brandQuery.data?.username ?? '—'}
                </ThemedText>
              </Pressable>

              {isOwnGig ? (
                <Button
                  title="View applicants"
                  variant="secondary"
                  onPress={() => router.push(`/applicants?gigId=${gig.id}`)}
                />
              ) : null}

              {isCreator && !isOwnGig && gig.status !== 'open' && (
                <ThemedText type="body-sm" align="center" style={{ color: theme[500] }}>
                  This gig is no longer open for applications.
                </ThemedText>
              )}
            </ScrollView>

            {showApplyCta && (
              <CtaFooter helperText="Share your pitch and sample links.">
                <Button
                  title="Apply now"
                  onPress={() => setApplyOpen(true)}
                  variant="primary"
                  size="lg"
                  className="w-full"
                />
              </CtaFooter>
            )}
          </>
        )}
      </SafeAreaView>

      {gig && isOwnGig ? (
        <ManageListingSheet
          visible={manageOpen}
          onClose={() => setManageOpen(false)}
          kind="gig"
          id={gig.id}
          status={gig.status}
          ownerId={gig.brandId}
        />
      ) : null}
      {!isOwnGig ? (
        <ApplySheet visible={applyOpen} onClose={() => setApplyOpen(false)} gig={gig} />
      ) : null}
    </ThemedView>
  );
}
