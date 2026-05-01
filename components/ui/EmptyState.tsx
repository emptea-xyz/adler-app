import React from 'react';
import { View, ViewStyle } from 'react-native';
import { cn } from '@/components/utils/cn';
import { ThemedText } from '@/components/base/ThemedText';
import { Button } from './Button';
import { useTheme } from '@/contexts/ThemeContext';

type EmptyStateProps = {
  /** Icon component to display */
  icon?: React.ReactNode;
  /** Main title text */
  title: string;
  /** Descriptive text below the title */
  description?: string;
  /** Action button configuration */
  action?: {
    title: string;
    onPress: () => void;
  };
  /** Custom styling for the container */
  className?: string;
  /** Custom styles */
  style?: ViewStyle;
};

/**
 * EmptyState component for displaying helpful messages when lists or data are empty.
 *
 * Features:
 * - Consistent styling with app design system
 * - Optional icon, title, description, and action button
 * - Centered layout with proper spacing
 * - Accessibility-friendly
 */
function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  style,
}: EmptyStateProps) {
  const { theme } = useTheme();
  return (
    <View
      className={cn(
        "flex-1 items-center justify-center py-12 px-6",
        className
      )}
      style={style}
    >
      {/* Icon */}
      {icon && (
        <View className="mb-6 opacity-60">
          {icon}
        </View>
      )}

      {/* Title */}
      <ThemedText
        type="h6"
        className="text-center mb-3"
      >
        {title}
      </ThemedText>

      {/* Description */}
      {description && (
        <ThemedText
          type="body-md"
          className="text-center mb-8 max-w-sm"
          style={{ color: theme[400] }}
        >
          {description}
        </ThemedText>
      )}

      {/* Action Button */}
      {action && (
        <Button
          title={action.title}
          onPress={action.onPress}
          className="min-w-[140px]"
        />
      )}
    </View>
  );
}

export default EmptyState;
