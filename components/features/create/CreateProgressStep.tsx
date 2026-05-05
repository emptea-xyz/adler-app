import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { TailwindColors } from '@/constants/TailwindColors';
import { useTheme } from '@/contexts/ThemeContext';

export type PublishTaskStatus = 'pending' | 'running' | 'done' | 'failed';

export interface PublishTask {
  id: string;
  label: string;
  status: PublishTaskStatus;
}

interface Props {
  tasks: PublishTask[];
}

const ICON_BOX = 28;

function StatusIcon({ status }: { status: PublishTaskStatus }) {
  const { theme } = useTheme();

  if (status === 'running') {
    return (
      <View style={{ width: ICON_BOX, height: ICON_BOX, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={theme[950]} />
      </View>
    );
  }
  if (status === 'done') {
    return (
      <View
        style={{
          width: ICON_BOX,
          height: ICON_BOX,
          borderRadius: ICON_BOX / 2,
          backgroundColor: TailwindColors.emerald[500],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Check size={16} color="#fff" strokeWidth={3} />
      </View>
    );
  }
  if (status === 'failed') {
    return (
      <View
        style={{
          width: ICON_BOX,
          height: ICON_BOX,
          borderRadius: ICON_BOX / 2,
          backgroundColor: TailwindColors.rose[500],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={16} color="#fff" strokeWidth={3} />
      </View>
    );
  }
  // pending
  return (
    <View
      style={{
        width: ICON_BOX,
        height: ICON_BOX,
        borderRadius: ICON_BOX / 2,
        borderWidth: 1.5,
        borderColor: theme[300],
      }}
    />
  );
}

export function CreateProgressStep({ tasks }: Props) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: 16, paddingTop: 4 }}>
      <ThemedText type="body-sm" style={{ color: theme[500] }}>
        Hang tight — this usually takes a few seconds.
      </ThemedText>

      <View style={{ gap: 14 }}>
        {tasks.map((t) => {
          const dim = t.status === 'pending';
          return (
            <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <StatusIcon status={t.status} />
              <ThemedText
                type={t.status === 'running' ? 'body-md-semibold' : 'body-md'}
                style={{ color: dim ? theme[400] : theme[950], flex: 1 }}
              >
                {t.label}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}
