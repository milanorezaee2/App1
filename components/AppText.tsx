import React, { createContext, forwardRef, useContext, type ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { Typography } from '@/lib/theme';

type FontWeight = TextStyle['fontWeight'];
type TextDirection = 'auto' | 'ltr' | 'rtl';

type InheritedTextStyle = {
  fontFamily?: string;
  fontWeight?: FontWeight;
  fontSize?: number;
  lineHeight?: number;
  writingDirection?: TextDirection;
  textAlign?: TextStyle['textAlign'];
};

const TextStyleContext = createContext<InheritedTextStyle>({});
const PERSIAN_ARABIC_CHARACTERS = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const ANDROID_MIN_FONT_SIZE = 12;

const WEB_FONT_FAMILIES = {
  regular: 'Vazirmatn',
  medium: 'Vazirmatn-Medium',
  semiBold: 'Vazirmatn-SemiBold',
  bold: 'Vazirmatn-Bold',
  extraBold: 'Vazirmatn-ExtraBold',
  black: 'Vazirmatn-Black',
} as const;

function isVazirmatnFamily(fontFamily: string | undefined): boolean {
  return !fontFamily || fontFamily === Typography.fontFamily || fontFamily.startsWith('Vazirmatn-');
}

function weightFromFamily(fontFamily: string | undefined): FontWeight | undefined {
  if (!fontFamily) return undefined;
  if (fontFamily.endsWith('-Black')) return '900';
  if (fontFamily.endsWith('-ExtraBold')) return '800';
  if (fontFamily.endsWith('-Bold')) return '700';
  if (fontFamily.endsWith('-SemiBold')) return '600';
  if (fontFamily.endsWith('-Medium')) return '500';
  return undefined;
}

function familyForWeight(weight: FontWeight | undefined): string {
  const normalized = typeof weight === 'number'
    ? weight
    : weight === 'bold'
      ? 700
      : weight === 'normal' || weight === undefined
        ? 400
        : Number(weight);

  if (normalized >= 900) return WEB_FONT_FAMILIES.black;
  if (normalized >= 800) return WEB_FONT_FAMILIES.extraBold;
  if (normalized >= 700) return WEB_FONT_FAMILIES.bold;
  if (normalized >= 600) return WEB_FONT_FAMILIES.semiBold;
  if (normalized >= 500) return WEB_FONT_FAMILIES.medium;
  return WEB_FONT_FAMILIES.regular;
}

function hasPersianOrArabicText(node: ReactNode): boolean {
  if (typeof node === 'string' || typeof node === 'number') {
    return PERSIAN_ARABIC_CHARACTERS.test(String(node));
  }
  if (Array.isArray(node)) return node.some(hasPersianOrArabicText);
  if (React.isValidElement<{ children?: ReactNode }>(node)) {
    return hasPersianOrArabicText(node.props.children);
  }
  return false;
}

function normalizeTextStyle(
  style: StyleProp<TextStyle>,
  content: ReactNode,
  inherited: InheritedTextStyle,
): { style: TextStyle; inherited: InheritedTextStyle } {
  const flattened = StyleSheet.flatten(style) ?? {};
  const requestedFamily = flattened.fontFamily ?? inherited.fontFamily ?? Typography.fontFamily;
  const requestedWeight = flattened.fontWeight ?? inherited.fontWeight ?? weightFromFamily(requestedFamily) ?? '400';
  const usesVazirmatn = isVazirmatnFamily(requestedFamily);
  const direction = flattened.writingDirection ?? inherited.writingDirection ?? (hasPersianOrArabicText(content) ? 'rtl' : 'ltr');
  const textAlign = flattened.textAlign ?? inherited.textAlign ?? (direction === 'rtl' ? 'right' : 'left');
  const requestedFontSize = flattened.fontSize ?? inherited.fontSize ?? 14;
  const fontSize = Platform.OS === 'android'
    ? Math.max(requestedFontSize, ANDROID_MIN_FONT_SIZE)
    : requestedFontSize;
  const requestedLineHeight = flattened.lineHeight ?? inherited.lineHeight ?? Math.round(fontSize * 1.45);
  const lineHeight = Platform.OS === 'android'
    ? Math.max(requestedLineHeight, Math.ceil(fontSize * 1.3))
    : requestedLineHeight;

  // Android gets one native font family with real weight variants from expo-font's
  // config plugin. Web and iOS use one static Google Font face per weight.
  const fontFamily = usesVazirmatn
    ? Platform.OS === 'android' ? Typography.fontFamily : familyForWeight(requestedWeight)
    : requestedFamily;
  const fontWeight = usesVazirmatn && Platform.OS !== 'android' ? '400' : requestedWeight;

  const nextInherited: InheritedTextStyle = {
    fontFamily: requestedFamily,
    fontWeight: requestedWeight,
    fontSize,
    lineHeight,
    writingDirection: direction,
    textAlign,
  };

  return {
    inherited: nextInherited,
    style: {
      ...flattened,
      fontFamily,
      fontWeight,
      fontSize,
      lineHeight,
      writingDirection: direction,
      textAlign,
      ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
    },
  };
}

/**
 * All visible app text passes through this component so Android uses the
 * bundled Vazirmatn font faces instead of silently falling back to Roboto for
 * unsupported custom weights. It also gives Persian text deterministic RTL
 * shaping and removes Android's extra font padding without disabling scaling.
 */
export const Text = forwardRef<React.ElementRef<typeof NativeText>, TextProps>(function AppText(
  { children, style, ...props },
  ref,
) {
  const inherited = useContext(TextStyleContext);
  const normalized = normalizeTextStyle(style, children, inherited);

  return (
    <TextStyleContext.Provider value={normalized.inherited}>
      <NativeText {...props} ref={ref} style={normalized.style}>
        {children}
      </NativeText>
    </TextStyleContext.Provider>
  );
});

Text.displayName = 'Text';

/** TextInput counterpart for Persian forms; the supplied value still decides direction. */
export const TextInput = forwardRef<React.ElementRef<typeof NativeTextInput>, TextInputProps>(function AppTextInput(
  { style, value, defaultValue, placeholder, ...props },
  ref,
) {
  const directionContent = value ?? defaultValue ?? placeholder ?? '';
  const normalized = normalizeTextStyle(style, directionContent, {});

  return (
    <NativeTextInput
      {...props}
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      style={normalized.style}
    />
  );
});

TextInput.displayName = 'TextInput';
