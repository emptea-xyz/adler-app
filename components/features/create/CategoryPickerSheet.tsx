import React from 'react';
import { ScrollView } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SheetOptionRow } from '@/components/features/browse/SheetOptionRow';
import { CATEGORY_OPTIONS } from '@/components/features/browse/filterTypes';

// Picking a category is required on create — drop the "All categories" entry
// from the shared list (its id is null).
const CREATE_CATEGORIES = CATEGORY_OPTIONS.filter(
  (o): o is { id: string; label: string } => o.id !== null,
);

interface Props {
  visible: boolean;
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
}

export function CategoryPickerSheet({ visible, value, onChange, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Category" height={520}>
      {({ close }) => (
        <ScrollView
          contentContainerStyle={{ gap: 4 }}
          showsVerticalScrollIndicator={false}
        >
          {CREATE_CATEGORIES.map((o) => (
            <SheetOptionRow
              key={o.id}
              label={o.label}
              selected={value === o.id}
              onPress={() => {
                onChange(o.id);
                close();
              }}
            />
          ))}
        </ScrollView>
      )}
    </BottomSheet>
  );
}
