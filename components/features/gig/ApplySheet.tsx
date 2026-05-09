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

export function ApplySheet({ visible, onClose, gig }: Props) {
  const { user } = useAuth();
  const { profile } = useUser();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
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
      setSubmitting(false);
    }
  }, [visible]);

  const submit = useCallback(
    async (closeFn: () => void) => {
      if (!gig || !message.trim()) {
        toast.error('Write a short message about why you fit this gig');
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
      setSubmitting(true);
      try {
        await createApplication({
          gigId: gig.id,
          brandId: gig.brandId,
          message: message.trim(),
          sampleUrls: [],
          gigTitle: gig.title,
          brandHandle: gig.ownerHandle,
          brandDisplayName: gig.ownerDisplayName,
          creatorHandle: profile?.username ?? null,
          creatorDisplayName: profile?.displayName ?? null,
          creatorAvatarUrl: profile?.avatarUrl ?? null,
        });
        queryClient.invalidateQueries({ queryKey: ['applications', 'gig', gig.id] });
        if (user) {
          queryClient.invalidateQueries({ queryKey: qk.applications.byCreator(user.id) });
        }
        haptic('medium');
        toast.success('Application submitted');
        closeFn();
      } catch (err: any) {
        toast.error(err?.message ?? 'Failed to apply');
        setSubmitting(false);
      }
    },
    [gig, message, alreadyApplied, queryClient, user, profile],
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
