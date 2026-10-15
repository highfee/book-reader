import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { X, Plus, Trash2, Bookmark, Heart, Book, Compass, Sparkles, FolderPlus } from 'lucide-react-native';
import { BookRepository } from '@/services/database/bookRepository';
import { Shelf } from '@/types/book';

interface ManageShelvesModalProps {
  visible: boolean;
  onClose: () => void;
  onShelvesUpdated: () => void;
}

const COLOR_OPTIONS = [
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#64748B', // Slate
];

const ICON_OPTIONS = [
  { id: 'bookmark', label: 'Bookmark', Icon: Bookmark },
  { id: 'heart', label: 'Heart', Icon: Heart },
  { id: 'book', label: 'Book', Icon: Book },
  { id: 'compass', label: 'Compass', Icon: Compass },
  { id: 'sparkles', label: 'Sparkles', Icon: Sparkles },
  { id: 'folder', label: 'Folder', Icon: FolderPlus },
];

export const ManageShelvesModal: React.FC<ManageShelvesModalProps> = ({
  visible,
  onClose,
  onShelvesUpdated,
}) => {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[1]);
  const [selectedIcon, setSelectedIcon] = useState('bookmark');
  const [loading, setLoading] = useState(false);

  const loadShelves = async () => {
    try {
      const data = await BookRepository.getShelves();
      setShelves(data);
    } catch (err) {
      console.error('Failed to load shelves:', err);
    }
  };

  useEffect(() => {
    if (visible) {
      loadShelves();
    }
  }, [visible]);

  const handleCreateShelf = async () => {
    if (!newName.trim()) {
      Alert.alert('Required', 'Please enter a name for the shelf.');
      return;
    }
    try {
      setLoading(true);
      await BookRepository.createShelf({
        name: newName.trim(),
        color: selectedColor,
        icon: selectedIcon,
      });
      setNewName('');
      setIsCreating(false);
      await loadShelves();
      onShelvesUpdated();
    } catch (err) {
      console.error('Failed to create shelf:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShelf = async (shelf: Shelf) => {
    if (shelf.isDefault) {
      Alert.alert('Protected', 'Default shelves cannot be deleted.');
      return;
    }

    Alert.alert(
      'Delete Shelf',
      `Are you sure you want to delete "${shelf.name}"? Books in this shelf will remain in your library.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await BookRepository.deleteShelf(shelf.id);
              await loadShelves();
              onShelvesUpdated();
            } catch (err) {
              console.error('Failed to delete shelf:', err);
            }
          },
        },
      ]
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text style={styles.title} numberOfLines={1}>
                Custom Shelves & Collections
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                Organize your personal library
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Close"
            >
              <X size={20} color="#78716C" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Create Shelf Card / Button */}
            {!isCreating ? (
              <TouchableOpacity
                style={styles.addShelfBanner}
                onPress={() => setIsCreating(true)}
                activeOpacity={0.7}
              >
                <View style={styles.addIconCircle}>
                  <Plus size={18} color="#D97706" />
                </View>
                <View>
                  <Text style={styles.addBannerTitle}>Create New Shelf</Text>
                  <Text style={styles.addBannerSubtitle}>Custom tag or collection</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.createCard}>
                <Text style={styles.createTitle}>New Shelf</Text>

                <TextInput
                  style={[
                    styles.nameInput,
                    isFocused && styles.nameInputFocused,
                    Platform.select({ web: { outlineStyle: 'none' } as any }),
                  ]}
                  placeholder="e.g. Philosophy, Sci-Fi, Work..."
                  placeholderTextColor="#A8A29E"
                  value={newName}
                  onChangeText={setNewName}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  autoFocus
                />

                {/* Color Selection */}
                <Text style={styles.sectionLabel}>Accent Color</Text>
                <View style={styles.paletteRow}>
                  {COLOR_OPTIONS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c },
                        selectedColor === c && styles.colorCircleSelected,
                      ]}
                      onPress={() => setSelectedColor(c)}
                      activeOpacity={0.7}
                    />
                  ))}
                </View>

                {/* Icon Selection */}
                <Text style={styles.sectionLabel}>Icon</Text>
                <View style={styles.iconRow}>
                  {ICON_OPTIONS.map(({ id, Icon }) => (
                    <TouchableOpacity
                      key={id}
                      style={[
                        styles.iconOptionBtn,
                        selectedIcon === id && styles.iconOptionBtnSelected,
                      ]}
                      onPress={() => setSelectedIcon(id)}
                      activeOpacity={0.7}
                    >
                      <Icon
                        size={18}
                        color={selectedIcon === id ? selectedColor : '#78716C'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Create Actions */}
                <View style={styles.createActionsRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => {
                      setIsCreating(false);
                      setNewName('');
                    }}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: selectedColor }]}
                    onPress={handleCreateShelf}
                    disabled={loading}
                  >
                    <Text style={styles.saveBtnText}>Create Shelf</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Existing Shelves List */}
            <Text style={styles.listHeader}>Your Shelves ({shelves.length})</Text>

            {shelves.map((shelf) => {
              const IconObj = ICON_OPTIONS.find((i) => i.id === shelf.icon);
              const ShelfIcon = IconObj ? IconObj.Icon : Bookmark;

              return (
                <View key={shelf.id} style={styles.shelfRow}>
                  <View style={styles.shelfLeft}>
                    <View
                      style={[styles.shelfBadge, { backgroundColor: `${shelf.color}18` }]}
                    >
                      <ShelfIcon size={16} color={shelf.color} />
                    </View>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.shelfRowName}>{shelf.name}</Text>
                        {shelf.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.shelfRowCount}>
                        {shelf.bookCount} {shelf.bookCount === 1 ? 'book' : 'books'}
                      </Text>
                    </View>
                  </View>

                  {!shelf.isDefault && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteShelf(shelf)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel={`Delete ${shelf.name}`}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#16181D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '80%',
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#1F222A',
    flexShrink: 0,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  addShelfBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F222A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  addIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#16181D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addBannerSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  createCard: {
    backgroundColor: '#1F222A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  createTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  nameInput: {
    backgroundColor: '#16181D',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
  },
  nameInputFocused: {
    borderColor: '#D84A6A',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  colorCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  iconRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  iconOptionBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#16181D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconOptionBtnSelected: {
    borderColor: '#D84A6A',
    backgroundColor: 'rgba(216, 74, 106, 0.15)',
  },
  createActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  saveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#D84A6A',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  listHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  shelfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F222A',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  shelfLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shelfBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shelfRowName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  defaultBadge: {
    backgroundColor: '#16181D',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  shelfRowCount: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
});
