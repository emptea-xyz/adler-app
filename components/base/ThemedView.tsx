import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/utils/cn';
import { useTheme } from '@/contexts/ThemeContext';

type ThemedViewProps = ViewProps & {
  /** Custom CSS class string */
  className?: string;
};

/**
 * ThemedView - Styled view component.
 * Applies theme-aware background color.
 */
export function ThemedView({ className, style, ...otherProps }: ThemedViewProps) {
  const { theme } = useTheme();
  return (
    <View
      className={cn(className)}
      style={[{ backgroundColor: theme[50] }, style]}
      {...otherProps}
    />
  );
}
