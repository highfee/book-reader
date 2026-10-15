import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { BookRepository } from '@/services/database/bookRepository';

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    async function checkDirectory() {
      try {
        const dir = await BookRepository.getSetting('reading_directory_uri');
        if (dir) {
          setTarget('/(tabs)');
        } else {
          setTarget('/onboarding');
        }
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
          backgroundColor: '#FAF8F5',
        }}
      >
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return <Redirect href={target as any} />;
}
