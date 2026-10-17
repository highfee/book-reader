import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Calendar, Flame, BookOpen, Clock, Sparkles } from 'lucide-react-native';
import { DailyReadingActivity } from '@/types/book';
import { HorizontalScroll } from '@/components/ui/HorizontalScroll';

interface ReadingHeatmapProps {
  activityMap: Record<string, DailyReadingActivity>;
}

interface DayCell {
  dateStr: string;
  dayOfWeek: number; // 0 = Sun, 1 = Mon ... 6 = Sat
  displayDate: Date;
  isToday: boolean;
  isFuture: boolean;
  activity?: DailyReadingActivity;
}

interface WeekColumn {
  weekIndex: number;
  monthLabel?: string;
  days: DayCell[];
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_LABELS = ['', 'M', '', 'W', '', 'F', ''];

export const ReadingHeatmap: React.FC<ReadingHeatmapProps> = ({ activityMap }) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [selectedCell, setSelectedCell] = useState<DayCell | null>(() => {
    const today = new Date();
    const todayStr = today.toISOString().substring(0, 10);
    return {
      dateStr: todayStr,
      dayOfWeek: today.getDay(),
      displayDate: today,
      isToday: true,
      isFuture: false,
      activity: undefined,
    };
  });

  // Compute 52-week grid (columns of 7 days, Sunday to Saturday)
  const { weeks, activeDaysCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayDOW = today.getDay(); // 0 = Sun .. 6 = Sat
    // We want 52 weeks prior + the current week
    const totalWeeks = 53;
    // Calculate start date: Sunday of 52 weeks ago
    const startOfCurrentWeek = new Date(today);
    startOfCurrentWeek.setDate(today.getDate() - todayDOW);

    const gridStartDate = new Date(startOfCurrentWeek);
    gridStartDate.setDate(startOfCurrentWeek.getDate() - (totalWeeks - 1) * 7);

    const weekColumns: WeekColumn[] = [];
    let lastLabeledMonth = -1;
    let activeDays = 0;

    let cursor = new Date(gridStartDate);

    for (let w = 0; w < totalWeeks; w++) {
      const daysInWeek: DayCell[] = [];
      let weekMonthLabel: string | undefined = undefined;

      for (let d = 0; d < 7; d++) {
        const dateStr = cursor.toISOString().substring(0, 10);
        const isFuture = cursor > today;
        const isToday = cursor.getTime() === today.getTime();
        const activity = activityMap[dateStr];

        if (activity && activity.durationSeconds > 0) {
          activeDays++;
        }

        // Check if this day is the 1st-7th of a new month to show month header
        const currentMonth = cursor.getMonth();
        if (cursor.getDate() <= 7 && currentMonth !== lastLabeledMonth && !weekMonthLabel) {
          weekMonthLabel = MONTH_NAMES[currentMonth];
          lastLabeledMonth = currentMonth;
        }

        daysInWeek.push({
          dateStr,
          dayOfWeek: d,
          displayDate: new Date(cursor),
          isToday,
          isFuture,
          activity,
        });

        // advance 1 day
        cursor.setDate(cursor.getDate() + 1);
      }

      weekColumns.push({
        weekIndex: w,
        monthLabel: weekMonthLabel,
        days: daysInWeek,
      });
    }

    return {
      weeks: weekColumns,
      activeDaysCount: activeDays,
    };
  }, [activityMap]);

  // Auto-scroll to the right end (current week) on initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
    return () => clearTimeout(timer);
  }, [weeks]);

  const getColorTier = (cell: DayCell): string => {
    if (cell.isFuture) return 'transparent';
    const durationSeconds = cell.activity?.durationSeconds || 0;
    const mins = Math.floor(durationSeconds / 60);

    if (mins === 0) return 'rgba(255, 255, 255, 0.07)'; // Empty dark cell
    if (mins < 15) return 'rgba(216, 74, 106, 0.35)';   // Berry tier 1
    if (mins < 30) return 'rgba(216, 74, 106, 0.65)';   // Berry tier 2
    if (mins < 60) return '#D84A6A';                    // Signature berry
    return '#FB7185';                                   // Rose glow tier 4
  };

  const formatDetailDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const selectedActivity = selectedCell ? activityMap[selectedCell.dateStr] || selectedCell.activity : undefined;
  const selectedMins = selectedActivity
    ? Math.round((selectedActivity.durationSeconds || 0) / 60)
    : 0;

  return (
    <View style={styles.card}>
      {/* Top Header */}
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <View style={styles.iconCircle}>
            <Calendar size={18} color="#D97706" />
          </View>
          <View>
            <Text style={styles.cardTitle}>Annual Reading Matrix</Text>
            <Text style={styles.cardSubtitle}>52-week activity heatmap</Text>
          </View>
        </View>

        <View style={styles.badgeContainer}>
          <Flame size={14} color="#D97706" style={{ marginRight: 4 }} />
          <Text style={styles.badgeText}>{activeDaysCount} active days</Text>
        </View>
      </View>

      {/* Grid Container */}
      <View style={styles.gridOuterContainer}>
        {/* Left Day Labels */}
        <View style={styles.dayLabelsCol}>
          <View style={styles.monthHeaderSpacer} />
          {DAY_LABELS.map((label, idx) => (
            <View key={idx} style={styles.dayLabelRow}>
              <Text style={styles.dayLabelText}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Scrollable Heatmap Weeks */}
        <HorizontalScroll
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
        >
          {weeks.map((col) => (
            <View key={col.weekIndex} style={styles.weekColumn}>
              {/* Month Header Label */}
              <View style={styles.monthLabelContainer}>
                {col.monthLabel ? (
                  <Text style={styles.monthLabelText}>{col.monthLabel}</Text>
                ) : null}
              </View>

              {/* 7 Days in Week */}
              {col.days.map((cell) => {
                const isSelected = selectedCell?.dateStr === cell.dateStr;
                return (
                  <TouchableOpacity
                    key={cell.dateStr}
                    disabled={cell.isFuture}
                    onPress={() => setSelectedCell(cell)}
                    activeOpacity={0.7}
                    style={[
                      styles.cell,
                      { backgroundColor: getColorTier(cell) },
                      cell.isToday && styles.todayCellOutline,
                      isSelected && styles.selectedCellOutline,
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </HorizontalScroll>
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <Text style={styles.legendLabel}>Less</Text>
        <View style={[styles.legendBox, { backgroundColor: 'rgba(255, 255, 255, 0.07)' }]} />
        <View style={[styles.legendBox, { backgroundColor: 'rgba(216, 74, 106, 0.35)' }]} />
        <View style={[styles.legendBox, { backgroundColor: 'rgba(216, 74, 106, 0.65)' }]} />
        <View style={[styles.legendBox, { backgroundColor: '#D84A6A' }]} />
        <View style={[styles.legendBox, { backgroundColor: '#FB7185' }]} />
        <Text style={styles.legendLabel}>More</Text>
      </View>

      {/* Selected Day Inspector Banner */}
      {selectedCell && (
        <View style={styles.inspectorCard}>
          <View style={styles.inspectorHeader}>
            <View style={styles.inspectorDateRow}>
              <Text style={styles.inspectorDate}>
                {formatDetailDate(selectedCell.displayDate)}
              </Text>
              {selectedCell.isToday && (
                <View style={styles.todayPill}>
                  <Text style={styles.todayPillText}>Today</Text>
                </View>
              )}
            </View>
          </View>

          {selectedMins > 0 ? (
            <View style={styles.statsPillRow}>
              <View style={styles.statPill}>
                <Clock size={13} color="#D97706" style={{ marginRight: 5 }} />
                <Text style={styles.statPillText}>{selectedMins}m read</Text>
              </View>

              <View style={styles.statPill}>
                <BookOpen size={13} color="#2563EB" style={{ marginRight: 5 }} />
                <Text style={styles.statPillText}>
                  {selectedCell.activity?.pagesRead || 0} pages
                </Text>
              </View>

              <View style={styles.statPill}>
                <Sparkles size={13} color="#7C3AED" style={{ marginRight: 5 }} />
                <Text style={styles.statPillText}>
                  {selectedCell.activity?.sessionsCount || 1} session{selectedCell.activity?.sessionsCount === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyDayText}>
              No reading logged on this day. Tap any filled square to view details.
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#16181D',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1F222A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F222A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D84A6A',
  },
  gridOuterContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dayLabelsCol: {
    width: 14,
    marginRight: 6,
  },
  monthHeaderSpacer: {
    height: 18,
  },
  dayLabelRow: {
    height: 13,
    marginBottom: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayLabelText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6B7280',
  },
  scrollContent: {
    paddingRight: 8,
  },
  weekColumn: {
    width: 13,
    marginRight: 3,
    alignItems: 'center',
  },
  monthLabelContainer: {
    height: 18,
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
  },
  monthLabelText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  cell: {
    width: 13,
    height: 13,
    borderRadius: 3,
    marginBottom: 3,
  },
  todayCellOutline: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  selectedCellOutline: {
    borderWidth: 2,
    borderColor: '#D84A6A',
    transform: [{ scale: 1.15 }],
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 4,
  },
  legendLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginHorizontal: 3,
  },
  legendBox: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  inspectorCard: {
    marginTop: 14,
    backgroundColor: '#1F222A',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  inspectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inspectorDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inspectorDate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  todayPill: {
    backgroundColor: 'rgba(216, 74, 106, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  todayPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D84A6A',
  },
  statsPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16181D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyDayText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});
