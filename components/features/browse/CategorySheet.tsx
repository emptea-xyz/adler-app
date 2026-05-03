import React from 'react';
import { ScrollView } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SheetOptionRow } from './SheetOptionRow';
import { CATEGORY_OPTIONS } from './filterTypes';

interface Props {
  visible: boolean;
  value: string | null;
  onChange: (next: string | null) => void;
  onClose: () => void;
}

export function CategorySheet({ visible, value, onChange, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Category" height={560}>
      {({ close }) => (
        <ScrollView
          contentContainerStyle={{ gap: 4 }}
          showsVerticalScrollIndicator={false}
        >
          {CATEGORY_OPTIONS.map((o) => (
            <SheetOptionRow
              key={o.label}
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
