import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { X, Plus, Trash2, Highlighter, StickyNote, Edit3, Check } from 'lucide-react-native';
import { HighlightNote } from '@/types/book';
import { BookRepository } from '@/services/database/bookRepository';

interface NotesModalProps {
  visible: boolean;
  bookId: string;
  bookTitle: string;
  currentPage: number;
  onClose: () => void;
  onNotesUpdated?: () => void;
  initialHighlightText?: string;
  initialOpenCreate?: boolean;
  initialColor?: string;
}

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', hex: '#FEF08A', border: '#FDE047' },
  { name: 'Green', hex: '#BBF7D0', border: '#86EFAC' },
  { name: 'Blue', hex: '#BFDBFE', border: '#93C5FD' },
  { name: 'Pink', hex: '#FBCFE8', border: '#F472B6' },
];

export const NotesModal: React.FC<NotesModalProps> = ({
  visible,
  bookId,
  bookTitle,
  currentPage,
  onClose,
  onNotesUpdated,
  initialHighlightText,
  initialOpenCreate,
  initialColor,
}) => {
  const [notes, setNotes] = useState<HighlightNote[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [highlightText, setHighlightText] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0].hex);
  const [focusedInput, setFocusedInput] = useState<'highlight' | 'note' | null>(null);

  const loadNotes = async () => {
    try {
      const data = await BookRepository.getNotesForBook(bookId);
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  };

  useEffect(() => {
    if (visible && bookId) {
      loadNotes();
      if (initialOpenCreate || initialHighlightText) {
        setIsCreating(true);
        if (initialHighlightText) setHighlightText(initialHighlightText);
        if (initialColor) setSelectedColor(initialColor);
      }
    }
  }, [visible, bookId, initialHighlightText, initialOpenCreate, initialColor]);

  const handleSaveNote = async () => {
    if (!highlightText.trim() && !noteContent.trim()) {
      Alert.alert('Empty Note', 'Please provide either highlighted text or a note.');
      return;
    }

    const newNote: HighlightNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      bookId,
      pageNumber: currentPage,
      location: `page_${currentPage}`,
      text: highlightText.trim() || 'Note',
      note: noteContent.trim() || undefined,
      color: selectedColor,
      createdAt: new Date().toISOString(),
    };

    try {
      await BookRepository.saveNote(newNote);
      setNotes([newNote, ...notes]);
      setIsCreating(false);
      setHighlightText('');
      setNoteContent('');
      if (onNotesUpdated) onNotesUpdated();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save note');
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await BookRepository.deleteNote(id);
      setNotes(notes.filter((n) => n.id !== id));
      if (onNotesUpdated) onNotesUpdated();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to delete note');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text style={styles.title} numberOfLines={1}>Notes & Highlights</Text>
              <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
                Page {currentPage} • {bookTitle}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Close notes modal"
            >
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* New Note Form */}
          {isCreating ? (
            <View style={styles.createContainer}>
              <Text style={styles.sectionTitle}>Add Note / Highlight</Text>

              {/* Color Picker */}
              <View style={styles.colorRow}>
                {HIGHLIGHT_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c.hex}
                    onPress={() => setSelectedColor(c.hex)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c.hex, borderColor: c.border },
                      selectedColor === c.hex && styles.selectedColorDot,
                    ]}
                  >
                    {selectedColor === c.hex && <Check size={14} color="#374151" />}
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[
                  styles.highlightInput,
                  focusedInput === 'highlight' && styles.inputFocused,
                  Platform.select({ web: { outlineStyle: 'none' } as any }),
                ]}
                placeholder="Highlighted excerpt from book (optional)..."
                placeholderTextColor="#9CA3AF"
                multiline
                value={highlightText}
                onChangeText={setHighlightText}
                onFocus={() => setFocusedInput('highlight')}
                onBlur={() => setFocusedInput(null)}
              />

              <TextInput
                style={[
                  styles.noteInput,
                  focusedInput === 'note' && styles.inputFocused,
                  Platform.select({ web: { outlineStyle: 'none' } as any }),
                ]}
                placeholder="Your personal thought or note..."
                placeholderTextColor="#9CA3AF"
                multiline
                value={noteContent}
                onChangeText={setNoteContent}
                onFocus={() => setFocusedInput('note')}
                onBlur={() => setFocusedInput(null)}
              />

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setIsCreating(false);
                    setHighlightText('');
                    setNoteContent('');
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveNote}>
                  <Text style={styles.saveBtnText}>Save Note</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.addBtnContainer}>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setIsCreating(true)}
                activeOpacity={0.8}
              >
                <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.addBtnText}>Add Note for Page {currentPage}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Notes List */}
          <ScrollView style={styles.listArea} contentContainerStyle={styles.listContent}>
            {notes.length === 0 ? (
              <View style={styles.emptyContainer}>
                <StickyNote size={36} color="#D1D5DB" />
                <Text style={styles.emptyText}>No notes or highlights yet for this book.</Text>
                <Text style={styles.emptySubtext}>
                  Tap the button above to highlight a quote or write your reflections.
                </Text>
              </View>
            ) : (
              notes.map((item) => (
                <View key={item.id} style={styles.noteCard}>
                  {/* Highlighted Quote if present */}
                  {item.text && item.text !== 'Note' && (
                    <View
                      style={[
                        styles.highlightQuoteBox,
                        { backgroundColor: item.color || '#FEF08A' },
                      ]}
                    >
                      <Highlighter size={14} color="#78350F" style={{ marginRight: 6 }} />
                      <Text style={styles.highlightQuoteText}>"{item.text}"</Text>
                    </View>
                  )}

                  {/* Personal Note */}
                  {item.note && (
                    <View style={styles.noteBody}>
                      <Text style={styles.noteText}>{item.note}</Text>
                    </View>
                  )}

                  {/* Footer / Meta */}
                  <View style={styles.noteFooter}>
                    <Text style={styles.noteMeta}>
                      Page {item.pageNumber || 1} •{' '}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteNote(item.id)}
                      style={styles.deleteBtn}
                    >
                      <Trash2 size={15} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#16181D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    paddingBottom: 28,
    maxHeight: '85%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    flexShrink: 0,
  },
  addBtnContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  addBtn: {
    backgroundColor: '#D84A6A',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  createContainer: {
    backgroundColor: '#1F222A',
    margin: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedColorDot: {
    transform: [{ scale: 1.15 }],
  },
  highlightInput: {
    backgroundColor: '#16181D',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 48,
    marginBottom: 8,
    textAlignVertical: 'top',
  },
  noteInput: {
    backgroundColor: '#16181D',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 64,
    marginBottom: 10,
    textAlignVertical: 'top',
  },
  inputFocused: {
    borderColor: '#D84A6A',
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(216, 74, 106, 0.2)',
      } as any,
    }),
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: '#D84A6A',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  listArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingVertical: 10,
    gap: 10,
  },
  noteCard: {
    backgroundColor: '#1F222A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  highlightQuoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  highlightQuoteText: {
    flex: 1,
    fontSize: 12,
    color: '#78350F',
    fontStyle: 'italic',
    lineHeight: 17,
  },
  noteBody: {
    marginBottom: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  noteMeta: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  deleteBtn: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
