import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { useTheme } from '@/contexts/ThemeContext';
import { submitReview } from '@/lib/services/reviewsService';
import { qk } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import { RATING_AXES, type RatingAxes, type RatingAxis } from '@/lib/types/review';

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
  const [axes, setAxes] = useState<RatingAxes>({
    scope: 0,
    communication: 0,
    timeliness: 0,
    quality: 0,
  });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const allRated = RATING_AXES.every((axis) => axes[axis] >= 1);

  useEffect(() => {
    if (!visible) {
      setAxes({ scope: 0, communication: 0, timeliness: 0, quality: 0 });
      setComment('');
      setSubmitting(false);
    }
  }, [visible]);

  const setAxis = (axis: RatingAxis, value: number) => {
    setAxes((prev) => ({ ...prev, [axis]: value }));
  };

  const submit = useCallback(
    async (closeFn: () => void) => {
      if (!allRated) {
        toast.error('Rate all four categories');
        return;
      }
      setSubmitting(true);
      try {
        await submitReview({ orderId, revieweeId, axes, comment: comment.trim() });
        queryClient.invalidateQueries({ queryKey: ['reviews', 'forOrder', orderId] });
        queryClient.invalidateQueries({ queryKey: qk.reviews.byReviewee(revieweeId) });
        haptic('heavy');
        toast.success('Review submitted');
        closeFn();
      } catch (err: any) {
        toast.error(err?.message ?? 'Failed to submit');
        setSubmitting(false);
      }
    },
    [allRated, axes, comment, orderId, queryClient, revieweeId],
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

          <View style={{ gap: 12 }}>
            {RATING_AXES.map((axis) => (
              <View key={axis} style={{ gap: 6 }}>
                <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                  {axis.charAt(0).toUpperCase() + axis.slice(1)}
                </ThemedText>
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={`${axis}-${n}`}
                      onPress={() => {
                        haptic('light');
                        setAxis(axis, n);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${axis} ${n} star${n === 1 ? '' : 's'}`}
                      hitSlop={6}
                    >
                      <Star
                        size={28}
                        color={n <= axes[axis] ? theme[950] : theme[300]}
                        fill={n <= axes[axis] ? theme[950] : 'transparent'}
                        strokeWidth={2}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
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
            disabled={submitting || !allRated}
            variant="primary"
            size="lg"
            className="w-full"
          />
          <Button
            title="Skip"
            onPress={() => close()}
            disabled={submitting}
            variant="secondary"
            size="lg"
            className="w-full"
          />
        </View>
      )}
    </BottomSheet>
  );
}
