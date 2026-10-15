/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const AppPalette = {
  // Dark luxury editorial palette from the reference template
  background: '#0D0E11',
  surface: '#16181D',
  surfaceElevated: '#1F222A',
  surfaceCard: '#181A20',
  glassBg: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.14)',
  
  // Accents
  white: '#FFFFFF',
  accentBerry: '#D84A6A',
  accentBerryHover: '#C03856',
  accentBerryLight: 'rgba(216, 74, 106, 0.18)',
  accentGold: '#D97706',
  accentGreen: '#10B981',
  accentBlue: '#38BDF8',
  primaryPink: '#D84A6A',
  pinkLight: 'rgba(216, 74, 106, 0.18)',
  playGreen: '#10B981',

  
  // Typography
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textDark: '#0D0E11',
  
  // Pills & Badges
  pillActiveBg: '#FFFFFF',
  pillActiveText: '#0D0E11',
  pillInactiveBg: 'rgba(255, 255, 255, 0.07)',
  pillInactiveText: '#9CA3AF',
  pillInactiveBorder: 'rgba(255, 255, 255, 0.1)',
} as const;

export const Colors = {
  light: {
    text: '#FFFFFF',
    background: '#0D0E11',
    backgroundElement: '#16181D',
    backgroundSelected: '#1F222A',
    textSecondary: '#9CA3AF',
    primary: AppPalette.white,
    accent: AppPalette.accentBerry,
  },
  dark: {
    text: '#FFFFFF',
    background: '#0D0E11',
    backgroundElement: '#16181D',
    backgroundSelected: '#1F222A',
    textSecondary: '#9CA3AF',
    primary: AppPalette.white,
    accent: AppPalette.accentBerry,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
