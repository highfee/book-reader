import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { BookRepository } from '@/services/database/bookRepository';

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    async function checkDirectory() {
      try {
        const [dir, onboarded] = await Promise.all([
          BookRepository.getSetting('reading_directory_uri'),
          BookRepository.getSetting('onboarding_completed'),
        ]);
        setTarget(dir || onboarded ? '/(tabs)' : '/onboarding');
      } catch {
        setTarget('/onboarding');
      }
    }
    checkDirectory();
  }, []);

  if (!target) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#0D0E11',
        }}
      >
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return <Redirect href={target as any} />;
}
