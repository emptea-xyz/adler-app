import React from 'react';
import { ScrollView } from 'react-native';
import { SheetOptionRow } from '@/components/features/browse/SheetOptionRow';
import { CATEGORY_OPTIONS } from '@/components/features/browse/filterTypes';

const CREATE_CATEGORIES = CATEGORY_OPTIONS.filter(
  (o): o is { id: string; label: string } => o.id !== null,
);

interface Props {
  value: string;
  onSelect: (id: string) => void;
}

export function CreateCategoryStep({ value, onSelect }: Props) {
  return (
    <ScrollView contentContainerStyle={{ gap: 4 }} showsVerticalScrollIndicator={false}>
      {CREATE_CATEGORIES.map((o) => (
        <SheetOptionRow
          key={o.id}
          label={o.label}
          selected={value === o.id}
          onPress={() => onSelect(o.id)}
        />
      ))}
    </ScrollView>
  );
}
