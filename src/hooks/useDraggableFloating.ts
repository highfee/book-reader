import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, PanResponder } from 'react-native';
import { BookRepository } from '@/services/database/bookRepository';

const DRAG_MOMENTUM = 120;
const EDGE_DOCK_PULL_PX = 44;
const DRAG_THRESHOLD_PX = 4;
const RUBBER_BAND = 0.35;

export type FloatingEdge = 'left' | 'right';

export interface WindowSize {
  width: number;
  height: number;
}

interface UseDraggableFloatingOptions {
  /** Settings key that stores the persisted {x, y}. */
  storageKey: string;
  widgetWidth: number;
  widgetHeight: number;
  /** Where the widget lands on a fresh install or after a reset. */
  defaultPosition: (screen: WindowSize) => { x: number; y: number };
  minTop?: number;
  bottomInset?: number;
  /** Called when the widget is flung off the bottom edge. */
  onDismiss?: () => void;
}

interface MoveOptions {
  magnetic?: boolean;
  persist?: boolean;
}

export function useDraggableFloating({
  storageKey,
  widgetWidth,
  widgetHeight,
  defaultPosition,
  minTop = 56,
  bottomInset = 24,
  onDismiss,
}: UseDraggableFloatingOptions) {
  const [screen, setScreen] = useState(() => Dimensions.get('window'));
  const [restoredPosition, setRestoredPosition] = useState<{ x: number; y: number } | null>(null);
  const [edge, setEdge] = useState<FloatingEdge>('left');
  const isDragging = useRef(false);
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => setScreen(window));
    return () => subscription?.remove?.();
  }, []);

  useEffect(() => {
    let active = true;
    BookRepository.getSetting(storageKey)
      .then((raw) => {
        if (!active || !raw) return;
        const parsed = JSON.parse(raw) as { x: number; y: number };
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          setRestoredPosition(parsed);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [storageKey]);

  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.max(8, Math.min(x, screen.width - widgetWidth - 8)),
      y: Math.max(minTop, Math.min(y, screen.height - widgetHeight - bottomInset)),
    }),
    [screen.width, screen.height, widgetWidth, widgetHeight, minTop, bottomInset]
  );

  const magnetize = useCallback(
    (x: number) => {
      const leftDock = 16;
      const rightDock = screen.width - widgetWidth - 16;
      if (x - leftDock < EDGE_DOCK_PULL_PX) return leftDock;
      if (rightDock - x < EDGE_DOCK_PULL_PX) return rightDock;
      return x;
    },
    [screen.width, widgetWidth]
  );

  const persist = useCallback(
    (x: number, y: number) => {
      BookRepository.setSetting(
        storageKey,
        JSON.stringify({ x: Math.round(x), y: Math.round(y) })
      ).catch(() => {});
    },
    [storageKey]
  );

  const fallback = defaultPosition(screen);
  const pan = useRef(new Animated.ValueXY(restoredPosition || fallback)).current;
  const lastOffset = useRef(restoredPosition || fallback);
  const hydrated = useRef(Boolean(restoredPosition));

  const moveTo = useCallback(
    (x: number, y: number, options: MoveOptions = {}) => {
      const bounded = clamp(x, y);
      const target = {
        x: options.magnetic === false ? bounded.x : magnetize(bounded.x),
        y: bounded.y,
      };
      lastOffset.current = target;
      pan.setOffset({ x: 0, y: 0 });
      Animated.timing(pan, {
        toValue: target,
        duration: 260,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: false,
      }).start();
      setEdge(target.x > (screen.width - widgetWidth) / 2 ? 'right' : 'left');
      if (options.persist !== false) persist(target.x, target.y);
    },
    [pan, clamp, magnetize, persist, screen.width, widgetWidth]
  );

  useEffect(() => {
    if (hydrated.current || !restoredPosition) return;
    hydrated.current = true;
    moveTo(restoredPosition.x, restoredPosition.y, { magnetic: false, persist: false });
  }, [restoredPosition, moveTo]);

  const releasePress = useCallback(() => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: false, friction: 6 }).start();
  }, [pressScale]);

  const pressIn = useCallback(() => {
    if (isDragging.current) return;
    Animated.timing(pressScale, { toValue: 0.95, duration: 90, useNativeDriver: false }).start();
  }, [pressScale]);

  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > DRAG_THRESHOLD_PX || Math.abs(gesture.dy) > DRAG_THRESHOLD_PX,
        onPanResponderGrant: () => {
          isDragging.current = true;
          pan.setOffset({ x: lastOffset.current.x, y: lastOffset.current.y });
          pan.setValue({ x: 0, y: 0 });
          Animated.spring(pressScale, { toValue: 1.06, useNativeDriver: false, friction: 5 }).start();
        },
        onPanResponderMove: (_, gesture) => {
          const rawX = lastOffset.current.x + gesture.dx;
          const rawY = lastOffset.current.y + gesture.dy;
          const bounded = clamp(rawX, rawY);
          const damp = (raw: number, limited: number) => limited + (raw - limited) * RUBBER_BAND;
          pan.setValue({
            x: (rawX !== bounded.x ? damp(rawX, bounded.x) : bounded.x) - lastOffset.current.x,
            y: (rawY !== bounded.y ? damp(rawY, bounded.y) : bounded.y) - lastOffset.current.y,
          });
        },
        onPanResponderRelease: (_, gesture) => {
          pan.flattenOffset();
          releasePress();

          const flungDown =
            gesture.vy > 1.3 && lastOffset.current.y + gesture.dy > screen.height - widgetHeight - 90;
          if (flungDown && onDismiss) {
            Animated.timing(pan, {
              toValue: { x: lastOffset.current.x, y: screen.height + widgetHeight },
              duration: 200,
              useNativeDriver: false,
            }).start(() => onDismiss());
            setTimeout(() => {
              isDragging.current = false;
            }, 120);
            return;
          }

          moveTo(
            lastOffset.current.x + gesture.dx + gesture.vx * DRAG_MOMENTUM,
            lastOffset.current.y + gesture.dy + gesture.vy * DRAG_MOMENTUM
          );
          setTimeout(() => {
            isDragging.current = false;
          }, 120);
        },
        onPanResponderTerminate: (_, gesture) => {
          releasePress();
          moveTo(lastOffset.current.x + gesture.dx, lastOffset.current.y + gesture.dy);
          isDragging.current = false;
        },
        onPanResponderTerminationRequest: () => false,
      }).panHandlers,
    [pan, pressScale, clamp, moveTo, releasePress, screen.height, widgetHeight, onDismiss]
  );

  const swapEdge = useCallback(() => {
    const next: FloatingEdge = edge === 'right' ? 'left' : 'right';
    moveTo(
      next === 'right' ? screen.width - widgetWidth - 16 : 16,
      lastOffset.current.y,
      { magnetic: false }
    );
  }, [edge, moveTo, screen.width, widgetWidth]);

  const resetPosition = useCallback(() => {
    const target = defaultPosition(screen);
    moveTo(target.x, target.y, { magnetic: false });
  }, [defaultPosition, moveTo, screen]);

  return {
    pan,
    panHandlers,
    pressScale,
    pressIn,
    releasePress,
    isDragging,
    edge,
    swapEdge,
    resetPosition,
    moveTo,
    screen,
  };
}
