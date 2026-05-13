import React from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/contexts/ThemeContext';
import { Status } from '@/constants/StatusColors';
import { Neutral } from '@/constants/NeutralColors';
import { Radius } from '@/constants/LayoutConstants';

// Figma node 116:132 — status / category pill.
//
// Intents:
//   accent  — neutral surface tinted by sky[100]/[700]; default category chip
//   neutral — quiet theme-aware filler
//   dark    — inverted high-emphasis (theme[950] bg, theme[50] text)
//   success / error / warning / info — semantic Status colors

type PillIntent =
  | 'accent'
  | 'neutral'
  | 'dark'
  | 'success'
  | 'error'
  | 'warning'
  | 'info';

interface PillProps {
  intent: PillIntent;
  label: string;
  icon?: IconName;
}

export function Pill({ intent, label, icon }: PillProps) {
  const { theme, tw } = useTheme();

  let bg: string;
  let fg: string;

  switch (intent) {
    case 'accent':
      bg = tw.sky[100];
      fg = tw.sky[700];
      break;
    case 'dark':
      bg = theme[950];
      fg = theme[50];
      break;
    case 'success':
      bg = Status.success;
      fg = Neutral.white;
      break;
    case 'error':
      bg = Status.error;
      fg = Neutral.white;
      break;
    case 'warning':
      bg = Status.warning;
      fg = Neutral.white;
      break;
    case 'info':
      bg = Status.info;
      fg = Neutral.white;
      break;
    case 'neutral':
    default:
      bg = theme[200];
      fg = theme[950];
      break;
  }

  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: icon ? 6 : 10,
        paddingVertical: icon ? 6 : 5,
        borderRadius: Radius.full,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon ? (
        <Icon name={icon} size={12} color={fg} weight="bold" />
      ) : (
        <ThemedText type="caption-semibold" style={{ color: fg }}>
          {label}
        </ThemedText>
      )}
    </View>
  );
}
