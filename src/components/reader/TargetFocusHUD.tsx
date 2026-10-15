import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
} from 'react-native';
import {
  Target,
  CheckCircle2,
  Sparkles,
  Award,
  RotateCcw,
  X,
  Clock,
  Flame,
  ChevronUp,
} from 'lucide-react-native';
import { AppPalette, Fonts } from '@/constants/theme';
import { ReadingNotificationService } from '@/services/notifications/readingNotificationService';

interface TargetFocusHUDProps {
  dailyTargetMinutes: number;
  todayBaseMinutes: number;
  sessionElapsedSeconds?: number;
  onSprintGoalComplete?: () => void;
  onClose?: () => void;
}

export function TargetFocusHUD({
  dailyTargetMinutes,
  todayBaseMinutes,
  sessionElapsedSeconds: externalSessionSeconds,
  onSprintGoalComplete,
  onClose,
}: TargetFocusHUDProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [celebrationToast, setCelebrationToast] = useState<string | null>(null);
  const [localSeconds, setLocalSeconds] = useState(0);

  const [screenDim, setScreenDim] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setScreenDim(window);
    });
    return () => sub?.remove?.();
  }, []);

  // Internal 1-second timer to avoid forcing parent ReaderScreen to re-render
  useEffect(() => {
    const timer = setInterval(() => {
      setLocalSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const sessionElapsedSeconds = externalSessionSeconds !== undefined ? externalSessionSeconds : localSeconds;

  // Circular Hub Dimensions
  const HUB_SIZE = 58;

  // Default Position: Bottom-Left
  const getDefaultPosition = () => ({
    x: 16,
    y: Math.max(80, screenDim.height - 150),
  });

  const defaultPos = getDefaultPosition();
  const pan = useRef(new Animated.ValueXY({ x: defaultPos.x, y: defaultPos.y })).current;
  const lastOffsetRef = useRef({ x: defaultPos.x, y: defaultPos.y });
  const isDraggingRef = useRef(false);

  // Expansion Animation (Blooming radial float around hub)
  const expandAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isExpanded) {
      Animated.spring(expandAnim, {
        toValue: 1,
        useNativeDriver: false,
        friction: 6,
        tension: 50,
      }).start();
    } else {
      Animated.spring(expandAnim, {
        toValue: 0,
        useNativeDriver: false,
        friction: 8,
        tension: 60,
      }).start();
    }
  }, [isExpanded]);

  const [isRightHalf, setIsRightHalf] = useState(false);

  // Check if hub is situated in right half of screen
  const updateEdgeAffinity = (x: number) => {
    setIsRightHalf(x > (screenDim.width - HUB_SIZE) / 2);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => {
          return Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6;
        },
        onPanResponderGrant: () => {
          isDraggingRef.current = true;
          pan.setOffset({
            x: lastOffsetRef.current.x,
            y: lastOffsetRef.current.y,
          });
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: () => {
          pan.flattenOffset();
          const currentX = (pan.x as any)._value;
          const currentY = (pan.y as any)._value;

          // Clamp within screen boundaries
          const clampedX = Math.max(8, Math.min(currentX, screenDim.width - HUB_SIZE - 12));
          const clampedY = Math.max(48, Math.min(currentY, screenDim.height - HUB_SIZE - 40));

          Animated.spring(pan, {
            toValue: { x: clampedX, y: clampedY },
            useNativeDriver: false,
            friction: 7,
          }).start();

          lastOffsetRef.current = { x: clampedX, y: clampedY };
          updateEdgeAffinity(clampedX);
          setTimeout(() => {
            isDraggingRef.current = false;
          }, 150);
        },
      }),
    [screenDim.width, screenDim.height]
  );

  const handleResetPosition = () => {
    const pos = getDefaultPosition();
    Animated.spring(pan, {
      toValue: { x: pos.x, y: pos.y },
      useNativeDriver: false,
      friction: 7,
    }).start();
    lastOffsetRef.current = { x: pos.x, y: pos.y };
    updateEdgeAffinity(pos.x);
  };

  const targetMins = Math.max(1, dailyTargetMinutes);
  const sessionMins = Math.floor(sessionElapsedSeconds / 60);
  const currentTotalMins = todayBaseMinutes + sessionMins;
  const percentComplete = Math.min(100, Math.round((currentTotalMins / targetMins) * 100));
  const remainingMins = Math.max(0, targetMins - currentTotalMins);
  const isGoalReached = currentTotalMins >= targetMins;

  // Check for milestone crossings
  useEffect(() => {
    ReadingNotificationService.checkMilestoneCrossed(targetMins, currentTotalMins);
  }, [currentTotalMins, targetMins]);

  // Listen to in-app celebration notifications
  useEffect(() => {
    const unsub = ReadingNotificationService.subscribe(({ title, body }) => {
      setCelebrationToast(`${title}: ${body}`);
      setTimeout(() => {
        setCelebrationToast(null);
      }, 5000);
    });
    return unsub;
  }, []);

  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h} ${h === 1 ? 'hr' : 'hrs'}`;
    return `${h}h ${m}m`;
  };

  const targetFormatted = targetMins >= 60 ? `${(targetMins / 60).toFixed(1)} hrs` : `${targetMins}m`;

  // Interpolations for space-efficient orbital floating items
  // When on left half: float card above (X: 0) and badges to the right (X: 64)
  // When on right half: float card inward (X: -146) and badges to the left (X: -110)
  const targetCardTranslateY = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -84],
  });
  const targetCardTranslateX = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isRightHalf ? -146 : 0],
  });
  const targetCardOpacity = expandAnim;

  // Session Stopwatch Badge
  const sessionBadgeTranslateY = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -54],
  });
  const sessionBadgeTranslateX = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isRightHalf ? -110 : 64],
  });
  const sessionBadgeOpacity = expandAnim;

  // Pace / Status Badge
  const paceBadgeTranslateY = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0],
  });
  const paceBadgeTranslateX = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isRightHalf ? -110 : 64],
  });
  const paceBadgeOpacity = expandAnim;

  // Space-efficient Mini Action Bar
  const actionsTranslateY = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -122],
  });
  const actionsTranslateX = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isRightHalf ? -146 : 0],
  });
  const actionsOpacity = expandAnim;

  const toggleExpand = () => {
    if (!isDraggingRef.current) {
      setIsExpanded((prev) => !prev);
    }
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.draggableWrapper,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        },
      ]}
    >
      {/* Milestone Celebration Banner */}
      {celebrationToast && (
        <View style={styles.celebrationBanner} pointerEvents="auto">
          <Sparkles size={16} color="#F59E0B" style={{ marginRight: 8 }} />
          <Text numberOfLines={2} style={styles.celebrationText}>
            {celebrationToast}
          </Text>
        </View>
      )}

      {/* ======================================================== */}
      {/* FLOATING SATELLITE ITEMS (Radial Orbit around the Hub)  */}
      {/* ======================================================== */}

      {/* Quick Actions (Mini pill directly atop Target Card) */}
      <Animated.View
        pointerEvents={isExpanded ? 'auto' : 'none'}
        style={[
          styles.orbitalItem,
          styles.orbitalActions,
          {
            opacity: actionsOpacity,
            transform: [{ translateX: actionsTranslateX }, { translateY: actionsTranslateY }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.actionPill}
          onPress={handleResetPosition}
          activeOpacity={0.7}
        >
          <RotateCcw size={11} color="#F472B6" style={{ marginRight: 4 }} />
          <Text style={styles.actionPillText}>Snap</Text>
        </TouchableOpacity>

        {onClose && (
          <TouchableOpacity
            style={styles.actionPill}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <X size={11} color="#9CA3AF" style={{ marginRight: 3 }} />
            <Text style={styles.actionPillText}>Hide</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Satellite Item 1: Streamlined Target Progress Card (Above Hub) */}
      <Animated.View
        pointerEvents={isExpanded ? 'auto' : 'none'}
        style={[
          styles.orbitalItem,
          styles.orbitalTargetCard,
          {
            opacity: targetCardOpacity,
            transform: [{ translateX: targetCardTranslateX }, { translateY: targetCardTranslateY }],
          },
        ]}
      >
        <View style={styles.targetCardHeader}>
          <View style={styles.targetCardHeaderLeft}>
            <View style={[styles.targetIconBadge, isGoalReached && styles.targetIconBadgeComplete]}>
              {isGoalReached ? (
                <CheckCircle2 size={11} color="#10B981" />
              ) : (
                <Target size={11} color="#D84A6A" />
              )}
            </View>
            <Text style={styles.targetCardTitle}>Daily Target</Text>
          </View>
          <Text style={[styles.targetCardPercent, isGoalReached && styles.targetCardPercentComplete]}>
            {percentComplete}%
          </Text>
        </View>

        {/* Compact Progress Bar Track */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${percentComplete}%` },
              isGoalReached && styles.progressBarFillComplete,
            ]}
          />
        </View>

        <View style={styles.targetCardNumbers}>
          <Text style={styles.targetNumbersText}>
            {formatTime(currentTotalMins)} / {targetFormatted}
          </Text>
          <Text style={[styles.targetStatusText, isGoalReached && { color: '#10B981' }]}>
            {isGoalReached ? 'Complete 🎉' : `${remainingMins}m left`}
          </Text>
        </View>
      </Animated.View>

      {/* Satellite Item 2: Active Session Stopwatch Badge (Upper Right) */}
      <Animated.View
        pointerEvents={isExpanded ? 'auto' : 'none'}
        style={[
          styles.orbitalItem,
          styles.orbitalPill,
          {
            opacity: sessionBadgeOpacity,
            transform: [{ translateX: sessionBadgeTranslateX }, { translateY: sessionBadgeTranslateY }],
          },
        ]}
      >
        <Clock size={12} color="#F59E0B" style={{ marginRight: 5 }} />
        <Text style={styles.orbitalPillText}>
          <Text style={styles.orbitalPillHighlight}>{sessionMins}m</Text> session
        </Text>
      </Animated.View>

      {/* Satellite Item 3: Pace & Streak Badge (Directly Right) */}
      <Animated.View
        pointerEvents={isExpanded ? 'auto' : 'none'}
        style={[
          styles.orbitalItem,
          styles.orbitalPill,
          {
            opacity: paceBadgeOpacity,
            transform: [{ translateX: paceBadgeTranslateX }, { translateY: paceBadgeTranslateY }],
          },
        ]}
      >
        <Flame size={12} color={isGoalReached ? '#10B981' : '#D84A6A'} style={{ marginRight: 5 }} />
        <Text style={styles.orbitalPillText}>
          <Text style={[styles.orbitalPillHighlight, isGoalReached && { color: '#10B981' }]}>
            {isGoalReached ? 'Done!' : 'On Track'}
          </Text>
        </Text>
      </Animated.View>

      {/* ======================================================== */}
      {/* THE CENTRAL CIRCULAR TIME HUB WIDGET (Draggable)          */}
      {/* ======================================================== */}
      <View {...panResponder.panHandlers}>
        <TouchableOpacity
          style={[
            styles.circularHub,
            isGoalReached && styles.circularHubComplete,
            isExpanded && styles.circularHubExpanded,
          ]}
          onPress={toggleExpand}
          activeOpacity={0.85}
        >
          {isExpanded ? (
            <X size={22} color="#FFFFFF" />
          ) : (
            <View style={styles.hubInnerContent}>
              <View style={styles.hubIconRow}>
                {isGoalReached ? (
                  <CheckCircle2 size={16} color="#10B981" />
                ) : (
                  <Target size={16} color="#D84A6A" />
                )}
              </View>
              <Text style={[styles.hubTimeText, isGoalReached && styles.hubTimeTextComplete]}>
                {formatTime(currentTotalMins)}
              </Text>
            </View>
          )}

          {/* Glowing pulse ring if goal reached */}
          {isGoalReached && <View style={styles.goalGlowRing} pointerEvents="none" />}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  draggableWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1000,
  },
  celebrationBanner: {
    position: 'absolute',
    bottom: 74,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1B2E',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1010,
  },
  celebrationText: {
    fontSize: 12,
    color: '#FDE68A',
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },

  /* Circular Time Hub */
  circularHub: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#16181D',
    borderWidth: 2,
    borderColor: 'rgba(216, 74, 106, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  circularHubComplete: {
    borderColor: 'rgba(16, 185, 129, 0.7)',
    backgroundColor: '#141E19',
  },
  circularHubExpanded: {
    backgroundColor: '#262933',
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.05 }],
  },
  hubInnerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubIconRow: {
    marginBottom: 1,
  },
  hubTimeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E5E7EB',
    letterSpacing: 0.2,
  },
  hubTimeTextComplete: {
    color: '#10B981',
  },
  goalGlowRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 33,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },

  /* Orbital Floating Items */
  orbitalItem: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  orbitalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 200,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 24, 29, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  actionPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E5E7EB',
  },

  /* Orbital Card 1: Target Card (Slim & Compact) */
  orbitalTargetCard: {
    width: 204,
    backgroundColor: 'rgba(22, 24, 29, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(216, 74, 106, 0.35)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },
  targetCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  targetCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetIconBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(216, 74, 106, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  targetIconBadgeComplete: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  targetCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  targetCardPercent: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D84A6A',
  },
  targetCardPercentComplete: {
    color: '#10B981',
  },
  progressBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginBottom: 5,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#D84A6A',
  },
  progressBarFillComplete: {
    backgroundColor: '#10B981',
  },
  targetCardNumbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetNumbersText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  targetStatusText: {
    fontSize: 10,
    color: '#D84A6A',
    fontWeight: '700',
  },

  /* Orbital Pills 2 & 3 (Compact Status Badges) */
  orbitalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 24, 29, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
    alignSelf: 'flex-start',
  },
  orbitalPillText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  orbitalPillHighlight: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
