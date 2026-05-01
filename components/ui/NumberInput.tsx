import React from 'react';
import {
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  StyleProp,
  TextStyle,
} from 'react-native';
import { cn } from '@/components/utils/cn';
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
      className={cn(
        "text-7xl font-geist text-center min-w-[100px] bg-transparent border-0 p-0 h-[96px]",
        className
      )}
      style={[{ lineHeight: 96, color: theme[900] }, inputStyle]}
      placeholder="0"
      placeholderTextColor={theme[500]}
      {...props}
    />
  );
}