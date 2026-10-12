import {
  Vazirmatn_400Regular,
  Vazirmatn_500Medium,
  Vazirmatn_600SemiBold,
  Vazirmatn_700Bold,
  Vazirmatn_800ExtraBold,
  Vazirmatn_900Black,
} from '@expo-google-fonts/vazirmatn';
import type { FontSource } from 'expo-font';

/** Runtime font faces for web and iOS; Android uses its XML font-family resource. */
export const FONT_SOURCES: Record<string, FontSource> = {
  Vazirmatn: Vazirmatn_400Regular,
  'Vazirmatn-Medium': Vazirmatn_500Medium,
  'Vazirmatn-SemiBold': Vazirmatn_600SemiBold,
  'Vazirmatn-Bold': Vazirmatn_700Bold,
  'Vazirmatn-ExtraBold': Vazirmatn_800ExtraBold,
  'Vazirmatn-Black': Vazirmatn_900Black,
};
