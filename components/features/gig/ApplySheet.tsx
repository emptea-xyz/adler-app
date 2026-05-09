import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  createApplication,
  listApplicationsByCreator,
} from '@/lib/services/applicationsService';
import { createApplicationThread } from '@/lib/services/threadsService';
import { qk } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import { useUser } from '@/contexts/UserContext';
import type { Gig, GigApplication } from '@/types/marketplace';

interface Props {
  visible: boolean;
  onClose: () => void;
  gig: Gig | null;
}

const MESSAGE_MAX = 1000;
const SAMPLE_URL_MAX = 4;

function normalizeSampleUrls(values: string[]): { urls: string[]; error: string | null } {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      return { urls: [], error: 'Sample URLs must be valid links' };
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { urls: [], error: 'Sample URLs must start with http:// or https://' };
    }
    const normalized = parsed.toString();
    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      urls.push(normalized);
    }
  }

  if (urls.length > SAMPLE_URL_MAX) {
    return { urls: [], error: `Add up to ${SAMPLE_URL_MAX} sample URLs` };
  }

  return { urls, error: null };
}

function applyErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (/already applied/i.test(message)) return 'You have already applied to this gig';
  if (/permission|insufficient/i.test(message)) return 'Could not apply. Check your creator profile and try again.';
  return message || 'Failed to apply';
}

export function ApplySheet({ visible, onClose, gig }: Props) {
  const { user } = useAuth();
  const { profile } = useUser();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [sampleUrlInputs, setSampleUrlInputs] = useState<string[]>(
    Array.from({ length: SAMPLE_URL_MAX }, () => ''),
  );
  const [submitting, setSubmitting] = useState(false);

  // The deterministic doc id `${gigId}_${creatorId}` makes a server-side
  // double-apply guard — but we still surface the "already applied" state
  // here so the UI is honest. The Firestore rule rejects the second write.
  const myApplicationsQuery = useQuery({
    queryKey: user ? qk.applications.byCreator(user.id) : ['applications', 'byCreator', 'anon'],
    enabled: !!user && visible,
    queryFn: () => listApplicationsByCreator(user!.id),
  });
  const alreadyApplied = !!gig && (myApplicationsQuery.data ?? []).some(
    (a: GigApplication) => a.gigId === gig.id,
  );

  useEffect(() => {
    if (!visible) {
      setMessage('');
      setSampleUrlInputs(Array.from({ length: SAMPLE_URL_MAX }, () => ''));
      setSubmitting(false);
    }
  }, [visible]);

  const setSampleUrl = useCallback((index: number, value: string) => {
    setSampleUrlInputs((prev) => prev.map((row, i) => (i === index ? value : row)));
  }, []);

  const submit = useCallback(
    async (closeFn: () => void) => {
      if (!gig || !message.trim()) {
        toast.error('Write a short message about why you fit this gig');
        return;
      }
      if (!user?.id) {
        toast.error('Sign-in required');
        return;
      }
      if (!profile?.isCreator) {
        toast.error('Finish your creator profile before applying');
        return;
      }
      if (alreadyApplied) {
        toast.error('You have already applied to this gig');
        return;
      }
      if (message.trim().length > MESSAGE_MAX) {
        toast.error(`Message must be ${MESSAGE_MAX} characters or less`);
        return;
      }
      const normalizedSamples = normalizeSampleUrls(sampleUrlInputs);
      if (normalizedSamples.error) {
        toast.error(normalizedSamples.error);
        return;
      }
      setSubmitting(true);
      try {
        const applicationId = await createApplication({
          gigId: gig.id,
          brandId: gig.brandId,
          message: message.trim(),
          gigTitle: gig.title,
          brandHandle: gig.ownerHandle,
          brandDisplayName: gig.ownerDisplayName,
          creatorHandle: profile?.username ?? null,
          creatorDisplayName: profile?.displayName ?? null,
          creatorAvatarUrl: profile?.avatarUrl ?? null,
          sampleUrls: normalizedSamples.urls,
        });
        await createApplicationThread({
          applicationId,
          gigTitle: gig.title,
          pitchBody: message.trim(),
          creator: {
            uid: user.id,
            handle: profile?.username ?? null,
            displayName: profile?.displayName ?? null,
            avatarUrl: profile?.avatarUrl ?? null,
          },
          brand: {
            uid: gig.brandId,
            handle: gig.ownerHandle,
            displayName: gig.ownerDisplayName,
            avatarUrl: gig.ownerAvatarUrl,
          },
        }).catch(() => null);
        queryClient.invalidateQueries({ queryKey: ['applications', 'gig', gig.id] });
        if (user) {
          queryClient.invalidateQueries({ queryKey: qk.applications.byCreator(user.id) });
          queryClient.invalidateQueries({ queryKey: qk.threads.byParticipant(user.id) });
        }
        haptic('medium');
        toast.success('Application submitted');
        closeFn();
      } catch (err: any) {
        toast.error(applyErrorMessage(err));
        setSubmitting(false);
      }
    },
    [gig, message, alreadyApplied, queryClient, user, profile, sampleUrlInputs],
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Apply" height={440} keyboardAware>
      {({ close }) => (
        <View style={{ gap: 16 }}>
          {gig ? (
            <ThemedText type="body-sm" style={{ color: theme[500] }} numberOfLines={2}>
              {gig.title}
            </ThemedText>
          ) : null}
          {alreadyApplied ? (
            <ThemedText type="body-sm" style={{ color: theme[500] }}>
              You&apos;ve already applied to this gig — check Inbox › Applications for status.
            </ThemedText>
          ) : null}
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Why are you the right fit?"
            multiline
            maxLength={MESSAGE_MAX}
            style={{ minHeight: 140, textAlignVertical: 'top' }}
            editable={!alreadyApplied}
          />
          <View style={{ gap: 8 }}>
            <ThemedText type="body-sm" style={{ color: theme[500] }}>
              Sample URLs (optional, up to {SAMPLE_URL_MAX})
            </ThemedText>
            {sampleUrlInputs.map((value, index) => (
              <TextInput
                key={`sample-${index}`}
                value={value}
                onChangeText={(next) => setSampleUrl(index, next)}
                placeholder={`Sample URL ${index + 1}`}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!alreadyApplied}
              />
            ))}
          </View>
          <Button
            title={alreadyApplied ? 'Already applied' : 'Submit application'}
            onPress={() => submit(close)}
            loading={submitting}
            disabled={submitting || alreadyApplied}
            variant="primary"
            size="lg"
            className="w-full"
          />
        </View>
      )}
    </BottomSheet>
  );
}
