import React, { useCallback, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import { createPackage } from '@/lib/services/packageService';
import { createGig } from '@/lib/services/gigService';
import { FEED_KEYS, PACKAGE_KEYS, GIG_KEYS } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';

export default function CreateScreen() {
  const { profile } = useUser();
  const { theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('general');
  const [requirements, setRequirements] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isCreator = profile?.role === 'creator';

  const submit = useCallback(async () => {
    const parsed = parseFloat(amount);
    if (!title.trim() || !description.trim() || isNaN(parsed) || parsed <= 0) {
      toast.error('Fill in title, description, and a valid SOL amount');
      return;
    }

    setSubmitting(true);
    try {
      let id: string;
      if (isCreator) {
        id = await createPackage({
          title: title.trim(),
          description: description.trim(),
          priceSol: parsed,
          deliverables: [],
          mediaUrls: [],
          category,
        });
        queryClient.invalidateQueries({ queryKey: FEED_KEYS.browse() });
        if (profile?.id) {
          queryClient.invalidateQueries({ queryKey: PACKAGE_KEYS.bySeller(profile.id) });
        }
        toast.success('Package listed');
        router.push(`/package/${id}`);
      } else {
        id = await createGig({
          title: title.trim(),
          description: description.trim(),
          budgetSol: parsed,
          deadline: null,
          requirements: requirements.trim(),
          category,
        });
        queryClient.invalidateQueries({ queryKey: FEED_KEYS.browse() });
        if (profile?.id) {
          queryClient.invalidateQueries({ queryKey: GIG_KEYS.byBrand(profile.id) });
        }
        toast.success('Gig posted');
        router.push(`/gig/${id}`);
      }
      setTitle('');
      setDescription('');
      setAmount('');
      setRequirements('');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to publish');
    } finally {
      setSubmitting(false);
    }
  }, [amount, title, description, requirements, category, isCreator, queryClient, profile?.id, router]);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
            <ThemedText type="h3">
              {isCreator ? 'List a package' : 'Post a gig'}
            </ThemedText>
            <ThemedText type="body-sm" className="mt-1 mb-6" style={{ color: theme[500] }}>
              {isCreator
                ? 'Describe what brands will receive and the SOL price.'
                : 'Describe what you need and your budget in SOL.'}
            </ThemedText>

            <View className="gap-4">
              <View>
                <ThemedText type="caption-semibold" style={{ color: theme[500] }} className="mb-1">
                  TITLE
                </ThemedText>
                <TextInput value={title} onChangeText={setTitle} placeholder="Short and descriptive" />
              </View>

              <View>
                <ThemedText type="caption-semibold" style={{ color: theme[500] }} className="mb-1">
                  DESCRIPTION
                </ThemedText>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What's included? What's the scope?"
                  multiline
                />
              </View>

              <View>
                <ThemedText type="caption-semibold" style={{ color: theme[500] }} className="mb-1">
                  {isCreator ? 'PRICE (SOL)' : 'BUDGET (SOL)'}
                </ThemedText>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.5"
                  keyboardType="decimal-pad"
                />
              </View>

              <View>
                <ThemedText type="caption-semibold" style={{ color: theme[500] }} className="mb-1">
                  CATEGORY
                </ThemedText>
                <TextInput value={category} onChangeText={setCategory} placeholder="general" />
              </View>

              {!isCreator && (
                <View>
                  <ThemedText type="caption-semibold" style={{ color: theme[500] }} className="mb-1">
                    REQUIREMENTS
                  </ThemedText>
                  <TextInput
                    value={requirements}
                    onChangeText={setRequirements}
                    placeholder="Vertical video, deliverables, deadline notes..."
                    multiline
                  />
                </View>
              )}
            </View>

            <View className="mt-8">
              <Button
                title={isCreator ? 'Publish package' : 'Publish gig'}
                onPress={submit}
                loading={submitting}
                disabled={submitting}
                variant="primary"
                size="lg"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}
