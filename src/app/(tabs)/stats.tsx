import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Flame,
  Clock,
  BookCheck,
  BookOpen,
  Trophy,
  Sparkles,
  Target,
  SlidersHorizontal,
  CheckCircle2,
  Award,
  Crown,
  Lock,
  ShieldCheck,
  Bell,
  Play,
} from 'lucide-react-native';
import { BookRepository } from '@/services/database/bookRepository';
import { ReadingStats, DailyReadingActivity, ReadingGoals, BookWithProgress } from '@/types/book';
import { ReadingHeatmap } from '@/components/stats/ReadingHeatmap';
import { GoalSettingsModal } from '@/components/stats/GoalSettingsModal';
import { NotificationReminderModal } from '@/components/stats/NotificationReminderModal';
import { HorizontalScroll } from '@/components/ui/HorizontalScroll';
import { AppPalette } from '@/constants/theme';

const SECTIONS = ['ALL', 'TARGETS', 'HEATMAP', 'METRICS', 'HONORS'] as const;
type SectionTab = (typeof SECTIONS)[number];

export default function StatsScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [activityMap, setActivityMap] = useState<Record<string, DailyReadingActivity>>({});
  const [goals, setGoals] = useState<ReadingGoals>({ dailyMinutes: 20, yearlyBooks: 12 });
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSection, setSelectedSection] = useState<SectionTab>('ALL');

  const loadData = useCallback(async () => {
    try {
      const [statsData, actMap, savedGoals, allBooks] = await Promise.all([
        BookRepository.getReadingStats(),
        BookRepository.getReadingActivityMap(365),
        BookRepository.getReadingGoals(),
        BookRepository.getAllBooks(),
      ]);
      setStats(statsData);
      setActivityMap(actMap);
      setGoals(savedGoals);

      // Find currently in-progress book, or most recent book
      const inProgress = allBooks.find(
        (b) => (b.progress?.percentComplete || 0) > 0 && (b.progress?.percentComplete || 0) < 100
      ) || (allBooks.length > 0 ? allBooks[0] : null);
      setActiveBookId(inProgress ? inProgress.id : null);
    } catch (err) {
      console.error('Failed to load stats dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSaveGoals = async (newGoals: ReadingGoals) => {
    await BookRepository.saveReadingGoals(newGoals);
    setGoals(newGoals);
  };

  const formatReadingTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hours = (mins / 60).toFixed(1);
    return `${hours} hrs`;
  };

  const formatDurationDisplay = (mins: number): string => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h} ${h === 1 ? 'hr' : 'hrs'}`;
    return `${h}h ${m}m`;
  };

  // Today's progress calculation
  const todayStr = new Date().toISOString().substring(0, 10);
  const todayDurationSecs = activityMap[todayStr]?.durationSeconds || 0;
  const todayMinutes = Math.round(todayDurationSecs / 60);
  const dailyTargetMins = goals.dailyMinutes || 20;
  const dailyProgressPercent = Math.min(100, Math.round((todayMinutes / dailyTargetMins) * 100));
  const isDailyGoalMet = todayMinutes >= dailyTargetMins;

  // Yearly progress calculation
  const yearlyTargetBooks = goals.yearlyBooks || 12;
  const completedBooks = stats?.completedBooks || 0;
  const yearlyProgressPercent = Math.min(100, Math.round((completedBooks / yearlyTargetBooks) * 100));

  // Archival Milestone Stamps
  const milestones = [
    {
      id: 'first_leaf',
      title: 'First Leaf Turned',
      subtitle: 'Turn your first page and begin your reading voyage',
      unlocked: (stats?.totalPagesRead || 0) >= 1,
      progressText: (stats?.totalPagesRead || 0) >= 1 ? 'Honored' : 'Read 1 page',
      icon: BookOpen,
      accentColor: '#D97706',
    },
    {
      id: 'streak_keeper',
      title: '7-Day Streak Keeper',
      subtitle: 'Read 7 consecutive days',
      unlocked: (stats?.currentStreakDays || 0) >= 7,
      progressText: (stats?.currentStreakDays || 0) >= 7 ? 'Honored' : `${stats?.currentStreakDays || 0}/7 days`,
      icon: Flame,
      accentColor: '#EA580C',
    },
    {
      id: 'deep_scholar',
      title: 'Deep Scholar',
      subtitle: 'Read 60+ mins in one day',
      unlocked: Object.values(activityMap).some((a) => a.durationSeconds >= 3600),
      progressText: Object.values(activityMap).some((a) => a.durationSeconds >= 3600) ? 'Honored' : '60m session',
      icon: Award,
      accentColor: '#D84A6A',
    },
    {
      id: 'centurion',
      title: 'Centurion Reader',
      subtitle: 'Turn over 100 pages',
      unlocked: (stats?.totalPagesRead || 0) >= 100,
      progressText: (stats?.totalPagesRead || 0) >= 100 ? 'Honored' : `${stats?.totalPagesRead || 0}/100 pages`,
      icon: ShieldCheck,
      accentColor: '#38BDF8',
    },
    {
      id: 'literary_finisher',
      title: 'Literary Finisher',
      subtitle: 'Finish your first complete book',
      unlocked: (stats?.completedBooks || 0) >= 1,
      progressText: (stats?.completedBooks || 0) >= 1 ? 'Honored' : `${stats?.completedBooks || 0}/1 book`,
      icon: Trophy,
      accentColor: '#10B981',
    },
    {
      id: 'grand_archon',
      title: 'Grand Archon',
      subtitle: 'Amass 10 hours of focused reading',
      unlocked: (stats?.totalTimeReadSeconds || 0) >= 36000,
      progressText: (stats?.totalTimeReadSeconds || 0) >= 36000 ? 'Honored' : `${Math.round((stats?.totalTimeReadSeconds || 0) / 3600)}/10 hrs`,
      icon: Crown,
      accentColor: '#F59E0B',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Reading Insights</Text>
          <Text style={styles.headerSubtitle}>Velocity, streaks & annual milestones</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setNotificationModalVisible(true)}
            style={styles.adjustGoalsBtn}
            activeOpacity={0.7}
          >
            <Bell size={14} color="#D84A6A" style={{ marginRight: 6 }} />
            <Text style={styles.adjustGoalsText}>Reminders</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setGoalModalVisible(true)}
            style={styles.adjustGoalsBtn}
            activeOpacity={0.7}
          >
            <SlidersHorizontal size={14} color="#D84A6A" style={{ marginRight: 6 }} />
            <Text style={styles.adjustGoalsText}>Goals</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Section Tabs */}
      <View style={styles.sectionTabsWrapper}>
        <HorizontalScroll
          contentContainerStyle={styles.sectionTabsContent}
        >
          {SECTIONS.map((sec) => {
            const isActive = selectedSection === sec;
            return (
              <TouchableOpacity
                key={sec}
                style={[styles.sectionPill, isActive && styles.sectionPillActive]}
                onPress={() => setSelectedSection(sec)}
                activeOpacity={0.8}
              >
                <Text style={[styles.sectionPillText, isActive && styles.sectionPillTextActive]}>
                  {sec}
                </Text>
              </TouchableOpacity>
            );
          })}
        </HorizontalScroll>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D84A6A" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          directionalLockEnabled
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              tintColor="#D84A6A"
              colors={['#D84A6A']}
            />
          }
        >
          {/* Zero-State Library Guide if database reset / no books */}
          {stats?.totalBooks === 0 && (
            <View style={styles.zeroStateCard}>
              <View style={styles.zeroStateIconRow}>
                <Sparkles size={18} color="#D84A6A" style={{ marginRight: 8 }} />
                <Text style={styles.zeroStateTitle}>Database Reset • Clean Canvas</Text>
              </View>
              <Text style={styles.zeroStateSub}>
                All mock reading sessions have been cleared. As you import and read your own books, your true velocity, daily reading hours, and streaks will record here.
              </Text>
              <TouchableOpacity
                style={styles.zeroStateBtn}
                onPress={() => router.replace('/')}
                activeOpacity={0.8}
              >
                <Text style={styles.zeroStateBtnText}>Go to Library to Import</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Today's Daily Target Card */}
          {(selectedSection === 'ALL' || selectedSection === 'TARGETS') && (
            <View style={styles.dailyTargetCard}>
              <View style={styles.dailyTargetHeader}>
                <View style={styles.targetIconRow}>
                  <View style={styles.targetIconBadge}>
                    <Target size={20} color="#D84A6A" />
                  </View>
                  <View>
                    <Text style={styles.dailyTargetTitle}>Today's Reading Target</Text>
                    <Text style={styles.dailyTargetSubtitle}>
                      {formatDurationDisplay(todayMinutes)} of {formatDurationDisplay(dailyTargetMins)} read ({dailyProgressPercent}%)
                    </Text>
                  </View>
                </View>

                {isDailyGoalMet ? (
                  <View style={styles.goalAchievedPill}>
                    <CheckCircle2 size={13} color="#10B981" style={{ marginRight: 4 }} />
                    <Text style={styles.goalAchievedText}>Crushed</Text>
                  </View>
                ) : (
                  <View style={styles.goalRemainingPill}>
                    <Text style={styles.goalRemainingText}>
                      {formatDurationDisplay(Math.max(0, dailyTargetMins - todayMinutes))} left
                    </Text>
                  </View>
                )}
              </View>

              {/* Progress Bar */}
              <View style={styles.targetProgressBarTrack}>
                <View
                  style={[
                    styles.targetProgressBarFill,
                    { width: `${dailyProgressPercent}%` },
                    isDailyGoalMet && { backgroundColor: '#10B981' },
                  ]}
                />
              </View>

              <View style={styles.targetCardFooter}>
                <Text style={styles.targetFooterText}>
                  {isDailyGoalMet
                    ? 'Fantastic work! You have satisfied your daily reading ambition.'
                    : `Read ${Math.max(0, dailyTargetMins - todayMinutes)} more minutes today to sustain your streak.`}
                </Text>

                {/* Target Sprint & Reminder Actions */}
                <View style={styles.targetActionRow}>
                  <TouchableOpacity
                    style={styles.targetActionBtn}
                    onPress={() => setNotificationModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Bell size={13} color="#D84A6A" style={{ marginRight: 6 }} />
                    <Text style={styles.targetActionText}>Reminder Alerts</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.targetActionBtn, styles.targetActionBtnPrimary]}
                    onPress={() => {
                      if (activeBookId) {
                        router.push({
                          pathname: '/book/[id]',
                          params: { id: activeBookId },
                        });
                      } else {
                        router.replace('/');
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Play size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={[styles.targetActionText, { color: '#FFFFFF' }]}>
                      {isDailyGoalMet ? 'Keep Reading' : 'Start Reading Sprint'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Reading Streak Banner */}
          {(selectedSection === 'ALL' || selectedSection === 'TARGETS') && (
            <View style={styles.streakCard}>
              <View style={styles.streakIconWrapper}>
                <Flame size={28} color="#D97706" />
              </View>
              <View style={styles.streakTextWrapper}>
                <Text style={styles.streakNumber}>
                  {stats?.currentStreakDays || 0} {stats?.currentStreakDays === 1 ? 'Day' : 'Days'}
                </Text>
                <Text style={styles.streakLabel}>Active Reading Streak</Text>
              </View>
              <Sparkles size={20} color="#F59E0B" />
            </View>
          )}

          {/* GitHub-style 52-Week Activity Heatmap */}
          {(selectedSection === 'ALL' || selectedSection === 'HEATMAP') && (
            <ReadingHeatmap activityMap={activityMap} />
          )}

          {/* Yearly Reading Challenge Card */}
          {(selectedSection === 'ALL' || selectedSection === 'TARGETS') && (
            <View style={styles.yearlyGoalCard}>
              <View style={styles.yearlyHeader}>
                <View style={styles.yearlyTitleRow}>
                  <View style={styles.yearlyIconWrapper}>
                    <Trophy size={18} color="#D84A6A" />
                  </View>
                  <View>
                    <Text style={styles.yearlyTitle}>2026 Reading Challenge</Text>
                    <Text style={styles.yearlySubtitle}>
                      {completedBooks} of {yearlyTargetBooks} books finished ({yearlyProgressPercent}%)
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setGoalModalVisible(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.editLinkText}>Adjust</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.yearlyProgressBarTrack}>
                <View
                  style={[
                    styles.yearlyProgressBarFill,
                    { width: `${yearlyProgressPercent}%` },
                  ]}
                />
              </View>

              <Text style={styles.yearlyFooterText}>
                {completedBooks >= yearlyTargetBooks
                  ? '🏆 Challenge completed! Consider setting a higher milestone.'
                  : `${Math.max(0, yearlyTargetBooks - completedBooks)} more books to conquer your 2026 goal.`}
              </Text>
            </View>
          )}

          {/* Quick Metrics 4-Grid */}
          {(selectedSection === 'ALL' || selectedSection === 'METRICS') && (
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Clock size={20} color="#D84A6A" />
                <Text style={styles.metricValue}>
                  {formatReadingTime(stats?.totalTimeReadSeconds || 0)}
                </Text>
                <Text style={styles.metricLabel}>Total Time Read</Text>
              </View>

              <View style={styles.metricCard}>
                <BookCheck size={20} color="#10B981" />
                <Text style={styles.metricValue}>{stats?.completedBooks || 0}</Text>
                <Text style={styles.metricLabel}>Books Completed</Text>
              </View>

              <View style={styles.metricCard}>
                <BookOpen size={20} color="#38BDF8" />
                <Text style={styles.metricValue}>{stats?.currentlyReading || 0}</Text>
                <Text style={styles.metricLabel}>In Progress</Text>
              </View>

              <View style={styles.metricCard}>
                <Trophy size={20} color="#F59E0B" />
                <Text style={styles.metricValue}>{stats?.totalPagesRead || 0}</Text>
                <Text style={styles.metricLabel}>Pages Read</Text>
              </View>
            </View>
          )}

          {/* Archival Milestone Honors & Wax Seals */}
          {(selectedSection === 'ALL' || selectedSection === 'HONORS') && (
            <View style={styles.milestonesSection}>
              <View style={styles.milestonesHeader}>
                <View style={styles.milestoneTitleRow}>
                  <Sparkles size={16} color="#D84A6A" style={{ marginRight: 6 }} />
                  <Text style={styles.milestonesSectionTitle}>Milestone Honors</Text>
                </View>
                <Text style={styles.milestonesCount}>
                  {milestones.filter((m) => m.unlocked).length} of {milestones.length} Unlocked
                </Text>
              </View>

              <View style={styles.milestonesGrid}>
                {milestones.map((m) => {
                  const IconComponent = m.icon;
                  return (
                    <View
                      key={m.id}
                      style={[
                        styles.milestoneCard,
                        m.unlocked ? styles.milestoneUnlocked : styles.milestoneLocked,
                      ]}
                    >
                      <View
                        style={[
                          styles.waxSealCircle,
                          m.unlocked
                            ? { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: m.accentColor }
                            : { backgroundColor: '#1F222A', borderColor: 'rgba(255, 255, 255, 0.08)' },
                        ]}
                      >
                        {m.unlocked ? (
                          <IconComponent size={20} color={m.accentColor} />
                        ) : (
                          <Lock size={16} color="#6B7280" />
                        )}
                      </View>

                      <Text
                        numberOfLines={1}
                        style={[
                          styles.milestoneCardTitle,
                          !m.unlocked && { color: '#6B7280' },
                        ]}
                      >
                        {m.title}
                      </Text>

                      <Text numberOfLines={2} style={styles.milestoneCardSub}>
                        {m.subtitle}
                      </Text>

                      <View
                        style={[
                          styles.milestoneRibbon,
                          m.unlocked
                            ? { backgroundColor: m.accentColor }
                            : { backgroundColor: '#1F222A' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.milestoneRibbonText,
                            m.unlocked ? { color: '#0D0E11' } : { color: '#6B7280' },
                          ]}
                        >
                          {m.progressText}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Goal Settings Modal */}
      <GoalSettingsModal
        visible={goalModalVisible}
        currentGoals={goals}
        onClose={() => setGoalModalVisible(false)}
        onSave={handleSaveGoals}
      />

      {/* Target Reminder Notification Modal */}
      <NotificationReminderModal
        visible={notificationModalVisible}
        onClose={() => setNotificationModalVisible(false)}
        dailyTargetMinutes={goals.dailyMinutes || 20}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0E11',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#0D0E11',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  adjustGoalsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16181D',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  adjustGoalsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionTabsWrapper: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    flexGrow: 0,
  },
  sectionTabsContent: {
    paddingHorizontal: 16,
    gap: 8,
    paddingRight: 28,
  },
  sectionPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  sectionPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  sectionPillTextActive: {
    color: '#0D0E11',
  },
  content: {
    padding: 16,
    paddingBottom: 130,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dailyTargetCard: {
    backgroundColor: '#16181D',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  dailyTargetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  targetIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  targetIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1F222A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dailyTargetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dailyTargetSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  goalAchievedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  goalAchievedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  goalRemainingPill: {
    backgroundColor: 'rgba(216, 74, 106, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(216, 74, 106, 0.3)',
  },
  goalRemainingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D84A6A',
  },
  targetProgressBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 10,
  },
  targetProgressBarFill: {
    height: '100%',
    backgroundColor: '#D84A6A',
    borderRadius: 6,
  },
  targetCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetFooterText: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 16,
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16181D',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  streakIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1F222A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  streakTextWrapper: {
    flex: 1,
  },
  streakNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  streakLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
    marginTop: 1,
  },
  yearlyGoalCard: {
    backgroundColor: '#16181D',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  yearlyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  yearlyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yearlyIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1F222A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  yearlyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  yearlySubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  editLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D84A6A',
  },
  yearlyProgressBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  yearlyProgressBarFill: {
    height: '100%',
    backgroundColor: '#D84A6A',
    borderRadius: 6,
  },
  yearlyFooterText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#16181D',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  milestonesSection: {
    marginTop: 8,
    marginBottom: 28,
  },
  milestonesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  milestoneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  milestonesSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  milestonesCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D84A6A',
  },
  milestonesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  milestoneCard: {
    width: '48%',
    backgroundColor: '#16181D',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  milestoneUnlocked: {
    borderColor: 'rgba(217, 119, 6, 0.35)',
  },
  milestoneLocked: {
    opacity: 0.6,
    backgroundColor: '#121316',
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  waxSealCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  milestoneCardTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 3,
  },
  milestoneCardSub: {
    fontSize: 10.5,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 10,
    minHeight: 28,
  },
  milestoneRibbon: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  milestoneRibbonText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  targetActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  targetActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(216, 74, 106, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(216, 74, 106, 0.3)',
  },
  targetActionBtnPrimary: {
    backgroundColor: '#D84A6A',
    borderColor: '#D84A6A',
  },
  targetActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D84A6A',
  },
  zeroStateCard: {
    backgroundColor: '#16181D',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(216, 74, 106, 0.2)',
    marginBottom: 16,
  },
  zeroStateIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  zeroStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  zeroStateSub: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 18,
    marginBottom: 12,
  },
  zeroStateBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(216, 74, 106, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(216, 74, 106, 0.4)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  zeroStateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F472B6',
  },
});
