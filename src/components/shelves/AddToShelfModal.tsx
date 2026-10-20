import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X, Check, Bookmark, Heart, Book, Compass, FolderPlus, Sparkles } from 'lucide-react-native';
import { BookRepository } from '@/services/database/bookRepository';
import { Shelf, BookWithProgress } from '@/types/book';

interface AddToShelfModalProps {
  visible: boolean;
  book: BookWithProgress | null;
  onClose: () => void;
  onShelvesUpdated?: () => void;
  onOpenManageShelves?: () => void;
}

const SHELF_ICONS: Record<string, React.FC<any>> = {
  heart: Heart,
  bookmark: Bookmark,
  book: Book,
  compass: Compass,
  folder: FolderPlus,
  sparkles: Sparkles,
};

export const AddToShelfModal: React.FC<AddToShelfModalProps> = ({
  visible,
  book,
  onClose,
  onShelvesUpdated,
  onOpenManageShelves,
}) => {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [selectedShelfIds, setSelectedShelfIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadShelvesAndAssignments = async () => {
    if (!book) return;
    try {
      setLoading(true);
      const [allShelves, bookShelfIds] = await Promise.all([
        BookRepository.getShelves(),
        BookRepository.getShelvesForBook(book.id),
      ]);
      setShelves(allShelves);
      setSelectedShelfIds(bookShelfIds);
    } catch (err) {
      console.error('Failed to load shelves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && book) {
      loadShelvesAndAssignments();
    }
  }, [visible, book]);

  const handleToggleShelf = async (shelfId: string) => {
    if (!book || saving) return;
    const updated = selectedShelfIds.includes(shelfId)
      ? selectedShelfIds.filter((id) => id !== shelfId)
      : [...selectedShelfIds, shelfId];
    try {
      setSaving(true);
      setError(null);
      await BookRepository.setBookShelves(book.id, updated);
      setSelectedShelfIds(updated);
      onShelvesUpdated?.();
    } catch (err: any) {
      setError(err?.message || 'Could not update shelves');
      await loadShelvesAndAssignments();
    } finally {
      setSaving(false);
    }
  };

  if (!visible || !book) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text style={styles.title} numberOfLines={1}>
                Add to Shelves
              </Text>
              <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
                {book.title || book.fileName}
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

          {/* Shelves List */}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#D97706" />
              <Text style={styles.loadingText}>Loading collections...</Text>
            </View>
          ) : (
            <ScrollView style={styles.shelfList} showsVerticalScrollIndicator={false}>
              {shelves.map((shelf) => {
                const isSelected = selectedShelfIds.includes(shelf.id);
                const IconComponent = SHELF_ICONS[shelf.icon] || Bookmark;

                return (
                  <TouchableOpacity
                    key={shelf.id}
                    style={[styles.shelfRow, isSelected && styles.shelfRowSelected]}
                    onPress={() => handleToggleShelf(shelf.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.shelfLeft}>
                      <View style={[styles.shelfIconBadge, { backgroundColor: `${shelf.color}18` }]}>
                        <IconComponent size={16} color={shelf.color} />
                      </View>
                      <View>
                        <Text style={styles.shelfName}>{shelf.name}</Text>
                        <Text style={styles.shelfMeta}>
                          {shelf.bookCount} {shelf.bookCount === 1 ? 'book' : 'books'}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.checkbox,
                        isSelected && { backgroundColor: shelf.color, borderColor: shelf.color },
                      ]}
                    >
                      {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Action: Manage / Create Shelves */}
              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => {
                  onClose();
                  if (onOpenManageShelves) onOpenManageShelves();
                }}
                activeOpacity={0.7}
              >
                <FolderPlus size={16} color="#D97706" style={{ marginRight: 8 }} />
                <Text style={styles.manageBtnText}>Manage & Create Custom Shelves</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Bottom Done Bar */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
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
    maxHeight: '75%',
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
  loadingContainer: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  errorText: {
    fontSize: 12,
    color: '#FCA5A5',
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#9CA3AF',
  },
  shelfList: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
  shelfRowSelected: {
    borderColor: '#D84A6A',
    backgroundColor: 'rgba(216, 74, 106, 0.16)',
  },
  shelfLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shelfIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shelfName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shelfMeta: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#1F222A',
  },
  manageBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  doneBtn: {
    backgroundColor: '#D84A6A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
