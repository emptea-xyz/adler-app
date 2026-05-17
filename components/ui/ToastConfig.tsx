import React from "react";
import { Pressable, View } from "react-native";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils/cn";
import { ThemedText } from "@/components/base/ThemedText";
import { Status } from "@/constants/StatusColors";
import { Neutral } from "@/constants/NeutralColors";
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
    { icon: IconName; accent: string }
  > = {
    success: { icon: "checkmark.circle.fill", accent: Status.success },
    error: { icon: "xmark.circle.fill", accent: Status.error },
    info: { icon: "info.circle.fill", accent: Status.info },
    warn: { icon: "exclamationmark.triangle.fill", accent: Status.warning },
  };

  const meta = variantStyles[variant];
  const closeTint = theme[400];

  return (
    <Pressable
      onPress={onPress}
      style={{
        zIndex: 10000,
        backgroundColor: theme[50],
        shadowColor: Neutral.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 6,
      }}
      className={cn(
        "w-[90%] min-h-[72px] px-5 py-4 rounded-[24px] flex-row items-center self-center"
      )}
    >
      <View className="mr-3">
        <Icon name={meta.icon} size={22} color={meta.accent} />
      </View>
      <View className="flex-1">
        {text1 ? (
          <ThemedText type="body-lg" className="font-semibold">
            {text1}
          </ThemedText>
        ) : null}
        {text2?.trim() ? (
          <ThemedText type="body-md" className="mt-1 font-semibold opacity-80">
            {text2}
          </ThemedText>
        ) : null}
      </View>
      <Pressable onPress={hide} hitSlop={8} className="ml-3 p-1">
        <Icon name="xmark" size={16} color={closeTint} weight="semibold" />
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
