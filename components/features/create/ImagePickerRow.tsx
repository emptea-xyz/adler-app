import React from 'react';
import { Pressable, View, Image, ScrollView, ActivityIndicator } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { Neutral } from '@/constants/NeutralColors';
import { haptic } from '@/lib/utils/haptic';
import { pickImages } from '@/lib/services/imageUploadService';
import { toast } from '@/lib/utils/toast';

const TILE = 88;
const DEFAULT_MAX = 5;

interface Props {
  values: string[];
  onChange: (next: string[]) => void;
  /** Maximum number of images allowed in this row. Defaults to 5. */
  max?: number;
  /** Disable interaction while a parent flow is submitting. */
  disabled?: boolean;
}

export function ImagePickerRow({ values, onChange, max = DEFAULT_MAX, disabled = false }: Props) {
  const { theme } = useTheme();
  const [picking, setPicking] = React.useState(false);

  const onAdd = async () => {
    if (disabled || picking) return;
    if (values.length >= max) return;
    haptic('light');
    setPicking(true);
    try {
      const remaining = max - values.length;
      const picked = await pickImages({ selectionLimit: remaining, quality: 0.8 });
      if (picked.length > 0) {
        onChange([...values, ...picked.slice(0, remaining)]);
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not pick images');
    } finally {
      setPicking(false);
    }
  };

  const onRemove = (index: number) => {
    if (disabled) return;
    haptic('light');
    onChange(values.filter((_, i) => i !== index));
  };

  const canAdd = values.length < max;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
    >
      {values.map((uri, i) => (
        <View
          key={`${uri}-${i}`}
          style={{
            width: TILE,
            height: TILE,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: theme[100],
            position: 'relative',
          }}
        >
          <Image
            source={{ uri }}
            style={{ width: TILE, height: TILE }}
            resizeMode="cover"
          />
          <Pressable
            onPress={() => onRemove(i)}
            hitSlop={12}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Remove photo ${i + 1}`}
            accessibilityState={{ disabled }}
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: 'rgba(0,0,0,0.6)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={14} color={Neutral.white} />
          </Pressable>
        </View>
      ))}

      {canAdd ? (
        <Pressable
          onPress={onAdd}
          disabled={disabled || picking}
          accessibilityRole="button"
          accessibilityLabel="Add photos"
          accessibilityState={{ disabled: disabled || picking, busy: picking }}
          style={{
            width: TILE,
            height: TILE,
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme[300],
            backgroundColor: theme[50],
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {picking ? (
            <ActivityIndicator size="small" color={theme[500]} />
          ) : (
            <>
              <Plus size={20} color={theme[500]} strokeWidth={2} />
              <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                Add
              </ThemedText>
            </>
          )}
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
