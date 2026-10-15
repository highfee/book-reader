import { Platform, Vibration } from 'react-native';
import { BookRepository } from '@/services/database/bookRepository';

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
   * Requests system / web notification permissions
   */
  static async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const result = await window.Notification.requestPermission();
        return result === 'granted';
      } catch (e) {
        console.warn('Error requesting Web notification permission:', e);
        return false;
      }
    }
    return true;
  }

  /**
   * Checks current permission status
   */
  static hasPermission(): boolean {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      return window.Notification.permission === 'granted';
    }
    return true;
  }

  /**
   * Dispatches a notification across native web Notification API and in-app listeners
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

    // Browser Notification API
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
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
   * Sets up a timer daemon to check if it's reminder time
   */
  static async scheduleDailyReminderDaemon(): Promise<void> {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }

    const settings = await this.getSettings();
    if (!settings.dailyReminderEnabled) return;

    // Run interval every 60 seconds to check against reminder time
    this.timerHandle = setInterval(async () => {
      try {
        const now = new Date();
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMinutes = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${currentHours}:${currentMinutes}`;

        if (currentTimeStr === settings.reminderTime) {
          // Check if today's reading target has already been met
          const todayStr = now.toISOString().substring(0, 10);
          const [actMap, goals] = await Promise.all([
            BookRepository.getReadingActivityMap(1),
            BookRepository.getReadingGoals(),
          ]);

          const todaySecs = actMap[todayStr]?.durationSeconds || 0;
          const todayMins = Math.round(todaySecs / 60);
          const targetMins = goals.dailyMinutes || 20;

          if (todayMins < targetMins) {
            const remaining = targetMins - todayMins;
            const targetText = targetMins >= 60 ? `${(targetMins / 60).toFixed(1)} hrs` : `${targetMins} mins`;
            const remainingText = remaining >= 60 ? `${Math.floor(remaining / 60)}h ${remaining % 60}m` : `${remaining}m`;

            await this.dispatchNotification(
              '📚 Daily Reading Reminder',
              `Keep your streak alive! You have ${remainingText} left to reach your ${targetText} goal today.`,
              true
            );
          }
        }
      } catch (err) {
        console.warn('Error in daily reminder daemon:', err);
      }
    }, 60000);
  }

  /**
   * Resets today's tracked milestones (e.g. on new day or database reset)
   */
  static resetDailyState() {
    this.notifiedMilestonesToday.clear();
  }
}
