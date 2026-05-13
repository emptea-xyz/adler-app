import React from 'react';
import {
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  StyleProp,
  TextStyle,
} from 'react-native';
import { cn } from '@/lib/utils/cn';
import { useTheme } from '@/contexts/ThemeContext';

interface NumberInputProps extends Omit<RNTextInputProps, 'keyboardType'> {
  /** Additional CSS classes */
  className?: string;
  /** Optional additional styles */
  inputStyle?: StyleProp<TextStyle>;
}

export function NumberInput({
  className,
  inputStyle,
  ...props
}: NumberInputProps) {
  const { theme } = useTheme();
  return (
    <RNTextInput
      keyboardType="decimal-pad"
      className={cn("font-geist bg-transparent border-0 p-0", className)}
      style={[
        {
          fontSize: 72,
          lineHeight: 88,
          height: 96,
          paddingVertical: 0,
          color: theme[900],
          textAlign: 'right',
          includeFontPadding: false,
        },
        inputStyle,
      ]}
      placeholder="0"
      placeholderTextColor={theme[300]}
      {...props}
    />
  );
}