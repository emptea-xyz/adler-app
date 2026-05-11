import React from 'react';
import type { ColorValue } from 'react-native';
import { SymbolView, type SFSymbol, type SymbolWeight } from 'expo-symbols';

export type IconName = SFSymbol;

interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorValue;
  weight?: SymbolWeight;
}

export function Icon({ name, size = 22, color, weight = 'semibold' }: IconProps) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
    />
  );
}
