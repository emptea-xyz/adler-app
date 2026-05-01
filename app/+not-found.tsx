import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';

export default function NotFoundScreen() {
  return (
    <ThemedView className="flex-1 items-center justify-center p-5">
      <ThemedText type="h2">This screen does not exist.</ThemedText>
    </ThemedView>
  );
}

