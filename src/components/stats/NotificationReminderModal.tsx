import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Bell, Clock, Sparkles, X, ShieldAlert } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import {
  ReadingNotificationService,
  NotificationSettings,
} from '@/services/notifications/readingNotificationService';

interface NotificationReminderModalProps {
  visible: boolean;
  onClose: () => void;
  dailyTargetMinutes: number;
}

const PRESET_TIMES = ['08:00', '13:00', '18:00', '20:00', '21:30'];

export function NotificationReminderModal({
  visible,
  onClose,
  dailyTargetMinutes,
}: NotificationReminderModalProps) {
  const [settings, setSettings] = useState<NotificationSettings>({
    dailyReminderEnabled: true,
    reminderTime: '20:00',
    milestoneToastsEnabled: true,
    sprintRemindersEnabled: true,
  });
  const [hasPermission, setHasPermission] = useState(false);
  const [customTime, setCustomTime] = useState('20:00');
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    const s = await ReadingNotificationService.getSettings();
    setSettings(s);
    setCustomTime(s.reminderTime);
    setHasPermission(await ReadingNotificationService.hasPermission());
  };

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  const handleRequestPermission = async () => {
    const granted = await ReadingNotificationService.requestPermission();
    setHasPermission(granted);
    if (granted) {
      await ReadingNotificationService.scheduleDailyReminderDaemon();
    } else {
      Alert.alert(
        'Permission Needed',
        Platform.OS === 'web'
          ? 'Allow notifications in your browser settings to receive reading alerts. Web alerts only arrive while this tab is open.'
          : 'Enable notifications in your device settings to receive reading alerts.'
      );
    }
  };

  const handleTestNotification = async () => {
    await ReadingNotificationService.dispatchNotification(
      '📖 Reading Target Alert',
      `Target: ${dailyTargetMinutes >= 60 ? (dailyTargetMinutes / 60).toFixed(1) + ' hrs' : dailyTargetMinutes + ' mins'}/day. Your notification system is active and ready!`
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await ReadingNotificationService.saveSettings({
        ...settings,
        reminderTime: customTime.trim() || '20:00',
      });
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <Bell size={20} color="#D84A6A" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Target Reminders</Text>
                <Text style={styles.headerSubtitle}>Push notifications & focus milestones</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* System Permission Banner */}
          {!hasPermission && (
            <TouchableOpacity
              style={styles.permissionBanner}
              onPress={handleRequestPermission}
              activeOpacity={0.8}
            >
              <ShieldAlert size={18} color="#F59E0B" />
              <View style={styles.permissionTextCol}>
                <Text style={styles.permissionBannerTitle}>
                  {Platform.OS === 'web' ? 'Enable Browser Notifications' : 'Enable Notifications'}
                </Text>
                <Text style={styles.permissionBannerSub}>
                  {Platform.OS === 'web'
                    ? 'Tap to allow alerts. Web alerts only arrive while this tab stays open'
                    : 'Tap to allow target reminders on your phone, even when the app is closed'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Daily Reminder Switch */}
          <View style={styles.settingRow}>
            <View style={styles.settingLabelCol}>
              <Text style={styles.settingTitle}>Daily Target Nudge</Text>
              <Text style={styles.settingDescription}>
                {"Reminds you if today's reading goal is not yet completed"}
              </Text>
            </View>
            <Switch
              value={settings.dailyReminderEnabled}
              onValueChange={(val) => setSettings((prev) => ({ ...prev, dailyReminderEnabled: val }))}
              trackColor={{ false: '#374151', true: '#D84A6A' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Reminder Time Selector */}
          {settings.dailyReminderEnabled && (
            <View style={styles.timeSection}>
              <Text style={styles.sectionHeading}>Scheduled Reminder Time</Text>
              <View style={styles.presetsRow}>
                {PRESET_TIMES.map((time) => {
                  const isSelected = customTime === time;
                  return (
                    <TouchableOpacity
                      key={time}
                      style={[styles.presetChip, isSelected && styles.presetChipActive]}
                      onPress={() => setCustomTime(time)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                        {time}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.customTimeRow}>
                <Clock size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
                <Text style={styles.customTimeLabel}>Custom (HH:mm):</Text>
                <TextInput
                  style={styles.timeInput}
                  value={customTime}
                  onChangeText={setCustomTime}
                  placeholder="20:00"
                  placeholderTextColor="#6B7280"
                  maxLength={5}
                />
              </View>
            </View>
          )}

          {/* Live Milestone Alerts */}
          <View style={[styles.settingRow, { marginTop: 12 }]}>
            <View style={styles.settingLabelCol}>
              <Text style={styles.settingTitle}>In-Reader Milestone Toasts</Text>
              <Text style={styles.settingDescription}>
                Celebrations at 25%, 50% (Halfway), 75%, and 100% of your daily goal
              </Text>
            </View>
            <Switch
              value={settings.milestoneToastsEnabled}
              onValueChange={(val) => setSettings((prev) => ({ ...prev, milestoneToastsEnabled: val }))}
              trackColor={{ false: '#374151', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Test Notification Action */}
          <TouchableOpacity
            style={styles.testBtn}
            onPress={handleTestNotification}
            activeOpacity={0.8}
          >
            <Sparkles size={16} color="#D84A6A" style={{ marginRight: 8 }} />
            <Text style={styles.testBtnText}>Send Test Notification Now</Text>
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Settings'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#121318',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(216, 74, 106, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Fonts.serif,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  permissionTextCol: {
    marginLeft: 10,
    flex: 1,
  },
  permissionBannerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FBBF24',
  },
  permissionBannerSub: {
    fontSize: 11,
    color: '#D1D5DB',
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  settingLabelCol: {
    flex: 1,
    paddingRight: 16,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 3,
    lineHeight: 16,
  },
  timeSection: {
    backgroundColor: '#181A20',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  presetChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#27272A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  presetChipActive: {
    backgroundColor: '#D84A6A',
    borderColor: '#D84A6A',
  },
  presetText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D1D5DB',
  },
  presetTextActive: {
    color: '#FFFFFF',
  },
  customTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customTimeLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    marginRight: 8,
  },
  timeInput: {
    backgroundColor: '#27272A',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    width: 70,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(216, 74, 106, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(216, 74, 106, 0.3)',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 18,
  },
  testBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D84A6A',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1F2937',
  },
  cancelBtnText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#D84A6A',
  },
  saveBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
