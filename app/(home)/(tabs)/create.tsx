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
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

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
          <ScrollView
            contentContainerStyle={{
              paddingTop: 24,
              paddingHorizontal: 16,
              paddingBottom: TAB_BAR_HEIGHT + 32,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ gap: 4, marginBottom: 16 }}>
              <ThemedText type="h3" style={{ color: theme[950] }}>
                {isCreator ? 'List a package' : 'Post a gig'}
              </ThemedText>
              <ThemedText type="body-sm" style={{ color: theme[500] }}>
                {isCreator
                  ? 'Describe what brands will receive and the SOL price.'
                  : 'Describe what you need and your budget in SOL.'}
              </ThemedText>
            </View>

            <View style={{ gap: 16 }}>
              <Field label="Title">
                <TextInput value={title} onChangeText={setTitle} placeholder="Short and descriptive" />
              </Field>
              <Field label="Description">
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What's included? What's the scope?"
                  multiline
                  style={{ minHeight: 96, textAlignVertical: 'top' }}
                />
              </Field>
              <Field label={isCreator ? 'Price (SOL)' : 'Budget (SOL)'}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.5"
                  keyboardType="decimal-pad"
                />
              </Field>
              <Field label="Category">
                <TextInput value={category} onChangeText={setCategory} placeholder="general" />
              </Field>
              {!isCreator && (
                <Field label="Requirements">
                  <TextInput
                    value={requirements}
                    onChangeText={setRequirements}
                    placeholder="Vertical video, deliverables, deadline notes..."
                    multiline
                    style={{ minHeight: 96, textAlignVertical: 'top' }}
                  />
                </Field>
              )}
            </View>

            <View style={{ marginTop: 32 }}>
              <Button
                title={isCreator ? 'Publish package' : 'Publish gig'}
                onPress={submit}
                loading={submitting}
                disabled={submitting}
                variant="primary"
                size="lg"
                className="w-full"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}
