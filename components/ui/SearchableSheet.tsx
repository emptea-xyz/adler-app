import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import TextInput from '@/components/ui/TextInput';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';

export interface SearchableSheetOption {
    label: string;
    value: string;
    group?: string;
}

interface SearchableSheetProps {
    visible: boolean;
    title: string;
    options: readonly SearchableSheetOption[];
    value: string | null;
    placeholder?: string;
    onSelect: (value: string) => void;
    onClose: () => void;
}

export function SearchableSheet({
    visible,
    title,
    options,
    value,
    placeholder = 'Search',
    onSelect,
    onClose,
}: SearchableSheetProps) {
    const { theme } = useTheme();
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((option) => {
            return (
                option.label.toLowerCase().includes(q) ||
                option.group?.toLowerCase().includes(q)
            );
        });
    }, [options, query]);

    return (
        <BottomSheet
            visible={visible}
            onClose={onClose}
            title={title}
            height={620}
            keyboardAware
        >
            <View style={{ gap: 14 }}>
                <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={placeholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    style={{ maxHeight: 480 }}
                    contentContainerStyle={{ paddingBottom: 24 }}
                >
                    {filtered.map((option, index) => {
                        const selected = option.value === value;
                        const previous = filtered[index - 1];
                        const showGroup = option.group && option.group !== previous?.group;
                        return (
                            <View key={option.value}>
                                {showGroup ? (
                                    <ThemedText
                                        type="caption-semibold"
                                        style={{
                                            color: theme[500],
                                            marginTop: index === 0 ? 0 : 14,
                                            marginBottom: 6,
                                        }}
                                    >
                                        {option.group}
                                    </ThemedText>
                                ) : null}
                                <Pressable
                                    onPress={() => {
                                        onSelect(option.value);
                                        onClose();
                                    }}
                                    accessibilityRole="button"
                                    accessibilityState={selected ? { selected: true } : {}}
                                    style={{
                                        minHeight: 48,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        borderBottomWidth: 1,
                                        borderBottomColor: theme[100],
                                    }}
                                >
                                    <ThemedText type="body-md-semibold" style={{ color: theme[950] }}>
                                        {option.label}
                                    </ThemedText>
                                    {selected ? <Check size={18} color={theme[950]} /> : null}
                                </Pressable>
                            </View>
                        );
                    })}
                    {filtered.length === 0 ? (
                        <View style={{ minHeight: 96, justifyContent: 'center' }}>
                            <ThemedText type="body-sm" align="center" style={{ color: theme[500] }}>
                                No matches
                            </ThemedText>
                        </View>
                    ) : null}
                </ScrollView>
            </View>
        </BottomSheet>
    );
}
