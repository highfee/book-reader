import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppPalette } from '@/constants/theme';

interface ProgressBarProps {
  progress: number; // 0 to 100
  color?: string;
  height?: number;
  trackColor?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color = AppPalette.accentBerry,
  height = 4,
  trackColor = 'rgba(255, 255, 255, 0.1)',
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <View style={[styles.container, { height, backgroundColor: trackColor }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${clampedProgress}%`,
            backgroundColor: color,
            height,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 999,
  },
});
