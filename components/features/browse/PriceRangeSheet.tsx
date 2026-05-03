import React from 'react';
import { View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SheetOptionRow } from './SheetOptionRow';
import { PRICE_RANGE_OPTIONS, type PriceRange } from './filterTypes';

interface Props {
  visible: boolean;
  value: PriceRange;
  onChange: (next: PriceRange) => void;
  onClose: () => void;
}

export function PriceRangeSheet({ visible, value, onChange, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Price range" height={380}>
      {({ close }) => (
        <View style={{ gap: 4 }}>
          {PRICE_RANGE_OPTIONS.map((o) => (
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
