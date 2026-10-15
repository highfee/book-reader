import { create } from 'zustand';
import { AppwriteService } from '@/services/appwrite/appwriteClient';
import { ID } from 'react-native-appwrite';

interface AuthState {
  user: any | null;
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncMessage: string | null;

  checkUser: () => Promise<void>;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, pass: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  triggerSync: () => Promise<{ success: boolean; message: string }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isSyncing: false,
  lastSyncedAt: null,
  syncMessage: null,

  checkUser: async () => {
    try {
      set({ isLoading: true });
      const user = await AppwriteService.getCurrentUser();
      set({ user, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  login: async (email, pass) => {
    try {
      set({ isLoading: true });
      const account = AppwriteService.getAccount();
      await account.createEmailPasswordSession(email, pass);
      const user = await account.get();
      set({ user, isLoading: false });
      // Trigger cloud pull and sync immediately upon login
      await AppwriteService.pullProgressFromCloud();
      await AppwriteService.syncLocalProgressToCloud();
      return { success: true };
    } catch (err: any) {
      set({ isLoading: false });
      return { success: false, error: err?.message || 'Login failed' };
    }
  },

  register: async (email, pass, name) => {
    try {
      set({ isLoading: true });
      const account = AppwriteService.getAccount();
      await account.create(ID.unique(), email, pass, name);
      await account.createEmailPasswordSession(email, pass);
      const user = await account.get();
      set({ user, isLoading: false });
      return { success: true };
    } catch (err: any) {
      set({ isLoading: false });
      return { success: false, error: err?.message || 'Registration failed' };
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true });
      const account = AppwriteService.getAccount();
      await account.deleteSession('current');
      set({ user: null, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  triggerSync: async () => {
    try {
      set({ isSyncing: true, syncMessage: 'Syncing with Appwrite cloud...' });
      const pullCount = await AppwriteService.pullProgressFromCloud();
      const pushResult = await AppwriteService.syncLocalProgressToCloud();

      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      set({
        isSyncing: false,
        lastSyncedAt: time,
        syncMessage: `Synced ${pushResult.syncedCount} items at ${time}`,
      });

      return {
        success: pushResult.success,
        message: `Synced ${pushResult.syncedCount} items successfully.`,
      };
    } catch (err: any) {
      set({ isSyncing: false, syncMessage: 'Sync failed' });
      return { success: false, message: err?.message || 'Sync failed' };
    }
  },
}));
