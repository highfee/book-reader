import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from 'react-native';
import {
  List,
  Search,
  StickyNote,
  Target,
  Sun,
  Moon,
  Bell,
  X,
  ChevronRight,
  Headphones,
  Sliders,
} from 'lucide-react-native';
import { AppPalette, Fonts } from '@/constants/theme';

interface ReaderOverflowModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenToc: () => void;
  onOpenSearch: () => void;
  onOpenNotes: () => void;
  onOpenAudio: () => void;
  onOpenTheme: () => void;
  onCycleTheme: () => void;
  isDarkTheme: boolean;
  showTargetHUD: boolean;
  onToggleTargetHUD: () => void;
  onOpenReminders: () => void;
  dailyGoalText: string;
}

export function ReaderOverflowModal({
  visible,
  onClose,
  onOpenToc,
  onOpenSearch,
  onOpenNotes,
  onOpenAudio,
  onOpenTheme,
  onCycleTheme,
  isDarkTheme,
  showTargetHUD,
  onToggleTargetHUD,
  onOpenReminders,
  dailyGoalText,
}: ReaderOverflowModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={styles.sheetContainer}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Reader Menu</Text>
              <Text style={styles.sheetSubtitle}>{dailyGoalText}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Action List */}
          <View style={styles.menuList}>
            {/* Table of Contents */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onOpenToc();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                <List size={18} color="#38BDF8" />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuItemTitle}>Table of Contents</Text>
                <Text style={styles.menuItemSub}>Jump between book chapters & sections</Text>
              </View>
              <ChevronRight size={16} color="#6B7280" />
            </TouchableOpacity>

            {/* In-Book Search */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onOpenSearch();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Search size={18} color="#F59E0B" />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuItemTitle}>Search in Book</Text>
                <Text style={styles.menuItemSub}>Find keywords, phrases and quotes</Text>
              </View>
              <ChevronRight size={16} color="#6B7280" />
            </TouchableOpacity>

            {/* Notes & Highlights */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onOpenNotes();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: 'rgba(216, 74, 106, 0.15)' }]}>
                <StickyNote size={18} color="#D84A6A" />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuItemTitle}>Notes & Highlights</Text>
                <Text style={styles.menuItemSub}>Review your annotations & summaries</Text>
              </View>
              <ChevronRight size={16} color="#6B7280" />
            </TouchableOpacity>

            {/* Daily Target HUD Toggle */}
            <View style={styles.menuItem}>
              <View style={[styles.menuIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Target size={18} color="#10B981" />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuItemTitle}>Daily Target HUD</Text>
                <Text style={styles.menuItemSub}>Show real-time countdown & milestone tracker</Text>
              </View>
              <Switch
                value={showTargetHUD}
                onValueChange={onToggleTargetHUD}
                trackColor={{ false: '#374151', true: '#10B981' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Day / Night Paper Theme Cycle */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onCycleTheme();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                {isDarkTheme ? <Sun size={18} color="#A78BFA" /> : <Moon size={18} color="#A78BFA" />}
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuItemTitle}>
                  {isDarkTheme ? 'Switch to Light Paper' : 'Switch to Dark Obsidian'}
                </Text>
                <Text style={styles.menuItemSub}>Quickly cycle day and night reading modes</Text>
              </View>
              <ChevronRight size={16} color="#6B7280" />
            </TouchableOpacity>

            {/* Reading Target Reminders */}
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={() => {
                onClose();
                onOpenReminders();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: 'rgba(216, 74, 106, 0.15)' }]}>
                <Bell size={18} color="#D84A6A" />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuItemTitle}>Target Push Reminders</Text>
                <Text style={styles.menuItemSub}>Set notification times & alerts</Text>
              </View>
              <ChevronRight size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#16181D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Fonts.serif,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuList: {
    marginTop: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuTextCol: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  menuItemSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
