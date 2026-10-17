import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { BookRepository } from '@/services/database/bookRepository';

const TARGET_CHANNEL_ID = 'reading-daily-target';
const SCHEDULED_REMINDER_KEY = 'notification_scheduled_reminder_id';

export interface NotificationSettings {
  dailyReminderEnabled: boolean;
  reminderTime: string; // "HH:mm" e.g. "20:00"
  milestoneToastsEnabled: boolean;
  sprintRemindersEnabled: boolean;
}

export type MilestonePercent = 25 | 50 | 75 | 100;

export interface GoalPaceInsight {
  targetMinutes: number;
  readMinutes: number;
  remainingMinutes: number;
  percentComplete: number;
  isGoalMet: boolean;
  statusMessage: string;
}

export class ReadingNotificationService {
  private static timerHandle: any = null;
  private static notifiedMilestonesToday: Set<MilestonePercent> = new Set();
  private static listeners: Set<(event: { type: string; title: string; body: string }) => void> = new Set();

  /**
   * Subscribe to in-app milestone / reminder toast events
   */
  static subscribe(listener: (event: { type: string; title: string; body: string }) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static emitEvent(type: string, title: string, body: string) {
    this.listeners.forEach((fn) => {
      try {
        fn({ type, title, body });
      } catch (e) {
        console.warn('Listener error in notification service:', e);
      }
    });
  }

  /**
   * Load user's notification preferences from database
   */
  static async getSettings(): Promise<NotificationSettings> {
    try {
      const enabled = await BookRepository.getSetting('notification_daily_enabled');
      const time = await BookRepository.getSetting('notification_daily_time');
      const milestones = await BookRepository.getSetting('notification_milestones_enabled');
      const sprints = await BookRepository.getSetting('notification_sprint_reminders');

      return {
        dailyReminderEnabled: enabled !== null ? enabled === 'true' : true,
        reminderTime: time || '20:00',
        milestoneToastsEnabled: milestones !== null ? milestones === 'true' : true,
        sprintRemindersEnabled: sprints !== null ? sprints === 'true' : true,
      };
    } catch {
      return {
        dailyReminderEnabled: true,
        reminderTime: '20:00',
        milestoneToastsEnabled: true,
        sprintRemindersEnabled: true,
      };
    }
  }

  /**
   * Save user's notification preferences
   */
  static async saveSettings(settings: Partial<NotificationSettings>): Promise<void> {
    if (settings.dailyReminderEnabled !== undefined) {
      await BookRepository.setSetting('notification_daily_enabled', String(settings.dailyReminderEnabled));
    }
    if (settings.reminderTime !== undefined) {
      await BookRepository.setSetting('notification_daily_time', settings.reminderTime);
    }
    if (settings.milestoneToastsEnabled !== undefined) {
      await BookRepository.setSetting('notification_milestones_enabled', String(settings.milestoneToastsEnabled));
    }
    if (settings.sprintRemindersEnabled !== undefined) {
      await BookRepository.setSetting('notification_sprint_reminders', String(settings.sprintRemindersEnabled));
    }
    // Re-schedule reminder daemon with new time/setting
    await this.scheduleDailyReminderDaemon();
  }

  /**
   * One-time startup work: foreground presentation rules and the Android channel.
   * expo-notifications has no scheduler on web, so every call here is native-only.
   */
  static async configure(): Promise<void> {
    if (Platform.OS === 'web') return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(TARGET_CHANNEL_ID, {
        name: 'Reading targets',
        description: 'Daily goal reminders and milestone celebrations',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#D97706',
      });
    }
  }

  /**
   * Requests system / web notification permissions
   */
  static async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !('Notification' in window)) return false;
      try {
        const result = await window.Notification.requestPermission();
        return result === 'granted';
      } catch (e) {
        console.warn('Error requesting Web notification permission:', e);
        return false;
      }
    }

    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (e) {
      console.warn('Error requesting notification permission:', e);
      return false;
    }
  }

  /**
   * Checks current permission status
   */
  static async hasPermission(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' && 'Notification' in window
        ? window.Notification.permission === 'granted'
        : false;
    }

    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Dispatches a notification through the platform presenter and in-app listeners
   */
  static async dispatchNotification(title: string, body: string, vibrate = true) {
    if (vibrate) {
      try {
        Vibration.vibrate(Platform.OS === 'android' ? [0, 150, 100, 200] : 200);
      } catch {
        // Safe fallback
      }
    }

    // In-app listener broadcast
    this.emitEvent('notification', title, body);

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (window.Notification.permission === 'granted') {
          try {
            new window.Notification(title, {
              body,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
            });
          } catch (e) {
            console.warn('Web notification dispatch error:', e);
          }
        }
      }
      return;
    }

    try {
      // A channelId-only trigger delivers immediately; the handler installed in
      // configure() decides whether it is shown while the app is up.
      await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: Platform.OS === 'android' ? { channelId: TARGET_CHANNEL_ID } : null,
      });
    } catch (e) {
      console.warn('Native notification dispatch error:', e);
    }
  }

  /**
   * Calculates progress toward the daily goal and returns insights
   */
  static calculatePaceInsight(targetMinutes: number, readMinutes: number): GoalPaceInsight {
    const target = Math.max(1, targetMinutes);
    const read = Math.max(0, readMinutes);
    const remaining = Math.max(0, target - read);
    const percent = Math.min(100, Math.round((read / target) * 100));
    const isGoalMet = read >= target;

    let statusMessage = '';
    if (isGoalMet) {
      statusMessage = `🎉 Goal reached! You completed ${read}m today. Outstanding dedication!`;
    } else if (percent >= 75) {
      statusMessage = `Almost there! Just ${remaining}m left to seal today's goal.`;
    } else if (percent >= 50) {
      statusMessage = `Halfway mark passed (${percent}%). ${remaining}m remaining today.`;
    } else if (percent >= 25) {
      statusMessage = `Solid start! ${remaining}m left to complete your daily target.`;
    } else {
      statusMessage = `${remaining}m to reach your daily goal. Ready for a sprint?`;
    }

    return {
      targetMinutes: target,
      readMinutes: read,
      remainingMinutes: remaining,
      percentComplete: percent,
      isGoalMet,
      statusMessage,
    };
  }

  /**
   * Checks for reading milestone thresholds (25%, 50%, 75%, 100%) during an active reading session
   */
  static async checkMilestoneCrossed(targetMinutes: number, totalMinutesToday: number): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.milestoneToastsEnabled) return;

    const percent = Math.floor((totalMinutesToday / Math.max(1, targetMinutes)) * 100);

    const milestones: MilestonePercent[] = [25, 50, 75, 100];
    for (const m of milestones) {
      if (percent >= m && !this.notifiedMilestonesToday.has(m)) {
        this.notifiedMilestonesToday.add(m);

        let title = '';
        let body = '';
        if (m === 100) {
          title = '🏆 Daily Reading Target Achieved!';
          body = `Incredible work! You completed your full ${targetMinutes >= 60 ? (targetMinutes / 60).toFixed(1) + ' hrs' : targetMinutes + 'm'} goal for today!`;
        } else if (m === 75) {
          title = '⚡ 75% Target Milestone!';
          body = `Final stretch! Only ${targetMinutes - totalMinutesToday} minutes remaining to seal today's reading goal.`;
        } else if (m === 50) {
          title = '🎯 Halfway There (50%)!';
          body = `You are halfway to your daily target with ${totalMinutesToday}m read today!`;
        } else {
          title = '📖 First Milestone (25%)!';
          body = `Great momentum! ${totalMinutesToday}m read today toward your ${targetMinutes}m target.`;
        }

        await this.dispatchNotification(title, body, true);
        break; // Only trigger one milestone step per check
      }
    }
  }

  /**
   * Arms the next daily nudge. Native hands the notification to the operating
   * system so it still fires with the app closed; web has no scheduler, so it can
   * only poll while a tab is open.
   */
  static async scheduleDailyReminderDaemon(): Promise<void> {
    this.stopPoller();

    if (Platform.OS === 'web') {
      this.startWebPoller();
      return;
    }

    // Clear only the reminder this service owns, so other scheduled
    // notifications in the app survive a goal change.
    const previousId = await BookRepository.getSetting(SCHEDULED_REMINDER_KEY);
    if (previousId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(previousId);
      } catch (err) {
        console.warn('Could not clear the previous reminder:', err);
      }
      await BookRepository.setSetting(SCHEDULED_REMINDER_KEY, '');
    }

    const settings = await this.getSettings();
    if (!settings.dailyReminderEnabled) return;

    const [hour, minute] = this.parseReminderTime(settings.reminderTime);
    const targetDate = this.nextOccurrence(hour, minute);
    if (!targetDate) return;

    const remaining = await this.minutesRemainingOn(targetDate);
    // The goal is already closed for the day the nudge would land on.
    if (remaining <= 0) return;

    const targetText = this.formatMinutes(remaining);
    try {
      const scheduledId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📚 Daily Reading Reminder',
          body: `Keep your streak alive! ${targetText} left to reach today's goal.`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
          ...(Platform.OS === 'android' ? { channelId: TARGET_CHANNEL_ID } : {}),
        },
      });
      // A DATE trigger fires once, so the id is kept to replace it on the next
      // app start instead of stacking nudges.
      await BookRepository.setSetting(SCHEDULED_REMINDER_KEY, scheduledId);
    } catch (err) {
      console.warn('Could not schedule the daily reminder:', err);
    }
  }

  /**
   * Web-only fallback: checks each minute whether reminder time has arrived.
   * Only runs while the tab is open, which is the browser's limit, not ours.
   */
  private static startWebPoller(): void {
    void this.getSettings().then((settings) => {
      if (!settings.dailyReminderEnabled) return;

      this.timerHandle = setInterval(async () => {
        try {
          const now = new Date();
          const currentHours = String(now.getHours()).padStart(2, '0');
          const currentMinutes = String(now.getMinutes()).padStart(2, '0');
          const currentTimeStr = `${currentHours}:${currentMinutes}`;

          if (currentTimeStr === settings.reminderTime) {
            const remaining = await this.minutesRemainingOn(now);
            if (remaining > 0) {
              await this.dispatchNotification(
                '📚 Daily Reading Reminder',
                `Keep your streak alive! ${this.formatMinutes(remaining)} left to reach today's goal.`,
                true
              );
            }
          }
        } catch (err) {
          console.warn('Error in daily reminder daemon:', err);
        }
      }, 60000);
    });
  }

  private static stopPoller(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  private static parseReminderTime(value: string): [number, number] {
    const [rawHour, rawMinute] = value.split(':');
    const hour = Number.parseInt(rawHour, 10);
    const minute = Number.parseInt(rawMinute, 10);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return [20, 0];
    return [Math.min(23, Math.max(0, hour)), Math.min(59, Math.max(0, minute))];
  }

  /** Next local occurrence of the hour:minute pair, or null if unusable. */
  private static nextOccurrence(hour: number, minute: number): Date | null {
    const target = new Date();
    target.setSeconds(0, 0);
    target.setHours(hour, minute);
    // Already past today's slot? Then the reminder belongs to tomorrow.
    if (target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1);
    }
    return target;
  }

  /** Minutes still owed toward the goal on the day `forDate` lands. */
  private static async minutesRemainingOn(forDate: Date): Promise<number> {
    const [actMap, goals] = await Promise.all([
      BookRepository.getReadingActivityMap(1),
      BookRepository.getReadingGoals(),
    ]);

    const dayKey = forDate.toISOString().substring(0, 10);
    const readMinutes = Math.round((actMap[dayKey]?.durationSeconds || 0) / 60);
    return Math.max(0, (goals.dailyMinutes || 20) - readMinutes);
  }

  private static formatMinutes(minutes: number): string {
    return minutes >= 60
      ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
      : `${minutes}m`;
  }

  /**
   * Resets today's tracked milestones (e.g. on new day or database reset)
   */
  static resetDailyState() {
    this.notifiedMilestonesToday.clear();
  }
}
