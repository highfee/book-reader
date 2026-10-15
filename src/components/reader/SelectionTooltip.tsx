import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { StickyNote, Sparkles, Copy, X, BookOpen } from 'lucide-react-native';
import { HorizontalScroll } from '@/components/ui/HorizontalScroll';

export interface SelectionCoords {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectionTooltipProps {
  visible: boolean;
  selectedText: string;
  coords?: SelectionCoords | null;
  onAddNote: (text: string, color: string) => void;
  onHighlightOnly: (text: string, color: string) => void;
  onLookupMeaning?: (text: string) => void;
  onAskAI: (text: string) => void;
  onDismiss: () => void;
}

const PALETTE = [
  { id: 'gold', hex: '#FEF08A', dot: '#EAB308', name: 'Gold' },
  { id: 'mint', hex: '#BBF7D0', dot: '#22C55E', name: 'Mint' },
  { id: 'sky', hex: '#BFDBFE', dot: '#3B82F6', name: 'Sky' },
  { id: 'rose', hex: '#FBCFE8', dot: '#EC4899', name: 'Rose' },
];

export const SelectionTooltip: React.FC<SelectionTooltipProps> = ({
  visible,
  selectedText,
  coords,
  onAddNote,
  onHighlightOnly,
  onLookupMeaning,
  onAskAI,
  onDismiss,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = React.useState<number>(440);

  if (!visible || !selectedText.trim()) return null;

  const margin = 12;
  const effectiveWidth = Math.min(measuredWidth, screenWidth - margin * 2);

  // Compute position: center horizontally, float above selection (or below if too close to top)
  let tooltipY = 90;
  let tooltipX = (screenWidth - effectiveWidth) / 2;

  if (coords && coords.y > 0) {
    tooltipY = Math.max(70, coords.y - 58);
    if (tooltipY < 75) {
      tooltipY = coords.y + coords.height + 12;
    }
    // Clamp Y to remain inside viewport
    tooltipY = Math.max(60, Math.min(screenHeight - 80, tooltipY));

    const centerSelX = coords.x + coords.width / 2;
    const desiredX = centerSelX - effectiveWidth / 2;
    // Strictly clamp tooltip between [margin, screenWidth - effectiveWidth - margin]
    tooltipX = Math.max(margin, Math.min(screenWidth - effectiveWidth - margin, desiredX));
  } else {
    // Default pleasant floating anchor near top center
    tooltipY = 110;
    tooltipX = Math.max(margin, (screenWidth - effectiveWidth) / 2);
  }

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - measuredWidth) > 4) {
          setMeasuredWidth(w);
        }
      }}
      style={[
        styles.floatingContainer,
        {
          top: tooltipY,
          left: tooltipX,
          maxWidth: screenWidth - margin * 2,
        },
      ]}
    >
      <View style={[styles.pillCard, { maxWidth: screenWidth - margin * 2 }]}>
        <HorizontalScroll
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          {/* Color Highlight Dots */}
          <View style={styles.colorPills}>
            {PALETTE.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.colorDotBtn, { backgroundColor: c.hex }]}
                onPress={() => onHighlightOnly(selectedText, c.hex)}
                activeOpacity={0.7}
                accessibilityLabel={`Highlight in ${c.name}`}
              >
                <View style={[styles.innerDot, { backgroundColor: c.dot }]} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Add Note Button */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onAddNote(selectedText, PALETTE[0].hex)}
            activeOpacity={0.7}
          >
            <StickyNote size={14} color="#FBBF24" style={{ marginRight: 5 }} />
            <Text style={styles.actionBtnText}>Add Note</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Meaning / Dictionary Button */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onLookupMeaning?.(selectedText)}
            activeOpacity={0.7}
          >
            <BookOpen size={14} color="#38BDF8" style={{ marginRight: 5 }} />
            <Text style={[styles.actionBtnText, { color: '#E0F2FE' }]}>Meaning</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Ask AI Button */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onAskAI(selectedText)}
            activeOpacity={0.7}
          >
            <Sparkles size={14} color="#A78BFA" style={{ marginRight: 5 }} />
            <Text style={[styles.actionBtnText, { color: '#E0E7FF' }]}>Ask AI</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Close Button */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onDismiss}
            activeOpacity={0.7}
            accessibilityLabel="Close tooltip"
          >
            <X size={14} color="#9CA3AF" />
          </TouchableOpacity>
        </HorizontalScroll>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    zIndex: 9999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  pillCard: {
    backgroundColor: 'rgba(28, 25, 23, 0.96)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.28)',
    overflow: 'hidden',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  colorPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  colorDotBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  innerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  actionBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  iconBtn: {
    padding: 4,
    marginLeft: 2,
  },
});
