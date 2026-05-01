import React, { useCallback, useState } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getGig, updateGigStatus } from '@/lib/services/gigService';
import { getProfile } from '@/lib/services/profileService';
import {
  applyToGig,
  listApplicationsForGig,
  updateApplicationStatus,
} from '@/lib/services/applicationService';
import { useSolanaPayment } from '@/hooks/useSolanaPayment';
import { GIG_KEYS, APPLICATION_KEYS, PROFILE_KEYS } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import { EMPTY_GIG_APPLICATIONS } from '@/lib/utils/copy';
import type { GigApplication, Gig } from '@/types/marketplace';

function ApplicationCard({
  application,
  gig,
  onAward,
  awarding,
  disabled,
}: {
  application: GigApplication;
  gig: Gig;
  onAward: () => void;
  awarding: boolean;
  disabled: boolean;
}) {
  const { theme } = useTheme();
  const profileQuery = useQuery({
    queryKey: PROFILE_KEYS.profile(application.creatorId),
    queryFn: () => getProfile(application.creatorId),
  });

  return (
    <Card>
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-1">
          <ThemedText type="body-md-semibold" numberOfLines={1}>
            {profileQuery.data?.displayName ?? '—'}
          </ThemedText>
          <ThemedText type="body-sm" style={{ color: theme[500] }} numberOfLines={1}>
            @{profileQuery.data?.username ?? '—'}
          </ThemedText>
        </View>
        <View
          className="px-2 py-0.5 rounded-full"
          style={{ backgroundColor: theme[100] }}
        >
          <ThemedText
            type="caption-semibold"
            style={{ color: theme[700], letterSpacing: 0.5 }}
          >
            {application.status.toUpperCase()}
          </ThemedText>
        </View>
      </View>
      <ThemedText type="body-md" numberOfLines={4}>
        {application.message}
      </ThemedText>
      {application.status === 'pending' && (
        <View className="mt-3">
          <Button
            title={`Award ${gig.budgetSol} SOL`}
            onPress={onAward}
            loading={awarding}
            disabled={disabled}
            variant="primary"
            size="sm"
          />
        </View>
      )}
    </Card>
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

  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [awardingId, setAwardingId] = useState<string | null>(null);

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

  const submitApplication = useCallback(async () => {
    if (!gig || !message.trim()) {
      toast.error('Write a short message about why you fit this gig');
      return;
    }
    setSubmitting(true);
    try {
      await applyToGig({ gigId: gig.id, message: message.trim(), sampleUrls: [] });
      queryClient.invalidateQueries({ queryKey: APPLICATION_KEYS.forGig(gig.id) });
      if (user) {
        queryClient.invalidateQueries({ queryKey: APPLICATION_KEYS.byCreator(user.id) });
      }
      setMessage('');
      haptic('medium');
      toast.success('Application submitted');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to apply');
    } finally {
      setSubmitting(false);
    }
  }, [gig, message, queryClient, user]);

  const award = useCallback(
    async (applicationId: string, creatorId: string) => {
      if (!gig) return;
      haptic('medium');
      setAwardingId(applicationId);
      try {
        const { signature } = await pay({
          type: 'gig',
          referenceId: gig.id,
          sellerId: creatorId,
          amountSol: gig.budgetSol,
        });
        await updateApplicationStatus(applicationId, 'awarded');
        await updateGigStatus(gig.id, 'awarded');
        queryClient.invalidateQueries({ queryKey: GIG_KEYS.detail(gig.id) });
        queryClient.invalidateQueries({ queryKey: APPLICATION_KEYS.forGig(gig.id) });
        haptic('heavy');
        toast.success(`Awarded · tx ${signature.slice(0, 8)}…`);
      } catch (err: any) {
        toast.error(err?.message ?? 'Award failed');
      } finally {
        setAwardingId(null);
      }
    },
    [gig, pay, queryClient],
  );

  const showApplyForm = !!gig && isCreator && !isOwnGig && gig.status === 'open';
  const showApplications = !!gig && isOwnGig;
  const applications = applicationsQuery.data ?? [];

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader title="Gig" onBack={() => router.back()} />

        {gigQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={theme[950]} />
          </View>
        ) : !gig ? (
          <View className="flex-1 items-center justify-center px-6">
            <ThemedText type="body-md" style={{ color: theme[500] }}>
              Gig not found.
            </ThemedText>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 8,
              paddingBottom: 32,
              gap: 16,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Top-left KPI: budget + unit. Status + kind label top-right. */}
            <View>
              <View className="flex-row items-baseline gap-2">
                <ThemedText type="h2" className="tracking-tight">
                  {gig.budgetSol}
                </ThemedText>
                <ThemedText type="body-md-semibold" style={{ color: theme[500] }}>
                  SOL
                </ThemedText>
                <View className="flex-1" />
                <ThemedText
                  type="caption-semibold"
                  style={{ color: theme[700], letterSpacing: 0.6 }}
                >
                  GIG · {gig.status.toUpperCase()}
                </ThemedText>
              </View>
              <ThemedText type="h4" className="mt-3">
                {gig.title}
              </ThemedText>
            </View>

            <Card>
              <ThemedText
                type="caption-semibold"
                style={{ color: theme[500], letterSpacing: 0.6 }}
              >
                BRIEF
              </ThemedText>
              <ThemedText type="body-md" className="mt-2">
                {gig.description}
              </ThemedText>
            </Card>

            {!!gig.requirements && (
              <Card>
                <ThemedText
                  type="caption-semibold"
                  style={{ color: theme[500], letterSpacing: 0.6 }}
                >
                  REQUIREMENTS
                </ThemedText>
                <ThemedText type="body-md" className="mt-2">
                  {gig.requirements}
                </ThemedText>
              </Card>
            )}

            <Card>
              <ThemedText
                type="caption-semibold"
                style={{ color: theme[500], letterSpacing: 0.6 }}
              >
                BRAND
              </ThemedText>
              <ThemedText type="body-md-semibold" className="mt-2">
                {brandQuery.data?.displayName ?? '—'}
              </ThemedText>
              <ThemedText type="body-sm" style={{ color: theme[500] }}>
                @{brandQuery.data?.username ?? '—'}
              </ThemedText>
            </Card>

            {showApplyForm && (
              <Card>
                <ThemedText
                  type="caption-semibold"
                  style={{ color: theme[500], letterSpacing: 0.6 }}
                >
                  APPLY
                </ThemedText>
                <View className="mt-2 gap-3">
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Why are you the right fit?"
                    multiline
                  />
                  <Button
                    title="Submit application"
                    onPress={submitApplication}
                    loading={submitting}
                    disabled={submitting}
                    variant="primary"
                  />
                </View>
              </Card>
            )}

            {isCreator && !isOwnGig && gig.status !== 'open' && (
              <ThemedText type="body-sm" align="center" style={{ color: theme[500] }}>
                This gig is no longer open for applications.
              </ThemedText>
            )}

            {showApplications && (
              <View className="gap-3">
                <ThemedText
                  type="caption-semibold"
                  style={{ color: theme[500], letterSpacing: 0.6 }}
                >
                  APPLICATIONS · {applications.length}
                </ThemedText>
                {applicationsQuery.isLoading ? (
                  <ActivityIndicator color={theme[500]} />
                ) : applications.length === 0 ? (
                  <View className="pt-4">
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
                      onAward={() => award(app.id, app.creatorId)}
                      awarding={awardingId === app.id}
                      disabled={!!awardingId || gig.status !== 'open'}
                    />
                  ))
                )}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
