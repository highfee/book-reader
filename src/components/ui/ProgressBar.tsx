import React from 'react';
import { View, StyleSheet } from 'react-native';

interface ProgressBarProps {
  progress: number; // 0 to 100
  color?: string;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color = '#4F46E5', // indigo-600
  height = 4,
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <View style={[styles.container, { height }]}>
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
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 999,
  },
});
