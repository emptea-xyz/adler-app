import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { applyToGig } from '@/lib/services/applicationService';
import { APPLICATION_KEYS } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import type { Gig } from '@/types/marketplace';

interface Props {
  visible: boolean;
  onClose: () => void;
  gig: Gig | null;
}

export function ApplySheet({ visible, onClose, gig }: Props) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    [gig, message, queryClient, user],
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
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Why are you the right fit?"
            multiline
            style={{ minHeight: 140, textAlignVertical: 'top' }}
          />
          <Button
            title="Submit application"
            onPress={() => submit(close)}
            loading={submitting}
            disabled={submitting}
            variant="primary"
            size="lg"
            className="w-full"
          />
        </View>
      )}
    </BottomSheet>
  );
}
