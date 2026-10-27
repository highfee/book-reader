import '@/global.css';
import React, { useEffect, useState } from 'react';
import { DarkTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { DatabaseService } from '@/services/database/db';
import { ReadingNotificationService } from '@/services/notifications/readingNotificationService';
import { AlertHost } from '@/utils/alert';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await DatabaseService.getDatabase();
        await ReadingNotificationService.configure();
        await ReadingNotificationService.scheduleDailyReminderDaemon();
      } catch (e) {
        console.warn('Database initialization error:', e);
      } finally {
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, []);

  if (!appIsReady) {
    return null;
  }

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="book/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="reader/[id]" options={{ headerShown: false }} />
      </Stack>
      <AlertHost />
    </ThemeProvider>
  );
}
