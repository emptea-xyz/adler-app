import React from "react";
import { Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { cn } from "@/components/utils/cn";
import { ThemedText } from "@/components/base/ThemedText";
import { TailwindColors } from "@/constants/TailwindColors";
import { useTheme } from "@/contexts/ThemeContext";

type ToastVariant = "success" | "error" | "info" | "warn";

type ToastComponentProps = {
  text1?: string;
  text2?: string;
  hide: () => void;
  onPress?: () => void;
};


function ToastCard({
  text1,
  text2,
  hide,
  onPress,
  variant,
}: ToastComponentProps & { variant: ToastVariant }) {
  const { theme } = useTheme();

  const variantStyles: Record<
    ToastVariant,
    { icon: keyof typeof Feather.glyphMap; accent: string }
  > = {
    success: { icon: "check-circle", accent: TailwindColors.emerald[500] },
    error: { icon: "x-circle", accent: TailwindColors.rose[500] },
    info: { icon: "info", accent: TailwindColors.sky[500] },
    warn: { icon: "alert-triangle", accent: TailwindColors.orange[500] },
  };

  const meta = variantStyles[variant];
  const closeTint = theme[400];

  return (
    <Pressable
      onPress={onPress}
      style={{ zIndex: 10000, elevation: 10000, backgroundColor: theme[100], borderColor: theme[200] }}
      className={cn(
        "w-[90%] min-h-[72px] px-5 py-4 rounded-[24px] flex-row items-center self-center border"
      )}
    >
      <View className="mr-3">
        <Feather name={meta.icon} size={20} color={meta.accent} />
      </View>
      <View className="flex-1">
        {text1 ? (
          <ThemedText type="body-lg" className="font-semibold">
            {text1}
          </ThemedText>
        ) : null}
        {text2?.trim() ? (
          <ThemedText type="body-md" className="mt-1 opacity-80">
            {text2}
          </ThemedText>
        ) : null}
      </View>
      <Pressable onPress={hide} hitSlop={8} className="ml-3 p-1">
        <Feather name="x" size={16} color={closeTint} />
      </Pressable>
    </Pressable>
  );
}

export const toastConfig = {
  success: (props: ToastComponentProps) => (
    <ToastCard variant="success" {...props} />
  ),
  error: (props: ToastComponentProps) => (
    <ToastCard variant="error" {...props} />
  ),
  info: (props: ToastComponentProps) => <ToastCard variant="info" {...props} />,
  warn: (props: ToastComponentProps) => <ToastCard variant="warn" {...props} />,
};
