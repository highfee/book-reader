import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AlertButton, AlertOptions } from 'react-native';
import { AppPalette } from '@/constants/theme';

interface QueuedAlert {
  title?: string;
  message?: string;
  buttons: AlertButton[];
  cancelable: boolean;
  onDismiss?: () => void;
}

/**
 * react-native-web ships `Alert.alert` as an empty static method, so a browser reader who pressed
 * Delete Shelf got nothing back — the confirmation and its action both vanished. This host renders
 * the same call as a real dialog, and the queue lets a second alert (an error behind a confirmation)
 * still be seen instead of being dropped.
 */
let queue: QueuedAlert[] = [];
let notify: () => void = () => {};

function dismiss(active: QueuedAlert, button?: AlertButton) {
  queue = queue.filter((entry) => entry !== active);
  notify();
  if (button) button.onPress?.();
  else active.onDismiss?.();
}

export const WebAlert = {
  alert(title?: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void {
    queue = [
      ...queue,
      {
        title,
        message,
        buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
        cancelable: options?.cancelable !== false,
        onDismiss: options?.onDismiss,
      },
    ];
    notify();
  },
};

export function WebAlertHost() {
  const [, setVersion] = useState(0);

  useEffect(() => {
    notify = () => setVersion((v) => v + 1);
    notify();
    return () => {
      notify = () => {};
    };
  }, []);

  const active = queue[0];
  if (!active) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => dismiss(active)}
    >
      <Pressable
        style={styles.overlay}
        onPress={() => (active.cancelable ? dismiss(active) : undefined)}
      >
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {Boolean(active.title) && <Text style={styles.title}>{active.title}</Text>}
          {Boolean(active.message) && <Text style={styles.message}>{active.message}</Text>}

          <View style={styles.actions}>
            {active.buttons.map((button, index) => (
              <Pressable
                key={`${button.text}-${index}`}
                style={[
                  styles.action,
                  button.style === 'destructive' && styles.actionDestructive,
                  button.style === 'cancel' && styles.actionCancel,
                ]}
                onPress={() => dismiss(active, button)}
              >
                <Text
                  style={[
                    styles.actionText,
                    button.style === 'destructive' && styles.actionTextDestructive,
                    button.style === 'cancel' && styles.actionTextCancel,
                  ]}
                >
                  {button.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#16181D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  message: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 18,
  },
  action: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionDestructive: {
    backgroundColor: AppPalette.accentBerry,
  },
  actionCancel: {
    backgroundColor: 'transparent',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  actionTextDestructive: {
    color: '#FFFFFF',
  },
  actionTextCancel: {
    color: '#9CA3AF',
  },
});
