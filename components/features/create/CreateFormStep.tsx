import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { TailwindColors } from '@/constants/TailwindColors';
import { useTheme } from '@/contexts/ThemeContext';
import { CATEGORY_OPTIONS } from '@/components/features/browse/filterTypes';
import { haptic } from '@/lib/utils/haptic';
import { parseSolAmount } from '@/lib/utils/formatNumber';
import { CoverPickerField } from './CoverPickerField';
import { ImagePickerRow } from './ImagePickerRow';

const TITLE_MAX = 80;
const TITLE_MIN = 3;
const DESCRIPTION_MAX = 1000;
const DESCRIPTION_MIN = 10;
const REQUIREMENTS_MAX = 1000;
const AMOUNT_MAX_LEN = 10;
const PRICE_MAX_SOL = 10000;
const GALLERY_MAX = 5;

export interface FormState {
  title: string;
  description: string;
  amount: string;
  category: string;
  requirements: string;
  coverUri: string | null;
  mediaUris: string[];
}

export interface FormSetters {
  setTitle: (v: string) => void;
  setDescription: (v: string) => void;
  setAmount: (v: string) => void;
  setRequirements: (v: string) => void;
  setCoverUri: (v: string | null) => void;
  setMediaUris: (v: string[]) => void;
}

interface FormErrors {
  title?: string;
  description?: string;
  amount?: string;
  cover?: string;
  wallet?: string;
}

export function validatePackageForm(
  state: FormState,
  opts: { isCreator: boolean; walletReady: boolean },
): { valid: boolean; errors: FormErrors } {
  const errors: FormErrors = {};
  const titleLen = state.title.trim().length;
  if (titleLen < TITLE_MIN) errors.title = `At least ${TITLE_MIN} characters`;
  else if (titleLen > TITLE_MAX) errors.title = `At most ${TITLE_MAX} characters`;

  const descLen = state.description.trim().length;
  if (descLen < DESCRIPTION_MIN) errors.description = `At least ${DESCRIPTION_MIN} characters`;
  else if (descLen > DESCRIPTION_MAX) errors.description = `At most ${DESCRIPTION_MAX} characters`;

  const parsed = parseSolAmount(state.amount);
  if (parsed === null || parsed <= 0) errors.amount = 'Enter a valid SOL amount';
  else if (parsed > PRICE_MAX_SOL) errors.amount = `At most ${PRICE_MAX_SOL} SOL`;

  if (opts.isCreator && !state.coverUri) errors.cover = 'Add a cover image';
  if (opts.isCreator && !opts.walletReady) errors.wallet = 'Set up your wallet to receive payments';

  return { valid: Object.keys(errors).length === 0, errors };
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
          {label}
        </ThemedText>
        {hint ? (
          <ThemedText type="caption-semibold" style={{ color: theme[400] }}>
            {hint}
          </ThemedText>
        ) : null}
      </View>
      {children}
      {error ? (
        <ThemedText type="caption-semibold" style={{ color: TailwindColors.rose[500] }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

function CategoryRow({ value, onPress }: { value: string; onPress: () => void }) {
  const { theme } = useTheme();
  const label = CATEGORY_OPTIONS.find((o) => o.id === value)?.label ?? value;
  return (
    <Pressable
      onPress={() => {
        haptic('light');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Category: ${label}`}
      accessibilityHint="Opens the category picker"
      style={{
        backgroundColor: theme[100],
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <ThemedText type="body-md" style={{ color: theme[950] }}>
        {label}
      </ThemedText>
      <ChevronDown size={16} color={theme[500]} />
    </Pressable>
  );
}

interface Props {
  isCreator: boolean;
  state: FormState;
  setters: FormSetters;
  walletReady: boolean;
  submitAttempted: boolean;
  onPickCategory: () => void;
  onSubmit: () => void;
}

export function CreateFormStep({
  isCreator,
  state,
  setters,
  walletReady,
  submitAttempted,
  onPickCategory,
  onSubmit,
}: Props) {
  const { theme } = useTheme();

  const { valid, errors } = useMemo(
    () => validatePackageForm(state, { isCreator, walletReady }),
    [state, isCreator, walletReady],
  );

  // Only show errors after the user has tried to submit, so they aren't yelled
  // at while still typing.
  const visibleErrors: FormErrors = submitAttempted ? errors : {};

  return (
    <ScrollView
      contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <ThemedText type="body-sm" style={{ color: theme[500] }}>
        {isCreator
          ? 'Describe what brands will receive and the SOL price.'
          : 'Describe what you need and your budget in SOL.'}
      </ThemedText>

      <Field label="Title" hint={`${state.title.trim().length}/${TITLE_MAX}`} error={visibleErrors.title}>
        <TextInput
          value={state.title}
          onChangeText={setters.setTitle}
          placeholder="Short and descriptive"
          maxLength={TITLE_MAX}
          error={!!visibleErrors.title}
        />
      </Field>

      <Field label="Description" hint={`${state.description.trim().length}/${DESCRIPTION_MAX}`} error={visibleErrors.description}>
        <TextInput
          value={state.description}
          onChangeText={setters.setDescription}
          placeholder="What's included? What's the scope?"
          multiline
          maxLength={DESCRIPTION_MAX}
          style={{ minHeight: 96, textAlignVertical: 'top' }}
          error={!!visibleErrors.description}
        />
      </Field>

      {isCreator ? (
        <>
          <Field label="Cover image" error={visibleErrors.cover}>
            <CoverPickerField value={state.coverUri} onChange={setters.setCoverUri} />
          </Field>
          <Field label="Gallery" hint={`${state.mediaUris.length}/${GALLERY_MAX}`}>
            <ImagePickerRow
              values={state.mediaUris}
              onChange={setters.setMediaUris}
              max={GALLERY_MAX}
            />
          </Field>
        </>
      ) : null}

      <Field label={isCreator ? 'Price (SOL)' : 'Budget (SOL)'} error={visibleErrors.amount}>
        <TextInput
          value={state.amount}
          onChangeText={setters.setAmount}
          placeholder="0.5"
          keyboardType="decimal-pad"
          maxLength={AMOUNT_MAX_LEN}
          error={!!visibleErrors.amount}
        />
      </Field>

      <Field label="Category">
        <CategoryRow value={state.category} onPress={onPickCategory} />
      </Field>

      {!isCreator ? (
        <Field label="Requirements" hint={`${state.requirements.trim().length}/${REQUIREMENTS_MAX}`}>
          <TextInput
            value={state.requirements}
            onChangeText={setters.setRequirements}
            placeholder="Vertical video, deliverables, deadline notes..."
            multiline
            maxLength={REQUIREMENTS_MAX}
            style={{ minHeight: 96, textAlignVertical: 'top' }}
          />
        </Field>
      ) : null}

      {visibleErrors.wallet ? (
        <ThemedText type="caption-semibold" style={{ color: TailwindColors.rose[500] }}>
          {visibleErrors.wallet}
        </ThemedText>
      ) : null}

      <Button
        title={isCreator ? 'Publish package' : 'Publish gig'}
        onPress={onSubmit}
        disabled={submitAttempted && !valid}
        variant="primary"
        size="lg"
        className="w-full"
      />
    </ScrollView>
  );
}
