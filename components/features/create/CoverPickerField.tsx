import React from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { ImageIcon, X } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { haptic } from '@/lib/utils/haptic';
import { pickImage } from '@/lib/services/imageUploadService';
import { toast } from '@/lib/utils/toast';

interface Props {
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
  /** Aspect ratio for the rendered tile. Defaults to 16/9. */
  aspectRatio?: number;
}

export function CoverPickerField({ value, onChange, disabled = false, aspectRatio = 16 / 9 }: Props) {
  const { theme } = useTheme();
  const [picking, setPicking] = React.useState(false);

  const onPick = async () => {
    if (disabled || picking) return;
    haptic('light');
    setPicking(true);
    try {
      const uri = await pickImage({ quality: 0.85 });
      if (uri) onChange(uri);
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not pick image');
    } finally {
      setPicking(false);
    }
  };

  const onClear = () => {
    if (disabled) return;
    haptic('light');
    onChange(null);
  };

  if (value) {
    return (
      <Pressable
        onPress={onPick}
        disabled={disabled || picking}
        accessibilityRole="button"
        accessibilityLabel="Replace cover image"
        style={{
          width: '100%',
          aspectRatio,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: theme[100],
          position: 'relative',
        }}
      >
        <Image
          source={{ uri: value }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
        <Pressable
          onPress={onClear}
          hitSlop={12}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Remove cover image"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: 'rgba(0,0,0,0.65)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={16} color="#fff" />
        </Pressable>
        {picking ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(0,0,0,0.35)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator color="#fff" />
          </View>
        ) : null}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPick}
      disabled={disabled || picking}
      accessibilityRole="button"
      accessibilityLabel="Add cover image"
      accessibilityState={{ disabled: disabled || picking, busy: picking }}
      style={{
        width: '100%',
        aspectRatio,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme[300],
        backgroundColor: theme[50],
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {picking ? (
        <ActivityIndicator color={theme[500]} />
      ) : (
        <>
          <ImageIcon size={28} color={theme[500]} strokeWidth={1.75} />
          <ThemedText type="body-sm-semibold" style={{ color: theme[500] }}>
            Add cover image
          </ThemedText>
          <ThemedText type="caption-semibold" style={{ color: theme[400] }}>
            Shown as the hero on cards & detail
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}
