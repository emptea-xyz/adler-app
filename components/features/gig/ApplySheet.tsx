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
  applyToGig,
  listApplicationsByCreator,
} from '@/lib/services/applicationService';
import { APPLICATION_KEYS } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import type { Gig } from '@/types/marketplace';

interface Props {
  visible: boolean;
  onClose: () => void;
  gig: Gig | null;
}

const MESSAGE_MAX = 1000;

export function ApplySheet({ visible, onClose, gig }: Props) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Block re-application client-side. The user can still race a duplicate by
  // tapping Submit twice fast — the proper fix is a deterministic doc id
  // (`${gigId}_${creatorId}`) backed by a uniqueness rule, but that's a v2
  // migration. Today's guard catches >99% of cases.
  const myApplicationsQuery = useQuery({
    queryKey: user ? APPLICATION_KEYS.byCreator(user.id) : ['applications', 'creator', 'anon'],
    enabled: !!user && visible,
    queryFn: () => listApplicationsByCreator(user!.id),
  });
  const alreadyApplied = !!gig && (myApplicationsQuery.data ?? []).some(
    (a) => a.gigId === gig.id,
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
        await applyToGig({ gigId: gig.id, message: message.trim(), sampleUrls: [] });
        queryClient.invalidateQueries({ queryKey: APPLICATION_KEYS.forGig(gig.id) });
        if (user) {
          queryClient.invalidateQueries({ queryKey: APPLICATION_KEYS.byCreator(user.id) });
        }
        haptic('medium');
        toast.success('Application submitted');
        closeFn();
      } catch (err: any) {
        toast.error(err?.message ?? 'Failed to apply');
        setSubmitting(false);
      }
    },
    [gig, message, alreadyApplied, queryClient, user],
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
