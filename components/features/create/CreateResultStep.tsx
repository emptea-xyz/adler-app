import React from 'react';
import { View } from 'react-native';
import { AlertTriangle, Check } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { Button } from '@/components/ui/Button';
import { Status } from '@/constants/StatusColors';
import { useTheme } from '@/contexts/ThemeContext';

const HERO = 56;

interface SuccessProps {
  variant: 'success';
  kind: 'package' | 'gig';
  onView: () => void;
  onDone: () => void;
}

interface ErrorProps {
  variant: 'error';
  message: string;
  onRetry: () => void;
  onCancel: () => void;
}

type Props = SuccessProps | ErrorProps;

export function CreateResultStep(props: Props) {
  const { theme } = useTheme();

  if (props.variant === 'success') {
    const kindLabel = props.kind === 'package' ? 'Package' : 'Gig';
    return (
      <View style={{ gap: 20, alignItems: 'center', paddingTop: 12 }}>
        <View
          style={{
            width: HERO,
            height: HERO,
            borderRadius: HERO / 2,
            backgroundColor: Status.success,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={28} color="#fff" strokeWidth={3} />
        </View>
        <View style={{ gap: 6, alignItems: 'center' }}>
          <ThemedText type="h5" style={{ color: theme[950] }}>
            {kindLabel} listed
          </ThemedText>
          <ThemedText type="body-sm" align="center" style={{ color: theme[500] }}>
            It&apos;s live on the Marketplace right now.
          </ThemedText>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch' }}>
          <Button title="Done" onPress={props.onDone} variant="secondary" className="flex-1" />
          <Button title="View listing" onPress={props.onView} variant="primary" className="flex-1" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 20, alignItems: 'center', paddingTop: 12 }}>
      <View
        style={{
          width: HERO,
          height: HERO,
          borderRadius: HERO / 2,
          backgroundColor: Status.error,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AlertTriangle size={28} color="#fff" strokeWidth={2.5} />
      </View>
      <View style={{ gap: 6, alignItems: 'center' }}>
        <ThemedText type="h5" style={{ color: theme[950] }}>
          Something went wrong
        </ThemedText>
        <ThemedText type="body-sm" align="center" style={{ color: theme[500] }}>
          {props.message}
        </ThemedText>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch' }}>
        <Button title="Cancel" onPress={props.onCancel} variant="secondary" className="flex-1" />
        <Button title="Try again" onPress={props.onRetry} variant="primary" className="flex-1" />
      </View>
    </View>
  );
}
