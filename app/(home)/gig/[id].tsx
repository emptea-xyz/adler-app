import React, { useCallback, useState } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getGig, updateGigStatus } from '@/lib/services/gigService';
import { getProfile } from '@/lib/services/profileService';
import { applyToGig, listApplicationsForGig, updateApplicationStatus } from '@/lib/services/applicationService';
import { useSolanaPayment } from '@/hooks/useSolanaPayment';
import { GIG_KEYS, APPLICATION_KEYS, PROFILE_KEYS } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';

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

  const applicationsQuery = useQuery({
    queryKey: id ? APPLICATION_KEYS.forGig(id) : ['applications', 'gig', 'unknown'],
    enabled: !!id && !!user && !!gigQuery.data && gigQuery.data.brandId === user.id,
    queryFn: () => listApplicationsForGig(id!),
  });

  const gig = gigQuery.data;
  const isCreator = profile?.role === 'creator';
  const isOwnGig = !!user && gig?.brandId === user.id;

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
      toast.success('Application submitted');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to apply');
    } finally {
      setSubmitting(false);
    }
  }, [gig, message, queryClient, user]);

  const award = useCallback(async (applicationId: string, creatorId: string) => {
    if (!gig) return;
    try {
      // Pay first; only mark awarded if the transfer succeeds.
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
      toast.success(`Awarded · tx ${signature.slice(0, 8)}…`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Award failed');
    }
  }, [gig, pay, queryClient]);

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
          <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
            <View>
              <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                {gig.budgetSol} SOL · {gig.status.toUpperCase()}
              </ThemedText>
              <ThemedText type="h3" className="mt-1">
                {gig.title}
              </ThemedText>
            </View>

            <Card>
              <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                BRIEF
              </ThemedText>
              <ThemedText type="body-md" className="mt-2">
                {gig.description}
              </ThemedText>
              {!!gig.requirements && (
                <>
                  <ThemedText
                    type="caption-semibold"
                    style={{ color: theme[500] }}
                    className="mt-4"
                  >
                    REQUIREMENTS
                  </ThemedText>
                  <ThemedText type="body-md" className="mt-1">
                    {gig.requirements}
                  </ThemedText>
                </>
              )}
            </Card>

            <Card>
              <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                BRAND
              </ThemedText>
              <ThemedText type="body-md-semibold" className="mt-1">
                {brandQuery.data?.displayName ?? '—'}
              </ThemedText>
              <ThemedText type="body-sm" style={{ color: theme[500] }}>
                @{brandQuery.data?.username ?? '—'}
              </ThemedText>
            </Card>

            {isCreator && !isOwnGig && gig.status === 'open' && (
              <Card>
                <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
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

            {isOwnGig && gig.status === 'open' && (
              <View className="gap-3">
                <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                  APPLICATIONS
                </ThemedText>
                {(applicationsQuery.data ?? []).length === 0 ? (
                  <ThemedText type="body-sm" style={{ color: theme[500] }}>
                    No applications yet.
                  </ThemedText>
                ) : (
                  (applicationsQuery.data ?? []).map((app) => (
                    <Card key={app.id}>
                      <ThemedText type="body-md" numberOfLines={3}>
                        {app.message}
                      </ThemedText>
                      <View className="mt-3">
                        <Button
                          title={`Award ${gig.budgetSol} SOL`}
                          onPress={() => award(app.id, app.creatorId)}
                          variant="primary"
                          size="sm"
                        />
                      </View>
                    </Card>
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
