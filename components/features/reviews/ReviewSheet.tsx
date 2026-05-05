import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { useTheme } from '@/contexts/ThemeContext';
import { submitReview } from '@/lib/services/reviewService';
import { REVIEW_KEYS } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';

interface Props {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  revieweeId: string;
  revieweeLabel: string;
}

const COMMENT_MAX = 500;

export function ReviewSheet({ visible, onClose, orderId, revieweeId, revieweeLabel }: Props) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setRating(0);
      setComment('');
      setSubmitting(false);
    }
  }, [visible]);

  const submit = useCallback(
    async (closeFn: () => void) => {
      if (rating < 1) {
        toast.error('Pick at least one star');
        return;
      }
      setSubmitting(true);
      try {
        await submitReview({ orderId, revieweeId, rating, comment: comment.trim() });
        queryClient.invalidateQueries({ queryKey: REVIEW_KEYS.forOrder(orderId) });
        haptic('heavy');
        toast.success('Review submitted');
        closeFn();
      } catch (err: any) {
        toast.error(err?.message ?? 'Failed to submit');
        setSubmitting(false);
      }
    },
    [orderId, revieweeId, rating, comment, queryClient],
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Leave a review"
      height={520}
      keyboardAware
      dismissible={!submitting}
    >
      {({ close }) => (
        <View style={{ gap: 16 }}>
          <ThemedText type="body-sm" style={{ color: theme[500] }}>
            Rate your experience with {revieweeLabel}.
          </ThemedText>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => {
                  haptic('light');
                  setRating(n);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
                hitSlop={6}
              >
                <Star
                  size={36}
                  color={n <= rating ? theme[950] : theme[300]}
                  fill={n <= rating ? theme[950] : 'transparent'}
                  strokeWidth={2}
                />
              </Pressable>
            ))}
          </View>

          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Optional — what made it good (or not)?"
            multiline
            maxLength={COMMENT_MAX}
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />

          <Button
            title={submitting ? 'Submitting…' : 'Submit review'}
            onPress={() => submit(close)}
            loading={submitting}
            disabled={submitting || rating < 1}
            variant="primary"
            size="lg"
            className="w-full"
          />
        </View>
      )}
    </BottomSheet>
  );
}
