import React from 'react';
import { View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SheetOptionRow } from './SheetOptionRow';
import { SORT_BY_OPTIONS, type SortBy } from './filterTypes';

interface Props {
  visible: boolean;
  value: SortBy;
  onChange: (next: SortBy) => void;
  onClose: () => void;
}

export function SortBySheet({ visible, value, onChange, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Sort by" height={340}>
      {({ close }) => (
        <View style={{ gap: 4 }}>
          {SORT_BY_OPTIONS.map((o) => (
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
        </View>
      )}
    </BottomSheet>
  );
}
