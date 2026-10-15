import React, { useRef, useEffect } from 'react';
import { ScrollView, ScrollViewProps, Platform, View } from 'react-native';

export interface HorizontalScrollProps extends ScrollViewProps {
  children: React.ReactNode;
}

export const HorizontalScroll = React.forwardRef<ScrollView, HorizontalScrollProps>(
  ({ children, contentContainerStyle, style, ...rest }, ref) => {
    const internalRef = useRef<ScrollView>(null);
    const resolvedRef = (ref as React.RefObject<ScrollView>) || internalRef;
    const containerDivRef = useRef<any>(null);

    // Mouse drag-to-scroll & wheel handling for Web
    useEffect(() => {
      if (Platform.OS !== 'web') return;

      const getScrollElement = (): HTMLElement | null => {
        if (resolvedRef.current && (resolvedRef.current as any).getScrollableNode) {
          return (resolvedRef.current as any).getScrollableNode();
        }
        return containerDivRef.current;
      };

      const element = getScrollElement();
      if (!element) return;

      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;

      const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return;
        isDown = true;
        startX = e.pageX - element.offsetLeft;
        scrollLeft = element.scrollLeft;
        element.style.cursor = 'grabbing';
        element.style.userSelect = 'none';
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - element.offsetLeft;
        const walk = (x - startX) * 1.5;
        element.scrollLeft = scrollLeft - walk;
      };

      const onMouseUp = () => {
        isDown = false;
        if (element) {
          element.style.cursor = 'grab';
          element.style.removeProperty('user-select');
        }
      };

      const onMouseLeave = () => {
        isDown = false;
        if (element) {
          element.style.cursor = 'grab';
          element.style.removeProperty('user-select');
        }
      };

      const onWheel = (e: WheelEvent) => {
        // If content is horizontally scrollable, translate vertical wheel to horizontal
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (delta !== 0 && element.scrollWidth > element.clientWidth) {
          e.preventDefault();
          element.scrollLeft += delta;
        }
      };

      element.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      element.addEventListener('mouseleave', onMouseLeave);
      element.addEventListener('wheel', onWheel, { passive: false });

      element.style.cursor = 'grab';

      return () => {
        element.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        element.removeEventListener('mouseleave', onMouseLeave);
        element.removeEventListener('wheel', onWheel);
      };
    }, [resolvedRef]);

    if (Platform.OS === 'web') {
      const webWrapperStyle: any = {
        overflowX: 'auto',
        overflowY: 'hidden',
        flexDirection: 'row',
        flexGrow: 0,
        flexShrink: 0,
        maxWidth: '100%',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
      };

      const webScrollStyle: any = {
        flexGrow: 0,
        outlineStyle: 'none',
      };

      return (
        <View
          ref={containerDivRef}
          style={[webWrapperStyle, style]}
        >
          <ScrollView
            ref={resolvedRef}
            horizontal
            nestedScrollEnabled
            directionalLockEnabled
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={contentContainerStyle}
            style={[webScrollStyle]}
            {...rest}
          >
            {children}
          </ScrollView>
        </View>
      );
    }

    return (
      <ScrollView
        ref={resolvedRef}
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        style={style}
        {...rest}
      >
        {children}
      </ScrollView>
    );
  }
);

HorizontalScroll.displayName = 'HorizontalScroll';

