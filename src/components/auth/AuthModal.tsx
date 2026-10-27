import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Alert } from '@/utils/alert';
import { X, Cloud, RefreshCw, LogOut, CheckCircle2, User, Lock, Mail } from 'lucide-react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { AppPalette } from '@/constants/theme';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose }) => {
  const { user, login, register, logout, triggerSync, isSyncing, lastSyncedAt } = useAuthStore();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<'name' | 'email' | 'password' | null>(null);

  const handleSubmit = async () => {
    if (!email || !password || (isRegisterMode && !name)) {
      Alert.alert('Incomplete Form', 'Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    let res;
    if (isRegisterMode) {
      res = await register(email, password, name);
    } else {
      res = await login(email, password);
    }
    setSubmitting(false);

    if (res.success) {
      Alert.alert('Success', isRegisterMode ? 'Account created & logged in!' : 'Logged in successfully!');
    } else {
      Alert.alert('Authentication Error', res.error || 'Something went wrong');
    }
  };

  const handleManualSync = async () => {
    const res = await triggerSync();
    Alert.alert(res.success ? 'Sync Completed' : 'Sync Issue', res.message);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Cloud size={20} color={AppPalette.accentBerry} style={{ marginRight: 8 }} />
              <Text style={styles.title}>Cloud Sync & Account</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {user ? (
            /* Logged-in State */
            <View style={styles.content}>
              <View style={styles.userCard}>
                <View style={styles.avatar}>
                  <User size={24} color={AppPalette.accentBerry} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{user.name || 'Reader'}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                </View>
                <View style={styles.statusPill}>
                  <CheckCircle2 size={12} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={styles.statusPillText}>Online</Text>
                </View>
              </View>

              <View style={styles.syncInfoCard}>
                <Text style={styles.syncInfoTitle}>Appwrite Cloud Sync</Text>
                <Text style={styles.syncInfoDesc}>
                  Your reading positions, streaks, and summaries sync seamlessly across your devices.
                  Your book files stay private and strictly local on this device.
                </Text>
                <Text style={styles.syncTime}>
                  Last synced: {lastSyncedAt ? lastSyncedAt : 'Never'}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.syncBtn, isSyncing && styles.btnDisabled]}
                onPress={handleManualSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <RefreshCw size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.syncBtnText}>Sync Progress Now</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                <LogOut size={16} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.logoutBtnText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Sign in / Register Form */
            <View style={styles.content}>
              <Text style={styles.formTitle}>
                {isRegisterMode ? 'Create Account' : 'Sign In to Sync'}
              </Text>
              <Text style={styles.formDesc}>
                Sign in to back up reading stats, progress, and AI companion recaps across devices.
              </Text>

              {isRegisterMode && (
                <View
                  style={[
                    styles.inputWrapper,
                    focusedField === 'name' && styles.inputWrapperFocused,
                  ]}
                >
                  <User
                    size={16}
                    color={focusedField === 'name' ? '#B45309' : '#9CA3AF'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[
                      styles.input,
                      Platform.select({ web: { outlineStyle: 'none' } as any }),
                    ]}
                    placeholder="Full Name"
                    placeholderTextColor="#9CA3AF"
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              )}

              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'email' && styles.inputWrapperFocused,
                ]}
              >
                <Mail
                  size={16}
                  color={focusedField === 'email' ? '#B45309' : '#9CA3AF'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    Platform.select({ web: { outlineStyle: 'none' } as any }),
                  ]}
                  placeholder="Email Address"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'password' && styles.inputWrapperFocused,
                ]}
              >
                <Lock
                  size={16}
                  color={focusedField === 'password' ? '#B45309' : '#9CA3AF'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    Platform.select({ web: { outlineStyle: 'none' } as any }),
                  ]}
                  placeholder="Password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, submitting && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {isRegisterMode ? 'Create Account' : 'Sign In'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchModeBtn}
                onPress={() => setIsRegisterMode(!isRegisterMode)}
              >
                <Text style={styles.switchModeText}>
                  {isRegisterMode
                    ? 'Already have an account? Sign In'
                    : "Don't have an account? Create one"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppPalette.accentBerryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  userEmail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  syncInfoCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  syncInfoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  syncInfoDesc: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
    marginBottom: 8,
  },
  syncTime: {
    fontSize: 11,
    color: AppPalette.accentBerry,
    fontWeight: '500',
  },
  syncBtn: {
    backgroundColor: AppPalette.accentBerry,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    marginBottom: 12,
  },
  syncBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  logoutBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  formDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 18,
    lineHeight: 18,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  inputWrapperFocused: {
    borderColor: '#D97706',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(217, 119, 6, 0.15)',
      } as any,
    }),
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  primaryBtn: {
    backgroundColor: AppPalette.accentBerry,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  switchModeBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  switchModeText: {
    fontSize: 13,
    color: AppPalette.accentBerry,
    fontWeight: '500',
  },
});
