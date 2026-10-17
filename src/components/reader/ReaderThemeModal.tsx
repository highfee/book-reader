import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { X, Check, Sparkles } from 'lucide-react-native';

export type PaperThemeId = 'parchment' | 'sepia' | 'nordic' | 'obsidian' | 'oled';

export interface PaperThemeConfig {
  id: PaperThemeId;
  name: string;
  subtitle: string;
  bg: string;
  text: string;
  heading: string;
  accent: string;
  headerBg: string;
  headerBorder: string;
  secondaryText: string;
  quoteBg: string;
  quoteBorder: string;
  gutterShadow: string;
}

export const PAPER_THEMES: Record<PaperThemeId, PaperThemeConfig> = {
  parchment: {
    id: 'parchment',
    name: 'Ivory Parchment',
    subtitle: 'Archival fine-print paper & charcoal ink',
    bg: '#FAF7F2',
    text: '#2C2523',
    heading: '#1C1917',
    accent: '#B45309',
    headerBg: '#F3EDE2',
    headerBorder: '#E6DDCF',
    secondaryText: '#7A6E65',
    quoteBg: '#F0E8DC',
    quoteBorder: '#DECBB6',
    gutterShadow: 'linear-gradient(to right, rgba(44, 37, 35, 0.08) 0%, rgba(44, 37, 35, 0.02) 60%, transparent 100%)',
  },
  sepia: {
    id: 'sepia',
    name: 'Antique Sepia',
    subtitle: 'Warm weathered library vellum & espresso ink',
    bg: '#F5ECE1',
    text: '#3D2F25',
    heading: '#261C14',
    accent: '#92400E',
    headerBg: '#EBDECF',
    headerBorder: '#DFCCB7',
    secondaryText: '#826D5A',
    quoteBg: '#E7D8C5',
    quoteBorder: '#D4BEA3',
    gutterShadow: 'linear-gradient(to right, rgba(61, 47, 37, 0.1) 0%, rgba(61, 47, 37, 0.03) 60%, transparent 100%)',
  },
  nordic: {
    id: 'nordic',
    name: 'Nordic Mist',
    subtitle: 'Cool Scandinavian paper & slate ink',
    bg: '#F3F4F6',
    text: '#1F2937',
    heading: '#0F172A',
    accent: '#2563EB',
    headerBg: '#E5E7EB',
    headerBorder: '#D1D5DB',
    secondaryText: '#6B7280',
    quoteBg: '#E5E7EB',
    quoteBorder: '#CBD5E1',
    gutterShadow: 'linear-gradient(to right, rgba(31, 41, 55, 0.07) 0%, rgba(31, 41, 55, 0.02) 60%, transparent 100%)',
  },
  obsidian: {
    id: 'obsidian',
    name: 'Midnight Obsidian',
    subtitle: 'App dark luxury palette & crystal text',
    bg: '#0D0E11',
    text: '#F3F4F6',
    heading: '#FFFFFF',
    accent: '#D84A6A',
    headerBg: '#16181D',
    headerBorder: 'rgba(255, 255, 255, 0.08)',
    secondaryText: '#9CA3AF',
    quoteBg: '#16181D',
    quoteBorder: 'rgba(255, 255, 255, 0.12)',
    gutterShadow: 'linear-gradient(to right, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.18) 60%, transparent 100%)',
  },
  oled: {
    id: 'oled',
    name: 'OLED Velvet',
    subtitle: 'Pure pitch black for zero light bleed',
    bg: '#000000',
    text: '#D4D4D8',
    heading: '#FFFFFF',
    accent: '#FBBF24',
    headerBg: '#09090B',
    headerBorder: '#27272A',
    secondaryText: '#71717A',
    quoteBg: '#121214',
    quoteBorder: '#27272A',
    gutterShadow: 'linear-gradient(to right, rgba(255, 255, 255, 0.05) 0%, transparent 100%)',
  },
};

interface ReaderThemeModalProps {
  visible: boolean;
  onClose: () => void;
  currentTheme: PaperThemeId;
  onSelectTheme: (themeId: PaperThemeId) => void;
  fontSize: number;
  onChangeFontSize: (size: number) => void;
  fontFamily: 'serif' | 'sans' | 'mono';
  onChangeFontFamily: (family: 'serif' | 'sans' | 'mono') => void;
  gutterShadowEnabled: boolean;
  onToggleGutterShadow: (enabled: boolean) => void;
}

export const ReaderThemeModal: React.FC<ReaderThemeModalProps> = ({
  visible,
  onClose,
  currentTheme,
  onSelectTheme,
  fontSize,
  onChangeFontSize,
  fontFamily,
  onChangeFontFamily,
  gutterShadowEnabled,
  onToggleGutterShadow,
}) => {
  const activeConfig = PAPER_THEMES[currentTheme] || PAPER_THEMES.parchment;

  const fontSizes = [15, 17, 19, 22, 26];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={[styles.sheet, { backgroundColor: activeConfig.headerBg, borderColor: activeConfig.headerBorder }]}
          activeOpacity={1}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.titleRow}>
              <Sparkles size={16} color={activeConfig.accent} style={{ marginRight: 6 }} />
              <Text style={[styles.sheetTitle, { color: activeConfig.heading }]}>
                Reading Typography & Paper
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: activeConfig.quoteBg }]}
              accessibilityLabel="Close"
            >
              <X size={18} color={activeConfig.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Paper Themes Grid */}
            <Text style={[styles.sectionHeading, { color: activeConfig.secondaryText }]}>
              CURATED PAPER THEMES
            </Text>
            <View style={styles.themesList}>
              {(Object.keys(PAPER_THEMES) as PaperThemeId[]).map((themeKey) => {
                const item = PAPER_THEMES[themeKey];
                const isSelected = currentTheme === themeKey;

                return (
                  <TouchableOpacity
                    key={themeKey}
                    style={[
                      styles.themeCard,
                      {
                        backgroundColor: item.bg,
                        borderColor: isSelected ? item.accent : item.quoteBorder,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                    onPress={() => onSelectTheme(themeKey)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.themeSwatchPreview}>
                      <Text style={[styles.themeAa, { color: item.heading }]}>Aa</Text>
                    </View>

                    <View style={styles.themeInfo}>
                      <View style={styles.themeTitleRow}>
                        <Text style={[styles.themeName, { color: item.heading }]}>
                          {item.name}
                        </Text>
                        {isSelected && (
                          <View style={[styles.selectedPill, { backgroundColor: item.accent }]}>
                            <Check size={11} color="#FFFFFF" />
                          </View>
                        )}
                      </View>
                      <Text style={[styles.themeSubtitle, { color: item.secondaryText }]}>
                        {item.subtitle}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Font Size Adjuster */}
            <Text style={[styles.sectionHeading, { color: activeConfig.secondaryText, marginTop: 18 }]}>
              TEXT SCALE
            </Text>
            <View style={[styles.controlBox, { backgroundColor: activeConfig.bg, borderColor: activeConfig.quoteBorder }]}>
              <TouchableOpacity
                style={[styles.stepperBtn, fontSize <= 15 && styles.disabledStepper]}
                disabled={fontSize <= 15}
                onPress={() => {
                  const idx = fontSizes.indexOf(fontSize);
                  if (idx > 0) onChangeFontSize(fontSizes[idx - 1]);
                  else if (idx === -1) onChangeFontSize(15);
                }}
              >
                <Text style={[styles.stepperLabel, { color: activeConfig.text }]}>A-</Text>
              </TouchableOpacity>

              <View style={styles.fontSizePillsRow}>
                {fontSizes.map((size) => {
                  const isActive = fontSize === size;
                  return (
                    <TouchableOpacity
                      key={size}
                      style={[
                        styles.sizeDot,
                        isActive && { backgroundColor: activeConfig.accent },
                      ]}
                      onPress={() => onChangeFontSize(size)}
                    >
                      <Text
                        style={[
                          styles.sizeDotText,
                          { color: isActive ? '#FFFFFF' : activeConfig.secondaryText },
                        ]}
                      >
                        {size}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.stepperBtn, fontSize >= 26 && styles.disabledStepper]}
                disabled={fontSize >= 26}
                onPress={() => {
                  const idx = fontSizes.indexOf(fontSize);
                  if (idx < fontSizes.length - 1 && idx !== -1) onChangeFontSize(fontSizes[idx + 1]);
                  else if (idx === -1) onChangeFontSize(26);
                }}
              >
                <Text style={[styles.stepperLabel, { color: activeConfig.text, fontSize: 17 }]}>A+</Text>
              </TouchableOpacity>
            </View>

            {/* Typeface Selection */}
            <Text style={[styles.sectionHeading, { color: activeConfig.secondaryText, marginTop: 18 }]}>
              TYPEFACE
            </Text>
            <View style={styles.fontFamilyRow}>
              {[
                { id: 'serif' as const, label: 'Editorial Serif', sample: 'Charter & Georgia' },
                { id: 'sans' as const, label: 'Modern Sans', sample: 'Inter & Helvetica' },
                { id: 'mono' as const, label: 'Monospace', sample: 'Code & Typewriter' },
              ].map((f) => {
                const isActive = fontFamily === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[
                      styles.fontFamilyBtn,
                      {
                        backgroundColor: isActive ? activeConfig.accent : activeConfig.bg,
                        borderColor: activeConfig.quoteBorder,
                      },
                    ]}
                    onPress={() => onChangeFontFamily(f.id)}
                  >
                    <Text
                      style={[
                        styles.fontFamilyBtnText,
                        { color: isActive ? '#FFFFFF' : activeConfig.heading },
                      ]}
                    >
                      {f.label}
                    </Text>
                    <Text
                      style={[
                        styles.fontFamilySub,
                        { color: isActive ? 'rgba(255,255,255,0.85)' : activeConfig.secondaryText },
                      ]}
                    >
                      {f.sample}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Realistic Page Gutter Shadow Toggle */}
            <Text style={[styles.sectionHeading, { color: activeConfig.secondaryText, marginTop: 18 }]}>
              READING REALISM
            </Text>
            <TouchableOpacity
              style={[
                styles.gutterToggleCard,
                { backgroundColor: activeConfig.bg, borderColor: activeConfig.quoteBorder },
              ]}
              onPress={() => onToggleGutterShadow(!gutterShadowEnabled)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.gutterTitle, { color: activeConfig.heading }]}>
                  Physical Book Spine Depth
                </Text>
                <Text style={[styles.gutterSubtitle, { color: activeConfig.secondaryText }]}>
                  Renders realistic page gutter gradient along book margins
                </Text>
              </View>
              <View
                style={[
                  styles.toggleSwitch,
                  { backgroundColor: gutterShadowEnabled ? activeConfig.accent : '#D1D5DB' },
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    gutterShadowEnabled ? { transform: [{ translateX: 18 }] } : { transform: [{ translateX: 2 }] },
                  ]}
                />
              </View>
            </TouchableOpacity>

            <View style={{ height: 24 }} />
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 25, 23, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    maxHeight: '82%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    fontFamily: Platform.select({
      web: '"Charter", "Georgia", "Newsreader", serif',
      default: 'serif',
    }),
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
  },
  sectionHeading: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  themesList: {
    gap: 8,
  },
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  themeSwatchPreview: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  themeAa: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Platform.select({
      web: '"Charter", "Georgia", "Newsreader", serif',
      default: 'serif',
    }),
  },
  themeInfo: {
    flex: 1,
  },
  themeTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  themeName: {
    fontSize: 14,
    fontWeight: '700',
  },
  selectedPill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  controlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  stepperBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  disabledStepper: {
    opacity: 0.3,
  },
  stepperLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  fontSizePillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sizeDot: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  sizeDotText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fontFamilyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fontFamilyBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  fontFamilyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  fontFamilySub: {
    fontSize: 9.5,
    textAlign: 'center',
  },
  gutterToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  gutterTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  gutterSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  toggleSwitch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
});
