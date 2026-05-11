import React from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { TailwindColors } from '@/constants/TailwindColors';
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

export type PillIntent =
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
}

export function Pill({ intent, label }: PillProps) {
  const { theme } = useTheme();

  let bg: string;
  let fg: string;

  switch (intent) {
    case 'accent':
      bg = TailwindColors.sky[100];
      fg = TailwindColors.sky[700];
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
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: Radius.full,
        alignSelf: 'flex-start',
      }}
    >
      <ThemedText type="caption-semibold" style={{ color: fg }}>
        {label}
      </ThemedText>
    </View>
  );
}
