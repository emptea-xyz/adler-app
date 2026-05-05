import React, { useCallback, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import EmptyState from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { KPI } from '@/components/ui/KPI';
import { Pill, type PillIntent } from '@/components/ui/Pill';
import { CtaFooter } from '@/components/ui/CtaFooter';
import { ApplySheet } from '@/components/features/gig/ApplySheet';
import { AwardConfirmSheet } from '@/components/features/gig/AwardConfirmSheet';
import { ManageListingSheet } from '@/components/features/listing/ManageListingSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getGig, updateGigStatus } from '@/lib/services/gigService';
import { formatSol } from '@/lib/utils/formatNumber';
import { getProfile } from '@/lib/services/profileService';
import {
  listApplicationsForGig,
  updateApplicationStatus,
} from '@/lib/services/applicationService';
import { useSolanaPayment } from '@/hooks/useSolanaPayment';
import { GIG_KEYS, APPLICATION_KEYS, PROFILE_KEYS } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import { EMPTY_GIG_APPLICATIONS } from '@/lib/utils/copy';
import type { GigApplication, Gig, GigStatus, ApplicationStatus } from '@/types/marketplace';

function gigStatusIntent(status: GigStatus): PillIntent {
  if (status === 'open') return 'cyan';
  if (status === 'awarded') return 'lime';
  return 'neutral';
}

function applicationStatusIntent(status: ApplicationStatus): PillIntent {
  if (status === 'awarded') return 'lime';
  if (status === 'shortlisted') return 'cyan';
  return 'neutral';
}

interface AwardTarget {
  applicationId: string;
  creatorId: string;
  recipientLabel: string;
}

function ApplicationCard({
  application,
  gig,
  onAwardPress,
  awardingId,
  onPressCreator,
}: {
  application: GigApplication;
  gig: Gig;
  onAwardPress: (target: AwardTarget) => void;
  awardingId: string | null;
  onPressCreator: (creatorId: string) => void;
}) {
  const { theme } = useTheme();
  const profileQuery = useQuery({
    queryKey: PROFILE_KEYS.profile(application.creatorId),
    queryFn: () => getProfile(application.creatorId),
  });

  const recipientLabel = profileQuery.data?.displayName ?? `@${profileQuery.data?.username ?? 'creator'}`;
  const awarding = awardingId === application.id;
  const disabled = !!awardingId || gig.status !== 'open';

  return (
    <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          onPress={() => onPressCreator(application.creatorId)}
          style={{ flex: 1, gap: 2 }}
          hitSlop={6}
        >
          <ThemedText type="body-md-semibold" style={{ color: theme[950] }} numberOfLines={1}>
            {profileQuery.data?.displayName ?? '—'}
          </ThemedText>
          <ThemedText type="body-sm" style={{ color: theme[500] }} numberOfLines={1}>
            @{profileQuery.data?.username ?? '—'}
          </ThemedText>
        </Pressable>
        <Pill intent={applicationStatusIntent(application.status)} label={application.status} />
      </View>
      <ThemedText type="body-md" style={{ color: theme[950] }} numberOfLines={4}>
        {application.message}
      </ThemedText>
      {application.status === 'pending' && (
        <Button
          title={`Award ${formatSol(gig.budgetSol)} SOL`}
          onPress={() => onAwardPress({ applicationId: application.id, creatorId: application.creatorId, recipientLabel })}
          loading={awarding}
          disabled={disabled}
          variant="primary"
          size="sm"
          className="self-start"
        />
      )}
    </View>
  );
}

export default function GigDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { profile } = useUser();
  const { theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { pay } = useSolanaPayment();

  const [applySheet, setApplySheet] = useState(false);
  const [awardTarget, setAwardTarget] = useState<AwardTarget | null>(null);
  const [awardingId, setAwardingId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const gigQuery = useQuery({
    queryKey: id ? GIG_KEYS.detail(id) : ['gig', 'unknown'],
    enabled: !!id,
    queryFn: () => getGig(id!),
  });

  const brandQuery = useQuery({
    queryKey: gigQuery.data ? PROFILE_KEYS.profile(gigQuery.data.brandId) : ['profile', 'unknown'],
    enabled: !!gigQuery.data?.brandId,
    queryFn: () => getProfile(gigQuery.data!.brandId),
  });

  const gig = gigQuery.data;
  const isCreator = profile?.role === 'creator';
  const isOwnGig = !!user && gig?.brandId === user.id;

  const applicationsQuery = useQuery({
    queryKey: id ? APPLICATION_KEYS.forGig(id) : ['applications', 'gig', 'unknown'],
    enabled: !!id && !!user && !!gig && gig.brandId === user.id,
    queryFn: () => listApplicationsForGig(id!),
  });

  const confirmAward = useCallback(async () => {
    if (!gig || !awardTarget) return;
    haptic('medium');
    setAwardingId(awardTarget.applicationId);
    try {
      const { signature } = await pay({
        type: 'gig',
        referenceId: gig.id,
        sellerId: awardTarget.creatorId,
        amountSol: gig.budgetSol,
      });
      await updateApplicationStatus(awardTarget.applicationId, 'awarded');
      await updateGigStatus(gig.id, 'awarded');
      queryClient.invalidateQueries({ queryKey: GIG_KEYS.detail(gig.id) });
      queryClient.invalidateQueries({ queryKey: APPLICATION_KEYS.forGig(gig.id) });
      haptic('heavy');
      toast.success(`Awarded · tx ${signature.slice(0, 8)}…`);
      setAwardTarget(null);
    } catch (err: any) {
      toast.error(err?.message ?? 'Award failed');
    } finally {
      setAwardingId(null);
    }
  }, [gig, awardTarget, pay, queryClient]);

  const showApplyCta = !!gig && isCreator && !isOwnGig && gig.status === 'open';
  const showApplications = !!gig && isOwnGig;
  const applications = applicationsQuery.data ?? [];

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
              {/* KPI block */}
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
                    <Pill intent="pink" label="Gig" />
                  </View>
                </View>
                <ThemedText type="h4" style={{ color: theme[950] }} numberOfLines={3}>
                  {gig.title}
                </ThemedText>
              </View>

              {/* Brief */}
              <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 8 }}>
                <SectionLabel label="Brief" />
                <ThemedText type="body-md" style={{ color: theme[950] }}>
                  {gig.description}
                </ThemedText>
              </View>

              {/* Requirements */}
              {!!gig.requirements && (
                <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 8 }}>
                  <SectionLabel label="Requirements" />
                  <ThemedText type="body-md" style={{ color: theme[950] }}>
                    {gig.requirements}
                  </ThemedText>
                </View>
              )}

              {/* Brand — tap to open public profile */}
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

              {isCreator && !isOwnGig && gig.status !== 'open' && (
                <ThemedText type="body-sm" align="center" style={{ color: theme[500] }}>
                  This gig is no longer open for applications.
                </ThemedText>
              )}

              {/* Applications (brand viewing own gig) */}
              {showApplications && (
                <View style={{ gap: 12 }}>
                  <SectionLabel label={`Applications · ${applications.length}`} />
                  {applicationsQuery.isLoading ? (
                    <ActivityIndicator color={theme[500]} />
                  ) : applications.length === 0 ? (
                    <View style={{ paddingTop: 16 }}>
                      <EmptyState
                        title={EMPTY_GIG_APPLICATIONS.title}
                        description={EMPTY_GIG_APPLICATIONS.description}
                      />
                    </View>
                  ) : (
                    applications.map((app) => (
                      <ApplicationCard
                        key={app.id}
                        application={app}
                        gig={gig}
                        onAwardPress={setAwardTarget}
                        awardingId={awardingId}
                        onPressCreator={(creatorId) => router.push(`/profile/${creatorId}`)}
                      />
                    ))
                  )}
                </View>
              )}
            </ScrollView>

            {showApplyCta && (
              <CtaFooter>
                <Button
                  title="Apply to gig"
                  onPress={() => {
                    haptic('light');
                    setApplySheet(true);
                  }}
                  variant="primary"
                  size="lg"
                  className="w-full"
                />
              </CtaFooter>
            )}
          </>
        )}
      </SafeAreaView>

      <ApplySheet
        visible={applySheet}
        onClose={() => setApplySheet(false)}
        gig={gig ?? null}
      />

      <AwardConfirmSheet
        visible={!!awardTarget}
        onClose={() => {
          if (!awardingId) setAwardTarget(null);
        }}
        onConfirm={confirmAward}
        amount={gig?.budgetSol ?? 0}
        recipientLabel={awardTarget?.recipientLabel ?? ''}
        submitting={!!awardingId}
      />

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
    </ThemedView>
  );
}
