import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  TextInput,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Folder,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Cpu,
  Info,
  ChevronRight,
  Cloud,
  Key,
  BookOpen,
  Type,
  Palette,
  Volume2,
  Download,
  Check,
  AlertTriangle,
  Sparkles,
} from 'lucide-react-native';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { useReadingStore } from '@/stores/useReadingStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { DatabaseService } from '@/services/database/db';
import { BookRepository } from '@/services/database/bookRepository';
import { GeminiAIService } from '@/services/ai/geminiService';
import { ReadingNotificationService } from '@/services/notifications/readingNotificationService';
import { AuthModal } from '@/components/auth/AuthModal';

export default function SettingsScreen() {
  const {
    directoryUri,
    selectDirectoryAndScan,
    rescanDirectory,
    isScanning,
    initialize,
  } = useLibraryStore();

  const { user, checkUser, lastSyncedAt } = useAuthStore();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [isKeyFocused, setIsKeyFocused] = useState(false);

  // Dynamic Options
  const [readerTheme, setReaderTheme] = useState('parchment');
  const [readerFont, setReaderFont] = useState('serif');
  const [readerFontSize, setReaderFontSize] = useState('18');
  const [aiPersona, setAiPersona] = useState('scholar');
  const [strictSpoilers, setStrictSpoilers] = useState(true);
  const [ttsSpeed, setTtsSpeed] = useState('1.0');

  // Reset confirmation state
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  const loadSettings = async () => {
    try {
      const savedKey = await BookRepository.getSetting('gemini_api_key');
      if (savedKey) {
        setApiKey(savedKey);
        GeminiAIService.setApiKey(savedKey);
      }
      const savedModel = await BookRepository.getSetting('gemini_model');
      if (savedModel) {
        setSelectedModel(savedModel);
        GeminiAIService.setModelName(savedModel);
      }

      // Dynamic options
      const theme = await BookRepository.getSetting('reader_default_theme');
      if (theme) setReaderTheme(theme);

      const font = await BookRepository.getSetting('reader_default_font');
      if (font) setReaderFont(font);

      const size = await BookRepository.getSetting('reader_default_font_size');
      if (size) setReaderFontSize(size);

      const persona = await BookRepository.getSetting('ai_persona');
      if (persona) setAiPersona(persona);

      const spoilers = await BookRepository.getSetting('strict_spoilers');
      if (spoilers !== null) setStrictSpoilers(spoilers === 'true');

      const speed = await BookRepository.getSetting('tts_speed');
      if (speed) setTtsSpeed(speed);
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    checkUser();
    loadSettings();
  }, []);

  const handleSelectModel = async (model: string) => {
    setSelectedModel(model);
    GeminiAIService.setModelName(model);
    await BookRepository.setSetting('gemini_model', model);
  };

  const handleSaveApiKey = async () => {
    try {
      await BookRepository.setSetting('gemini_api_key', apiKey.trim());
      GeminiAIService.setApiKey(apiKey.trim());
      setIsEditingKey(false);
      Alert.alert('Saved', 'Gemini API settings updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save API key');
    }
  };

  const handleSaveSetting = async (key: string, value: string, setter: (v: any) => void) => {
    setter(value);
    await BookRepository.setSetting(key, value);
  };

  const handleToggleSpoilers = async () => {
    const nextVal = !strictSpoilers;
    setStrictSpoilers(nextVal);
    await BookRepository.setSetting('strict_spoilers', nextVal.toString());
  };

  const performResetDatabase = async () => {
    try {
      setIsResetting(true);
      await DatabaseService.resetDatabase();
      useReadingStore.getState().resetReadingState();
      ReadingNotificationService.resetDailyState();
      await initialize();
      setIsResetting(false);
      setShowResetModal(false);
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 5000);
    } catch (err: any) {
      setIsResetting(false);
      Alert.alert('Error', err?.message || 'Failed to reset database');
    }
  };

  const handleExportNotes = async () => {
    try {
      const allBooks = await BookRepository.getAllBooks();
      const exportData: any[] = [];
      for (const b of allBooks) {
        const notes = await BookRepository.getNotesForBook(b.id);
        if (notes.length > 0) {
          exportData.push({
            bookId: b.id,
            bookTitle: b.title,
            author: b.author,
            format: b.format,
            notesCount: notes.length,
            notes: notes.map((n) => ({
              id: n.id,
              pageNumber: n.pageNumber,
              text: n.text,
              note: n.note,
              createdAt: n.createdAt,
            })),
          });
        }
      }

      const jsonStr = JSON.stringify(exportData, null, 2);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lumina-reader-notes-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setExportSuccessMsg(
        `Exported ${exportData.reduce((acc, b) => acc + b.notesCount, 0)} notes across ${exportData.length} books.`
      );
      setTimeout(() => setExportSuccessMsg(null), 4000);
    } catch (err: any) {
      Alert.alert('Export Error', err?.message || 'Failed to export notes');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Personalize reader, AI companion, and storage</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Reset Success Toast */}
        {resetSuccess && (
          <View style={styles.successBanner}>
            <Check size={16} color="#059669" style={{ marginRight: 8 }} />
            <Text style={styles.successBannerText}>
              Local database index has been completely reset and reinitialized.
            </Text>
          </View>
        )}

        {/* Export Success Toast */}
        {exportSuccessMsg && (
          <View style={[styles.successBanner, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <Download size={16} color="#16A34A" style={{ marginRight: 8 }} />
            <Text style={[styles.successBannerText, { color: '#15803D' }]}>{exportSuccessMsg}</Text>
          </View>
        )}

        {/* Reading & Typography Defaults */}
        <Text style={styles.sectionHeader}>READING & TYPOGRAPHY DEFAULTS</Text>
        <View style={styles.card}>
          {/* Paper Theme */}
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Palette size={15} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={styles.settingLabel}>Default Paper Theme</Text>
            </View>
            <View style={styles.optionsRow}>
              {[
                { id: 'parchment', label: 'Parchment', color: '#FAF8F5', border: '#E7E5E4' },
                { id: 'cream', label: 'Warm Cream', color: '#FFFBEB', border: '#FDE68A' },
                { id: 'sepia', label: 'Sepia', color: '#FBF0D9', border: '#E2CEB0' },
                { id: 'obsidian', label: 'Obsidian', color: '#18181B', border: '#3F3F46', textLight: true },
              ].map((theme) => {
                const isSelected = readerTheme === theme.id;
                return (
                  <TouchableOpacity
                    key={theme.id}
                    onPress={() => handleSaveSetting('reader_default_theme', theme.id, setReaderTheme)}
                    style={[
                      styles.themePill,
                      { backgroundColor: theme.color, borderColor: isSelected ? '#D97706' : theme.border },
                      isSelected && styles.pillSelectedBorder,
                    ]}
                  >
                    <Text
                      style={[
                        styles.themePillText,
                        { color: theme.textLight ? '#F4F4F5' : '#1C1917' },
                        isSelected && { fontWeight: '700' },
                      ]}
                    >
                      {theme.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Typeface */}
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Type size={15} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={styles.settingLabel}>Default Typeface</Text>
            </View>
            <View style={styles.optionsRow}>
              {[
                { id: 'serif', label: 'Editorial Serif' },
                { id: 'sans', label: 'Clean Sans' },
                { id: 'mono', label: 'Monospace' },
              ].map((font) => {
                const isSelected = readerFont === font.id;
                return (
                  <TouchableOpacity
                    key={font.id}
                    onPress={() => handleSaveSetting('reader_default_font', font.id, setReaderFont)}
                    style={[styles.choicePill, isSelected && styles.choicePillActive]}
                  >
                    <Text style={[styles.choicePillText, isSelected && styles.choicePillTextActive]}>
                      {font.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Font Size Scale */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <BookOpen size={15} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={styles.settingLabel}>Default Reading Scale</Text>
            </View>
            <View style={styles.optionsRow}>
              {[
                { id: '16', label: 'Compact (16px)' },
                { id: '18', label: 'Balanced (18px)' },
                { id: '22', label: 'Generous (22px)' },
                { id: '26', label: 'Large (26px)' },
              ].map((sz) => {
                const isSelected = readerFontSize === sz.id;
                return (
                  <TouchableOpacity
                    key={sz.id}
                    onPress={() => handleSaveSetting('reader_default_font_size', sz.id, setReaderFontSize)}
                    style={[styles.choicePill, isSelected && styles.choicePillActive]}
                  >
                    <Text style={[styles.choicePillText, isSelected && styles.choicePillTextActive]}>
                      {sz.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* AI Companion & Personas */}
        <Text style={styles.sectionHeader}>AI COMPANION & PERSONAS</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: '#FDF2F8' }]}>
              <Sparkles size={20} color="#D97706" />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Gemini AI Reading Companion</Text>
              <Text style={styles.rowSubtitle}>
                Spoiler-safe discussions, character recall, and recaps
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Persona Selection */}
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.settingLabel, { marginBottom: 8 }]}>Companion Persona</Text>
            <View style={styles.optionsRow}>
              {[
                { id: 'companion', label: 'Companion', desc: 'Warm & reflective chat' },
                { id: 'scholar', label: 'Scholar', desc: 'Literary & historical depth' },
              ].map((p) => {
                const isSelected = (aiPersona === p.id) || (aiPersona === 'bookclub' && p.id === 'companion');
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => handleSaveSetting('ai_persona', p.id, setAiPersona)}
                    style={[styles.choicePill, isSelected && styles.choicePillActive]}
                  >
                    <Text style={[styles.choicePillText, isSelected && styles.choicePillTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Strict Spoiler Guard Toggle */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={handleToggleSpoilers}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.settingLabel}>Strict Spoiler Locking</Text>
              <Text style={styles.settingSubtext}>
                Queries strictly seal upcoming chapter text. Companion only ever knows what you have turned.
              </Text>
            </View>
            <View
              style={[
                styles.toggleTrack,
                strictSpoilers ? styles.toggleTrackActive : styles.toggleTrackInactive,
              ]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  strictSpoilers ? styles.toggleThumbActive : styles.toggleThumbInactive,
                ]}
              />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* API Key Input */}
          <View style={{ paddingVertical: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Key size={14} color="#D97706" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B' }}>
                  Gemini API Key (Optional)
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditingKey(!isEditingKey)}>
                <Text style={{ fontSize: 12, color: '#D97706', fontWeight: '600' }}>
                  {isEditingKey ? 'Cancel' : apiKey ? 'Edit Key' : 'Add Key'}
                </Text>
              </TouchableOpacity>
            </View>

            {isEditingKey ? (
              <View style={{ gap: 8 }}>
                <TextInput
                  style={[
                    styles.keyInput,
                    isKeyFocused && styles.keyInputFocused,
                    Platform.select({ web: { outlineStyle: 'none' } as any }),
                  ]}
                  placeholder="Paste your Gemini API key (AIza...)"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  value={apiKey}
                  onChangeText={setApiKey}
                  onFocus={() => setIsKeyFocused(true)}
                  onBlur={() => setIsKeyFocused(false)}
                />
                <TouchableOpacity style={styles.saveKeyBtn} onPress={handleSaveApiKey}>
                  <Text style={styles.saveKeyBtnText}>Save API Key</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: apiKey ? '#059669' : '#64748B' }}>
                {apiKey ? '✓ Custom Gemini API Key configured' : 'Using smart offline companion fallback'}
              </Text>
            )}
          </View>

          {/* Model Selector */}
          <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
              Active Gemini Model
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
                { id: 'gemini-3.1-flash', label: 'Gemini 3.1 Flash' },
                { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
              ].map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => handleSelectModel(m.id)}
                    style={[styles.choicePill, isSelected && styles.choicePillActive]}
                  >
                    <Text style={[styles.choicePillText, isSelected && styles.choicePillTextActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Text-to-speech Narration */}
        <Text style={styles.sectionHeader}>TEXT-TO-SPEECH (TTS)</Text>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Volume2 size={16} color="#D97706" style={{ marginRight: 6 }} />
            <Text style={styles.settingLabel}>TTS Narration Pace</Text>
          </View>
          <View style={styles.optionsRow}>
            {['0.8x', '1.0x', '1.2x', '1.5x'].map((speed) => {
              const isSelected = ttsSpeed === speed;
              return (
                <TouchableOpacity
                  key={speed}
                  onPress={() => handleSaveSetting('tts_speed', speed, setTtsSpeed)}
                  style={[styles.choicePill, isSelected && styles.choicePillActive]}
                >
                  <Text style={[styles.choicePillText, isSelected && styles.choicePillTextActive]}>
                    {speed}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Notes & Data Backup */}
        <Text style={styles.sectionHeader}>NOTES & DATA EXPORT</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.actionRow} onPress={handleExportNotes}>
            <View style={styles.row}>
              <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Download size={20} color="#D97706" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Export Notes & Highlights</Text>
                <Text style={styles.rowSubtitle}>
                  Download all your bookmarks, thoughts, and quotes in clean JSON format
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Appwrite Cloud Sync Section */}
        <Text style={styles.sectionHeader}>ACCOUNT & CLOUD SYNC (APPWRITE)</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => setShowAuthModal(true)}
          >
            <View style={styles.row}>
              <View style={[styles.iconCircle, { backgroundColor: '#EEF2FF' }]}>
                <Cloud size={20} color="#4F46E5" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>
                  {user ? user.name || user.email : 'Sign In to Appwrite'}
                </Text>
                <Text style={styles.rowSubtitle}>
                  {user
                    ? `Synced at: ${lastSyncedAt || 'Just now'} • Progress backed up`
                    : 'Sync reading progress across devices'}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Storage / SAF Directory Section */}
        <Text style={styles.sectionHeader}>BOOK STORAGE</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Folder size={20} color="#D97706" />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Reading Directory</Text>
              <Text numberOfLines={2} style={styles.rowSubtitle}>
                {directoryUri ? decodeURIComponent(directoryUri) : 'No directory configured'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.actionRow}
            onPress={selectDirectoryAndScan}
            disabled={isScanning}
          >
            <Text style={styles.actionText}>Change Books Directory</Text>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.actionRow}
            onPress={rescanDirectory}
            disabled={isScanning || !directoryUri}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <RefreshCw size={16} color="#D97706" style={{ marginRight: 8 }} />
              <Text style={styles.actionText}>Rescan Current Directory</Text>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Privacy & Legal Section */}
        <Text style={styles.sectionHeader}>PRIVACY & SECURITY</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
              <ShieldCheck size={20} color="#10B981" />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Offline-First Guarantee</Text>
              <Text style={styles.rowSubtitle}>
                Your book files remain strictly on your device. Only metadata and progress sync.
              </Text>
            </View>
          </View>
        </View>

        {/* Danger Zone */}
        <Text style={[styles.sectionHeader, { color: '#DC2626' }]}>DANGER ZONE</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.dangerRow}
            onPress={() => setShowResetModal(true)}
            activeOpacity={0.7}
          >
            <Trash2 size={18} color="#DC2626" style={{ marginRight: 10 }} />
            <Text style={styles.dangerText}>Reset Local Database Index</Text>
          </TouchableOpacity>
        </View>

        {/* App Version Info */}
        <View style={styles.versionWrapper}>
          <Info size={14} color="#9CA3AF" style={{ marginRight: 4 }} />
          <Text style={styles.versionText}>
            Lumina Reader AI v1.0.0 • Platform: {Platform.OS}
          </Text>
        </View>
      </ScrollView>

      {/* Appwrite Auth Modal */}
      <AuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* Cross-Platform Luxury Reset Confirmation Modal */}
      <Modal
        visible={showResetModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isResetting && setShowResetModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !isResetting && setShowResetModal(false)}
        >
          <Pressable style={styles.modalDialog} onPress={(e) => e.stopPropagation()}>
            <View style={styles.resetModalIconWrapper}>
              <AlertTriangle size={28} color="#DC2626" />
            </View>

            <Text style={styles.resetModalTitle}>Reset Local Database?</Text>
            <Text style={styles.resetModalDescription}>
              This will wipe all indexed books, reading positions, active-recall flashcards, custom shelves, and cached summaries from this device.
            </Text>

            <View style={styles.resetNoticeBox}>
              <Text style={styles.resetNoticeText}>
                Your original book files on your storage will NOT be modified or deleted.
              </Text>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowResetModal(false)}
                disabled={isResetting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmResetBtn}
                onPress={performResetDatabase}
                disabled={isResetting}
              >
                {isResetting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmResetBtnText}>Reset Everything</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0E11',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#0D0E11',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  successBannerText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
    flex: 1,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 14,
  },
  card: {
    backgroundColor: '#16181D',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 12,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  settingSubtext: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
    lineHeight: 15,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  choicePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1F222A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  choicePillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  choicePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  choicePillTextActive: {
    color: '#0D0E11',
    fontWeight: '800',
  },
  themePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  pillSelectedBorder: {
    borderColor: '#D97706',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  themePillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  toggleTrackActive: {
    backgroundColor: '#D97706',
  },
  toggleTrackInactive: {
    backgroundColor: '#D6D3D1',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  toggleThumbInactive: {
    alignSelf: 'flex-start',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#D97706',
  },
  keyInput: {
    backgroundColor: '#F5F5F4',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: '#1C1917',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  keyInputFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D97706',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  saveKeyBtn: {
    backgroundColor: '#1C1917',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveKeyBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dangerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  versionWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  versionText: {
    fontSize: 12,
    color: '#A8A29E',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(28, 25, 23, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  resetModalIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  resetModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
  },
  resetModalDescription: {
    fontSize: 13,
    color: '#57534E',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  resetNoticeBox: {
    backgroundColor: '#F5F5F4',
    borderRadius: 10,
    padding: 10,
    width: '100%',
    marginBottom: 20,
  },
  resetNoticeText: {
    fontSize: 11,
    color: '#78716C',
    textAlign: 'center',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F5F5F4',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#57534E',
  },
  confirmResetBtn: {
    flex: 1.2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  confirmResetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
