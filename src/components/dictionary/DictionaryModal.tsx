import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import {
  X,
  BookOpen,
  Volume2,
  StickyNote,
  Sparkles,
  BookmarkCheck,
} from 'lucide-react-native';
import {
  DictionaryService,
  WordDefinition,
} from '@/services/dictionary/dictionaryService';
import { TTSService } from '@/services/audio/textToSpeechService';

interface DictionaryModalProps {
  visible: boolean;
  term: string;
  bookTitle?: string;
  currentPage: number;
  onClose: () => void;
  onAddNoteWithDefinition: (term: string, definition: string) => void;
  onAskAIContext: (term: string) => void;
}

export const DictionaryModal: React.FC<DictionaryModalProps> = ({
  visible,
  term,
  bookTitle,
  currentPage,
  onClose,
  onAddNoteWithDefinition,
  onAskAIContext,
}) => {
  const [loading, setLoading] = useState(true);
  const [definition, setDefinition] = useState<WordDefinition | null>(null);
  const [addedToNotes, setAddedToNotes] = useState(false);

  useEffect(() => {
    if (visible && term) {
      setLoading(true);
      setAddedToNotes(false);
      DictionaryService.lookup(term, bookTitle)
        .then((res) => {
          setDefinition(res);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [visible, term, bookTitle]);

  const handlePronounce = () => {
    if (term) {
      TTSService.speak(term, { rate: 0.9 });
    }
  };

  const handleSaveToNotes = () => {
    if (!definition) return;
    const firstDef =
      definition.meanings[0]?.definitions[0]?.definition ||
      'Saved word from dictionary';
    onAddNoteWithDefinition(definition.word, firstDef);
    setAddedToNotes(true);
  };

  const handleAskAI = () => {
    onClose();
    onAskAIContext(term);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconCircle}>
                <BookOpen size={18} color="#D97706" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title} numberOfLines={1}>Dictionary & Meaning</Text>
                <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">Instant lexicon & vocabulary lookup</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={18} color="#78716C" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#D97706" />
              <Text style={styles.loadingText}>Looking up "{term}"...</Text>
            </View>
          ) : definition ? (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Word Header Card */}
              <View style={styles.wordHeaderCard}>
                <View style={styles.wordTitleRow}>
                  <Text style={styles.wordText}>{definition.word}</Text>
                  <TouchableOpacity
                    onPress={handlePronounce}
                    style={styles.pronounceBtn}
                    activeOpacity={0.7}
                    accessibilityLabel="Pronounce word"
                  >
                    <Volume2 size={16} color="#D97706" />
                  </TouchableOpacity>
                </View>

                <View style={styles.metaRow}>
                  {definition.phonetic && (
                    <Text style={styles.phoneticText}>{definition.phonetic}</Text>
                  )}
                  <View style={styles.sourceBadge}>
                    <Text style={styles.sourceBadgeText}>
                      {definition.source === 'dictionary' ? 'Lexicon' : 'AI Companion'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Definitions List */}
              {definition.meanings.map((meaning, mIdx) => (
                <View key={mIdx} style={styles.meaningSection}>
                  <View style={styles.partOfSpeechPill}>
                    <Text style={styles.partOfSpeechText}>
                      {meaning.partOfSpeech}
                    </Text>
                  </View>

                  {meaning.definitions.map((d, dIdx) => (
                    <View key={dIdx} style={styles.defCard}>
                      <Text style={styles.defNumber}>{dIdx + 1}.</Text>
                      <View style={styles.defBody}>
                        <Text style={styles.defText}>{d.definition}</Text>
                        {d.example && (
                          <View style={styles.exampleBox}>
                            <Text style={styles.exampleText}>"{d.example}"</Text>
                          </View>
                        )}
                        {d.synonyms && d.synonyms.length > 0 && (
                          <View style={styles.synonymsRow}>
                            <Text style={styles.synonymLabel}>Synonyms: </Text>
                            {d.synonyms.map((s, sIdx) => (
                              <View key={sIdx} style={styles.synonymChip}>
                                <Text style={styles.synonymChipText}>{s}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No definition found for "{term}".</Text>
            </View>
          )}

          {/* Footer Actions */}
          {definition && !loading && (
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={handleSaveToNotes}
                disabled={addedToNotes}
                style={[styles.saveNoteBtn, addedToNotes && styles.saveNoteBtnAdded]}
                activeOpacity={0.8}
              >
                {addedToNotes ? (
                  <>
                    <BookmarkCheck size={16} color="#15803D" style={{ marginRight: 6 }} />
                    <Text style={styles.saveNoteTextAdded}>Added to Page {currentPage} Notes ✓</Text>
                  </>
                ) : (
                  <>
                    <StickyNote size={16} color="#92400E" style={{ marginRight: 6 }} />
                    <Text style={styles.saveNoteText}>Add to Notes</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleAskAI}
                style={styles.askAiBtn}
                activeOpacity={0.8}
              >
                <Sparkles size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.askAiBtnText}>Ask AI Context</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F4',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1917',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: '#78716C',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F4',
    flexShrink: 0,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#78716C',
    marginTop: 12,
    fontWeight: '500',
  },
  content: {
    maxHeight: 380,
  },
  wordHeaderCard: {
    backgroundColor: '#FAF8F5',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    marginBottom: 16,
  },
  wordTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  wordText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1917',
    textTransform: 'capitalize',
  },
  pronounceBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneticText: {
    fontSize: 13,
    color: '#78716C',
    fontStyle: 'italic',
    marginRight: 10,
  },
  sourceBadge: {
    backgroundColor: '#F5F5F4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#78716C',
    textTransform: 'uppercase',
  },
  meaningSection: {
    marginBottom: 18,
  },
  partOfSpeechPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 10,
  },
  partOfSpeechText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    fontStyle: 'italic',
    textTransform: 'lowercase',
  },
  defCard: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  defNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
    width: 20,
    lineHeight: 20,
  },
  defBody: {
    flex: 1,
  },
  defText: {
    fontSize: 14,
    color: '#1C1917',
    lineHeight: 20,
  },
  exampleBox: {
    marginTop: 6,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#D97706',
  },
  exampleText: {
    fontSize: 12,
    color: '#57534E',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  synonymsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  synonymLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78716C',
  },
  synonymChip: {
    backgroundColor: '#F5F5F4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  synonymChipText: {
    fontSize: 11,
    color: '#44403C',
  },
  emptyContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#78716C',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F4',
    marginTop: 8,
  },
  saveNoteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  saveNoteBtnAdded: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  saveNoteText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  saveNoteTextAdded: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  askAiBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1917',
    paddingVertical: 12,
    borderRadius: 14,
  },
  askAiBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FAF8F5',
  },
});
