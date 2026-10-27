import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { Alert } from '@/utils/alert';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FolderOpen,
  FileText,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { BookRepository } from '@/services/database/bookRepository';
import { AppPalette } from '@/constants/theme';

const { width } = Dimensions.get('window');

async function finishOnboarding(router: ReturnType<typeof useRouter>) {
  try {
    await BookRepository.setSetting('onboarding_completed', new Date().toISOString());
  } catch {
    // A failed write only means onboarding shows again; never block the reader.
  }
  router.replace('/(tabs)');
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { selectDirectoryAndScan, importFilesManually, addSampleBooks, isScanning } = useLibraryStore();
  const [loading, setLoading] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  const handleSelectDirectory = async () => {
    setShowOptionsModal(false);
    setLoading(true);
    try {
      const result = await selectDirectoryAndScan();
      if (result.success) {
        await finishOnboarding(router);
      } else if (result.error && !result.error.includes('denied')) {
        Alert.alert('Notice', result.error);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to select directory');
    } finally {
      setLoading(false);
    }
  };

  const handlePickSingleFiles = async () => {
    setShowOptionsModal(false);
    setLoading(true);
    try {
      await importFilesManually();
      await finishOnboarding(router);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to import files');
    } finally {
      setLoading(false);
    }
  };

  const handleExploreSamples = async () => {
    setShowOptionsModal(false);
    setLoading(true);
    try {
      await addSampleBooks();
      await finishOnboarding(router);
    } catch {
      await finishOnboarding(router);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Top Bar with Skip */}
        <View style={styles.topBar}>
          <View />
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => finishOnboarding(router)}
            activeOpacity={0.8}
          >
            <Text style={styles.skipBtnText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Visual Area: Open Book illuminated on dark backdrop */}
        <View style={styles.heroArea}>
          <View style={styles.bookBackdropGlow} />

          {/* Stylized Open Book matching Screen 1 */}
          <View style={styles.openBookContainer}>
            {/* Left Page (Typography text rows) */}
            <View style={styles.pageLeft}>
              <View style={styles.pageLeftTextColumn}>
                {Array.from({ length: 14 }).map((_, idx) => (
                  <View
                    key={`l-${idx}`}
                    style={[
                      styles.pageTextLine,
                      { width: idx % 3 === 0 ? '92%' : idx % 2 === 0 ? '78%' : '88%' },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.pageFoldShadowLeft} />
            </View>

            {/* Spine Center */}
            <View style={styles.spineGutter} />

            {/* Right Page (Warm orange/terracotta bookmark highlight) */}
            <View style={styles.pageRight}>
              <View style={styles.pageRightAccentFill}>
                <View style={styles.pageRightInnerStripe} />
                <View style={styles.pageRightInnerStripeSmall} />
              </View>
              <View style={styles.pageFoldShadowRight} />
            </View>
          </View>
        </View>

        {/* Bottom Editorial Content */}
        <View style={styles.bottomSection}>
          <Text style={styles.titleLine}>All your reading in</Text>
          <Text style={styles.titleLine}>one place</Text>

          <Text style={styles.subtitle}>
            ORGANIZE EBOOKS, ARTICLES AND MAGAZINES. READ ANYWHERE, ANYTIME.
          </Text>

          {/* Segmented Progress Bar */}
          <View style={styles.segmentedBar}>
            <View style={[styles.segment, styles.segmentActive]} />
            <View style={styles.segment} />
            <View style={styles.segment} />
            <View style={styles.segment} />
          </View>

          {/* Get Started Button */}
          <TouchableOpacity
            style={styles.getStartedBtn}
            onPress={() => setShowOptionsModal(true)}
            activeOpacity={0.88}
            disabled={loading || isScanning}
          >
            {loading || isScanning ? (
              <ActivityIndicator color="#0D0E11" size="small" />
            ) : (
              <Text style={styles.getStartedBtnText}>GET STARTED</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Start Options Modal */}
      <Modal
        visible={showOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Start Reading</Text>
              <TouchableOpacity
                onPress={() => setShowOptionsModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={handleSelectDirectory}
              activeOpacity={0.85}
            >
              <View style={styles.modalOptionIcon}>
                <FolderOpen size={20} color="#FFFFFF" />
              </View>
              <View style={styles.modalOptionTextCol}>
                <Text style={styles.modalOptionTitle}>Select Books Folder</Text>
                <Text style={styles.modalOptionDesc}>Sync local EPUBs and PDFs with SAF</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={handlePickSingleFiles}
              activeOpacity={0.85}
            >
              <View style={styles.modalOptionIcon}>
                <FileText size={20} color="#FFFFFF" />
              </View>
              <View style={styles.modalOptionTextCol}>
                <Text style={styles.modalOptionTitle}>Import Specific Files</Text>
                <Text style={styles.modalOptionDesc}>Pick individual documents from device</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalOption, styles.modalOptionHighlight]}
              onPress={handleExploreSamples}
              activeOpacity={0.85}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: AppPalette.accentBerry }]}>
                <Sparkles size={20} color="#FFFFFF" />
              </View>
              <View style={styles.modalOptionTextCol}>
                <Text style={[styles.modalOptionTitle, { color: '#FFFFFF' }]}>Load Sample Library</Text>
                <Text style={styles.modalOptionDesc}>Experience articles, books and offline AI</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0E11',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingBottom: 28,
    paddingTop: 12,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  skipBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Hero Area: Open Book Graphic */
  heroArea: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 320,
  },
  bookBackdropGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
  },
  openBookContainer: {
    width: Math.min(width - 64, 300),
    height: 240,
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 16,
  },
  pageLeft: {
    flex: 1,
    backgroundColor: '#FAF7F0',
    padding: 16,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    position: 'relative',
  },
  pageLeftTextColumn: {
    gap: 7,
  },
  pageTextLine: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#27272A',
    opacity: 0.85,
  },
  pageFoldShadowLeft: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  spineGutter: {
    width: 4,
    backgroundColor: '#18181B',
  },
  pageRight: {
    flex: 1,
    backgroundColor: '#EA580C',
    padding: 14,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    position: 'relative',
    justifyContent: 'center',
  },
  pageRightAccentFill: {
    flex: 1,
    backgroundColor: '#C2410C',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    gap: 8,
  },
  pageRightInnerStripe: {
    height: 10,
    borderRadius: 4,
    backgroundColor: '#FDBA74',
    width: '70%',
  },
  pageRightInnerStripeSmall: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FED7AA',
    width: '45%',
  },
  pageFoldShadowRight: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },

  /* Bottom Content */
  bottomSection: {
    paddingBottom: 8,
  },
  titleLine: {
    fontSize: 29,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6,
    lineHeight: 36,
    fontFamily: Platform.select({
      web: '"Georgia", "Charter", serif',
      default: 'serif',
    }),
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 22,
    lineHeight: 18,
  },
  segmentedBar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 24,
  },
  segment: {
    width: 22,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
  },
  getStartedBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  getStartedBtnText: {
    color: '#0D0E11',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#16181D',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F222A',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalOptionHighlight: {
    borderColor: AppPalette.accentBerry,
  },
  modalOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  modalOptionTextCol: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  modalOptionDesc: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
