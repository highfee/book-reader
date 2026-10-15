import '@/global.css';
import React, { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { DatabaseService } from '@/services/database/db';
import { ReadingNotificationService } from '@/services/notifications/readingNotificationService';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await DatabaseService.getDatabase();
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
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="book/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="reader/[id]" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
