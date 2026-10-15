import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { X, Target, Clock, Trophy, Check, Plus, Minus, Sparkles } from 'lucide-react-native';
import { ReadingGoals } from '@/types/book';

interface GoalSettingsModalProps {
  visible: boolean;
  currentGoals: ReadingGoals;
  onClose: () => void;
  onSave: (newGoals: ReadingGoals) => Promise<void>;
}

type TimeKind = 'hours' | 'minutes';

const MINUTE_PRESETS = [15, 20, 30, 45, 60];
const HOUR_PRESETS = [
  { label: '1 hr', hours: 1, mins: 60 },
  { label: '1.5 hrs', hours: 1.5, mins: 90 },
  { label: '2 hrs', hours: 2, mins: 120 },
  { label: '2.5 hrs', hours: 2.5, mins: 150 },
  { label: '3 hrs', hours: 3, mins: 180 },
  { label: '4 hrs', hours: 4, mins: 240 },
];
const YEARLY_PRESETS = [6, 12, 24, 36, 52];

export const GoalSettingsModal: React.FC<GoalSettingsModalProps> = ({
  visible,
  currentGoals,
  onClose,
  onSave,
}) => {
  const initialMins = currentGoals.dailyMinutes || 20;
  const [timeKind, setTimeKind] = useState<TimeKind>(initialMins >= 60 ? 'hours' : 'minutes');
  const [dailyMinutes, setDailyMinutes] = useState(initialMins);
  const [yearlyBooks, setYearlyBooks] = useState(currentGoals.yearlyBooks || 12);
  const [saving, setSaving] = useState(false);

  // Sync state when opened
  useEffect(() => {
    if (visible) {
      const mins = currentGoals.dailyMinutes || 20;
      setDailyMinutes(mins);
      setTimeKind(mins >= 60 ? 'hours' : 'minutes');
      setYearlyBooks(currentGoals.yearlyBooks || 12);
    }
  }, [visible, currentGoals]);

  const currentHours = Number((dailyMinutes / 60).toFixed(1));

  const handleStepMinutes = (delta: number) => {
    setDailyMinutes((prev) => Math.max(5, Math.min(720, prev + delta)));
  };

  const handleStepHours = (delta: number) => {
    setDailyMinutes((prev) => {
      const hours = Math.max(0.5, Math.min(12, (prev / 60) + delta));
      return Math.round(hours * 60);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ dailyMinutes, yearlyBooks });
      onClose();
    } catch (err) {
      console.error('Failed to save reading goals:', err);
    } finally {
      setSaving(false);
    }
  };

  const formatSummary = () => {
    if (dailyMinutes >= 60) {
      const h = (dailyMinutes / 60);
      const hStr = h % 1 === 0 ? `${h}` : h.toFixed(1);
      return `${hStr} ${h === 1 ? 'hour' : 'hours'} per day (${dailyMinutes} mins)`;
    }
    return `${dailyMinutes} minutes per day`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconWrapper}>
                <Target size={20} color="#D97706" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title} numberOfLines={1}>Reading Ambitions</Text>
                <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
                  Set daily reading time & annual milestones
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeBtn}
            >
              <X size={20} color="#78716C" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea}>
            {/* Section 1: Daily Target & Time Kind */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <Clock size={16} color="#D97706" style={{ marginRight: 6 }} />
                  <Text style={styles.sectionTitle}>Daily Reading Target</Text>
                </View>

                {/* Time Kind Toggle (Hours vs Minutes) */}
                <View style={styles.kindToggleContainer}>
                  <TouchableOpacity
                    style={[styles.kindToggleBtn, timeKind === 'hours' && styles.kindToggleBtnActive]}
                    onPress={() => {
                      setTimeKind('hours');
                      if (dailyMinutes < 60) setDailyMinutes(60);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.kindToggleText, timeKind === 'hours' && styles.kindToggleTextActive]}>
                      Hours
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.kindToggleBtn, timeKind === 'minutes' && styles.kindToggleBtnActive]}
                    onPress={() => {
                      setTimeKind('minutes');
                      if (dailyMinutes > 60) setDailyMinutes(30);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.kindToggleText, timeKind === 'minutes' && styles.kindToggleTextActive]}>
                      Minutes
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.sectionDesc}>
                {timeKind === 'hours'
                  ? 'Set your daily goal in hours (e.g. 2 hours per day).'
                  : 'Set your daily goal in focused minutes.'}
              </Text>

              {/* Stepper Display */}
              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => timeKind === 'hours' ? handleStepHours(-0.5) : handleStepMinutes(-5)}
                  activeOpacity={0.7}
                >
                  <Minus size={18} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.stepperCenter}>
                  <Text style={styles.stepperBigValue}>
                    {timeKind === 'hours'
                      ? (dailyMinutes / 60 % 1 === 0 ? dailyMinutes / 60 : (dailyMinutes / 60).toFixed(1))
                      : dailyMinutes}
                  </Text>
                  <Text style={styles.stepperUnitLabel}>
                    {timeKind === 'hours'
                      ? (dailyMinutes === 60 ? 'hour / day' : 'hours / day')
                      : 'mins / day'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => timeKind === 'hours' ? handleStepHours(0.5) : handleStepMinutes(5)}
                  activeOpacity={0.7}
                >
                  <Plus size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Quick Presets Grid */}
              <View style={styles.pillGrid}>
                {timeKind === 'hours' ? (
                  HOUR_PRESETS.map((preset) => {
                    const isSelected = dailyMinutes === preset.mins;
                    return (
                      <TouchableOpacity
                        key={preset.label}
                        onPress={() => setDailyMinutes(preset.mins)}
                        activeOpacity={0.7}
                        style={[styles.pill, isSelected && styles.pillActive]}
                      >
                        <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                          {preset.label}
                        </Text>
                        {isSelected && (
                          <Check size={14} color="#D97706" style={{ marginLeft: 4 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  MINUTE_PRESETS.map((mins) => {
                    const isSelected = dailyMinutes === mins;
                    return (
                      <TouchableOpacity
                        key={mins}
                        onPress={() => setDailyMinutes(mins)}
                        activeOpacity={0.7}
                        style={[styles.pill, isSelected && styles.pillActive]}
                      >
                        <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                          {mins}m
                        </Text>
                        {isSelected && (
                          <Check size={14} color="#D97706" style={{ marginLeft: 4 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              {/* Goal Insight Highlight Box */}
              <View style={styles.insightBox}>
                <Sparkles size={16} color="#D97706" style={{ marginRight: 8, marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>{formatSummary()}</Text>
                  <Text style={styles.insightSubtitle}>
                    {dailyMinutes >= 120
                      ? '⚡ Dedicated Scholar pace: easily finishes 20+ comprehensive books a year!'
                      : dailyMinutes >= 60
                      ? '✨ Steady Reader pace: allows complete immersion and sustained focus.'
                      : '🌱 Consistent habit: reading daily compounds into hundreds of finished pages.'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Section 2: Yearly Target */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Trophy size={16} color="#D97706" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>Yearly Book Challenge</Text>
              </View>
              <Text style={styles.sectionDesc}>
                Target number of finished books across this calendar year.
              </Text>

              <View style={styles.pillGrid}>
                {YEARLY_PRESETS.map((books) => {
                  const isSelected = yearlyBooks === books;
                  return (
                    <TouchableOpacity
                      key={books}
                      onPress={() => setYearlyBooks(books)}
                      activeOpacity={0.7}
                      style={[styles.pill, isSelected && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                        {books} books
                      </Text>
                      {isSelected && (
                        <Check size={14} color="#D97706" style={{ marginLeft: 4 }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.cancelBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={styles.saveBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>
                {saving ? 'Saving...' : 'Set Goals'}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  sheet: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    backgroundColor: '#16181D',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  headerIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#1F222A',
    flexShrink: 0,
  },
  scrollArea: {
    maxHeight: 460,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  kindToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#0D0E11',
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  kindToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  kindToggleBtnActive: {
    backgroundColor: '#D97706',
  },
  kindToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  kindToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1D24',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#262933',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCenter: {
    alignItems: 'center',
  },
  stepperBigValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  stepperUnitLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1F222A',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  pillTextActive: {
    color: '#0D0E11',
    fontWeight: '800',
  },
  insightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.25)',
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 2,
  },
  insightSubtitle: {
    fontSize: 11,
    color: '#D1D5DB',
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#1F222A',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  saveBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#D97706',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
