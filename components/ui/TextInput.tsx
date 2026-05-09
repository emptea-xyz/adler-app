import React, { useState } from 'react';
import { TextInput as RNTextInput, TextInputProps as RNTextInputProps, View } from 'react-native';
import { cn } from '@/components/utils/cn';
import { Accent } from '@/constants/AccentColors';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Props for the TextInput component.
 * Extends standard TextInputProps with additional customization.
 */
type TextInputProps = RNTextInputProps & {
  /** Error state for validation feedback */
  error?: boolean;
  /** Custom CSS class string */
  className?: string;
  /** Container styling class */
  containerClassName?: string;
  /** Left icon component */
  leftIcon?: React.ReactNode;
  /** Right icon component */
  rightIcon?: React.ReactNode;
};

/**
 * A standardized TextInput component with consistent theming,
 * error states, icon support, and accessibility features.
 */
function TextInput({
  error = false,
  className,
  containerClassName,
  placeholderTextColor,
  style,
  leftIcon,
  rightIcon,
  onFocus,
  onBlur,
  ...props
}: TextInputProps) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <View className={cn("relative", containerClassName)}>
      {leftIcon && (
        <View className="absolute left-4 top-0 bottom-0 justify-center z-10 pointer-events-none">
          {leftIcon}
        </View>
      )}
      <RNTextInput
        className={cn(
          "font-geist text-[14px] leading-[20px] tracking-adler",
          "rounded-card px-4 py-[14px]",
          leftIcon ? "pl-12" : "",
          rightIcon ? "pr-12" : "",
          className
        )}
        style={[
          {
            backgroundColor: theme[100],
            color: theme[950],
            borderWidth: 1,
            borderColor: 'transparent',
          },
          isFocused && !error && { borderColor: theme[200] },
          error && { borderColor: Accent.pink, backgroundColor: `${Accent.pink}1a` },
          style,
        ]}
        placeholderTextColor={placeholderTextColor || theme[400]}
        accessibilityHint={error ? "This field has an error" : undefined}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
      {rightIcon && (
        <View className="absolute right-4 top-0 bottom-0 justify-center z-10 pointer-events-none">
          {rightIcon}
        </View>
      )}
    </View>
  );
}



export default TextInput;
