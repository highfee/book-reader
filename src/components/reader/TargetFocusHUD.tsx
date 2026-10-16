import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Target, Pencil, Crosshair, EyeOff, Sparkles, Gauge } from 'lucide-react-native';
import { AppPalette } from '@/constants/theme';
import { GoalSettingsModal } from '@/components/stats/GoalSettingsModal';
import { ReadingNotificationService } from '@/services/notifications/readingNotificationService';
import { useDraggableFloating } from '@/hooks/useDraggableFloating';
import { ReadingGoals } from '@/types/book';

interface TargetFocusHUDProps {
  goals: ReadingGoals;
  /** Seconds already credited to today from persisted sessions, excluding the live session. */
  todayBaseSeconds: number;
  /** Idle-aware seconds accumulated by the current reading session. */
  sessionElapsedSeconds: number;
  onSaveGoals: (goals: ReadingGoals) => Promise<void>;
  onClose?: () => void;
}

const HUB_SIZE = 56;
const PANEL_WIDTH = 252;
const SERIF = Platform.select({ web: '"Georgia", "Charter", serif', default: 'serif' });
const MIN_GOAL_MINUTES = 5;
const MAX_GOAL_MINUTES = 600;
const AUTO_COLLAPSE_MS = 25000;

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function ProgressRing({
  size,
  strokeWidth,
  progress,
  color,
  children,
}: {
  size: number;
  strokeWidth: number;
  progress: number;
  color: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function TargetFocusHUD({
  goals,
  todayBaseSeconds,
  sessionElapsedSeconds,
  onSaveGoals,
  onClose,
}: TargetFocusHUDProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGoalModalVisible, setIsGoalModalVisible] = useState(false);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [panelHeight, setPanelHeight] = useState(206);

  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);

  const showCelebration = useCallback((message: string) => {
    setCelebration(message);
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    celebrationTimer.current = setTimeout(() => setCelebration(null), 6000);
  }, []);

  const targetMinutes = Math.max(1, goals.dailyMinutes || 20);
  const targetSeconds = targetMinutes * 60;
  const totalSeconds = Math.max(0, todayBaseSeconds) + Math.max(0, sessionElapsedSeconds);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const progress = Math.max(0, Math.min(1, totalSeconds / targetSeconds));
  const percentComplete = Math.round(progress * 100);
  const remainingSeconds = Math.max(0, targetSeconds - totalSeconds);
  const isGoalReached = totalSeconds >= targetSeconds;
  const accent = isGoalReached ? AppPalette.accentGreen : AppPalette.accentBerry;

  const { pan, panHandlers, pressScale, pressIn, releasePress, isDragging, edge, swapEdge } =
    useDraggableFloating({
      storageKey: 'target_hud_position',
      widgetWidth: HUB_SIZE,
      widgetHeight: HUB_SIZE,
      defaultPosition: (screen) => ({ x: 16, y: Math.max(96, screen.height - 200) }),
      minTop: 64,
      bottomInset: 28,
      onDismiss: onClose,
    });

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isGoalReached) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isGoalReached, pulse]);

  useEffect(() => {
    return () => {
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    };
  }, []);

  useEffect(() => {
    if (isGoalReached) return;
    ReadingNotificationService.checkMilestoneCrossed(targetMinutes, totalMinutes);
  }, [isGoalReached, targetMinutes, totalMinutes]);

  useEffect(() => {
    const unsubscribe = ReadingNotificationService.subscribe((event) => {
      showCelebration(`${event.title} ${event.body}`);
    });
    return unsubscribe;
  }, [showCelebration]);

  const expandAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: false,
      friction: isExpanded ? 6 : 8,
      tension: isExpanded ? 55 : 62,
    }).start();
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    if (isExpanded) {
      collapseTimer.current = setTimeout(() => setIsExpanded(false), AUTO_COLLAPSE_MS);
    }
  }, [isExpanded, expandAnim]);

  const keepPanelOpen = useCallback(() => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setIsExpanded(false), AUTO_COLLAPSE_MS);
  }, []);

  const toggleExpanded = () => {
    if (isDragging.current) return;
    const now = Date.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      swapEdge();
      return;
    }
    lastTap.current = now;
    setIsExpanded((prev) => !prev);
  };

  const nudgeGoal = (deltaMinutes: number) => {
    const next = Math.max(
      MIN_GOAL_MINUTES,
      Math.min(MAX_GOAL_MINUTES, targetMinutes + deltaMinutes)
    );
    if (next === targetMinutes) return;
    keepPanelOpen();
    onSaveGoals({ ...goals, dailyMinutes: next })
      .then(() => showCelebration(`🎯 Daily target set to ${formatMinutes(next)}.`))
      .catch(() => {});
  };

  const dockX = edge === 'right' ? -(PANEL_WIDTH - HUB_SIZE) : 0;
  const panelTranslateX = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, dockX] });
  const panelTranslateY = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(panelHeight + 12)],
  });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.6] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrapper, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
    >
      {Boolean(celebration) && !isExpanded && (
        <View style={styles.celebration} pointerEvents="auto">
          <Sparkles size={14} color={AppPalette.accentGold} style={styles.celebrationIcon} />
          <Text numberOfLines={3} style={styles.celebrationText}>
            {celebration}
          </Text>
        </View>
      )}

      <Animated.View
        pointerEvents={isExpanded ? 'auto' : 'none'}
        onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}
        style={[
          styles.panel,
          {
            opacity: expandAnim,
            transform: [{ translateX: panelTranslateX }, { translateY: panelTranslateY }],
          },
        ]}
      >
        <View style={styles.dragHandle} {...panHandlers}>
          <View style={styles.dragBar} />
          <Text style={styles.dragHint}>drag this bar to move · fling down to hide</Text>
        </View>

        <View style={styles.panelHeader}>
          <View style={[styles.panelBadge, isGoalReached && styles.panelBadgeComplete]}>
            <Target size={12} color={accent} />
          </View>
          <Text style={styles.panelTitle}>Daily target</Text>
          <Text style={[styles.panelPercent, { color: accent }]}>{percentComplete}%</Text>
        </View>

        <View style={styles.panelBody}>
          <ProgressRing size={76} strokeWidth={6} progress={progress} color={accent}>
            <Text style={styles.ringValue}>{totalMinutes}</Text>
            <Text style={styles.ringUnit}>min read</Text>
          </ProgressRing>

          <View style={styles.statsColumn}>
            <StatRow label="Goal" value={formatMinutes(targetMinutes)} />
            <StatRow
              label={isGoalReached ? 'Ahead by' : 'Remaining'}
              value={
                isGoalReached
                  ? formatClock(totalSeconds - targetSeconds)
                  : formatClock(remainingSeconds)
              }
              color={accent}
            />
            <StatRow label="Session" value={formatClock(sessionElapsedSeconds)} />
          </View>
        </View>

        <View style={styles.adjustRow}>
          <StepButton
            label="−5 min"
            onPress={() => nudgeGoal(-5)}
            disabled={targetMinutes <= MIN_GOAL_MINUTES}
          />
          <View style={styles.adjustCenter}>
            <Gauge size={12} color={AppPalette.textMuted} style={styles.adjustIcon} />
            <Text style={styles.adjustText}>{isGoalReached ? 'Target met' : 'Keep going'}</Text>
          </View>
          <StepButton
            label="+5 min"
            onPress={() => nudgeGoal(5)}
            disabled={targetMinutes >= MAX_GOAL_MINUTES}
          />
        </View>

        <View style={styles.panelFooter}>
          <PanelAction
            icon={<Pencil size={11} color={AppPalette.textSecondary} />}
            label="Edit goal"
            onPress={() => {
              setIsExpanded(false);
              setIsGoalModalVisible(true);
            }}
          />
          <PanelAction
            icon={<Crosshair size={11} color={AppPalette.textSecondary} />}
            label={`Move ${edge === 'right' ? 'left' : 'right'}`}
            onPress={() => {
              swapEdge();
              keepPanelOpen();
            }}
          />
          {onClose && (
            <PanelAction
              icon={<EyeOff size={11} color={AppPalette.textSecondary} />}
              label="Hide"
              onPress={onClose}
            />
          )}
        </View>
      </Animated.View>

      <View {...panHandlers}>
        <Animated.View style={{ transform: [{ scale: pressScale }] }}>
          {isGoalReached && !isExpanded && (
            <Animated.View
              pointerEvents="none"
              style={[styles.pulseRing, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
            />
          )}
          <TouchableOpacity
            style={[styles.hub, isGoalReached && styles.hubComplete]}
            onPress={toggleExpanded}
            onLongPress={() => {
              if (!isDragging.current) setIsGoalModalVisible(true);
            }}
            delayLongPress={380}
            onPressIn={pressIn}
            onPressOut={releasePress}
            activeOpacity={1}
            accessibilityLabel={
              isExpanded ? 'Collapse daily target panel' : 'Expand daily target panel'
            }
            accessibilityHint="Tap to expand, drag to move, double tap to swap sides, long press to edit the goal"
          >
            {isExpanded ? (
              <Text style={styles.hubClose}>×</Text>
            ) : (
              <ProgressRing size={HUB_SIZE - 8} strokeWidth={3} progress={progress} color={accent}>
                <Text style={[styles.hubMinutes, isGoalReached && styles.hubMinutesComplete]}>
                  {totalMinutes}
                </Text>
                <Text style={styles.hubUnit}>min</Text>
              </ProgressRing>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      <GoalSettingsModal
        visible={isGoalModalVisible}
        currentGoals={goals}
        onClose={() => setIsGoalModalVisible(false)}
        onSave={async (newGoals) => {
          await onSaveGoals(newGoals);
          setIsGoalModalVisible(false);
          showCelebration(`🎯 Target updated to ${formatMinutes(newGoals.dailyMinutes)}.`);
        }}
      />
    </Animated.View>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color && { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function StepButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.stepButton, disabled && styles.stepButtonDisabled]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <Text style={[styles.stepButtonText, disabled && styles.stepButtonTextDisabled]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PanelAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.panelAction} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <Text style={styles.panelActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1000,
  },
  celebration: {
    position: 'absolute',
    bottom: HUB_SIZE + 14,
    left: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: 250,
    backgroundColor: AppPalette.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.45)',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
  celebrationIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  celebrationText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    color: '#FDE68A',
    fontWeight: '600',
  },

  pulseRing: {
    position: 'absolute',
    width: HUB_SIZE + 14,
    height: HUB_SIZE + 14,
    top: -7,
    left: -7,
    borderRadius: (HUB_SIZE + 14) / 2,
    borderWidth: 2,
    borderColor: AppPalette.accentGreen,
  },
  hub: {
    width: HUB_SIZE,
    height: HUB_SIZE,
    borderRadius: HUB_SIZE / 2,
    backgroundColor: 'rgba(13, 14, 17, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
  hubComplete: {
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  hubMinutes: {
    fontSize: 15,
    fontWeight: '800',
    color: AppPalette.textPrimary,
    letterSpacing: -0.4,
    fontFamily: SERIF,
  },
  hubMinutesComplete: {
    color: AppPalette.accentGreen,
  },
  hubUnit: {
    fontSize: 8.5,
    fontWeight: '700',
    color: AppPalette.textMuted,
    letterSpacing: 0.6,
    marginTop: -1,
  },
  hubClose: {
    fontSize: 26,
    lineHeight: 28,
    color: AppPalette.textPrimary,
    fontWeight: '400',
  },

  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PANEL_WIDTH,
    backgroundColor: 'rgba(13, 14, 17, 0.97)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18,
    padding: 14,
    paddingTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 14,
  },
  dragHandle: {
    alignItems: 'center',
    marginBottom: 6,
    paddingVertical: 6,
  },
  dragBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  dragHint: {
    marginTop: 4,
    fontSize: 8.5,
    letterSpacing: 0.3,
    color: AppPalette.textMuted,
    textAlign: 'center',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  panelBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(216, 74, 106, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  panelBadgeComplete: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  panelTitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: AppPalette.textPrimary,
  },
  panelPercent: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  panelBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ringValue: {
    fontSize: 22,
    fontWeight: '800',
    color: AppPalette.textPrimary,
    letterSpacing: -0.8,
    fontFamily: SERIF,
  },
  ringUnit: {
    fontSize: 8.5,
    fontWeight: '700',
    color: AppPalette.textMuted,
    letterSpacing: 0.7,
    marginTop: -2,
  },
  statsColumn: {
    flex: 1,
    marginLeft: 14,
    gap: 7,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: AppPalette.textMuted,
  },
  statValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: AppPalette.textSecondary,
    maxWidth: 110,
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 6,
  },
  stepButton: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: 'rgba(216, 74, 106, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(216, 74, 106, 0.28)',
  },
  stepButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.07)',
  },
  stepButtonText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: AppPalette.accentBerry,
  },
  stepButtonTextDisabled: {
    color: AppPalette.textMuted,
  },
  adjustCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustIcon: {
    marginRight: 5,
  },
  adjustText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: AppPalette.textSecondary,
  },
  panelFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  panelAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: AppPalette.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 4,
  },
  panelActionText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: AppPalette.textSecondary,
  },
});
