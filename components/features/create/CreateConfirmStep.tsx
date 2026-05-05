import React from 'react';
import { Image, View } from 'react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { Button } from '@/components/ui/Button';
import { KPI } from '@/components/ui/KPI';
import { useTheme } from '@/contexts/ThemeContext';
import { formatSol } from '@/lib/utils/formatNumber';

interface Props {
  kind: 'package' | 'gig';
  title: string;
  amountSol: number;
  category: string;
  coverUri: string | null;
  galleryCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CreateConfirmStep({
  kind,
  title,
  amountSol,
  category,
  coverUri,
  galleryCount,
  onConfirm,
  onCancel,
}: Props) {
  const { theme } = useTheme();
  const isPackage = kind === 'package';

  return (
    <View style={{ gap: 20 }}>
      {coverUri ? (
        <View
          style={{
            width: '100%',
            aspectRatio: 16 / 9,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: theme[100],
          }}
        >
          <Image source={{ uri: coverUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <KPI size="md" amount={formatSol(amountSol)} unit="SOL" />
        <ThemedText type="h5" style={{ color: theme[950] }} numberOfLines={2}>
          {title}
        </ThemedText>
        <ThemedText type="body-sm" style={{ color: theme[500] }}>
          {isPackage ? 'Package' : 'Gig'} · {category}
          {isPackage && galleryCount > 0 ? ` · ${galleryCount} gallery image${galleryCount === 1 ? '' : 's'}` : ''}
        </ThemedText>
      </View>

      <ThemedText type="body-sm" style={{ color: theme[500] }}>
        {isPackage
          ? 'Your package will go live on the Marketplace immediately. You can pause or remove it later from its detail page.'
          : 'Your gig will go live on the Marketplace immediately. Creators can apply right away.'}
      </ThemedText>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button title="Back" onPress={onCancel} variant="secondary" className="flex-1" />
        <Button title="Confirm" onPress={onConfirm} variant="primary" className="flex-1" />
      </View>
    </View>
  );
}
