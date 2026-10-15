import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Search, X, ChevronRight, BookOpen } from 'lucide-react-native';
import { BookContentService, SearchResultItem } from '@/services/parsers/bookContentService';

interface BookSearchModalProps {
  visible: boolean;
  bookTitle: string;
  fileUri?: string;
  totalPages: number;
  onClose: () => void;
  onSelectPage: (pageNumber: number) => void;
}

export const BookSearchModal: React.FC<BookSearchModalProps> = ({
  visible,
  bookTitle,
  fileUri,
  totalPages,
  onClose,
  onSelectPage,
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedOnce, setSearchedOnce] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setSearchedOnce(false);
      return;
    }
  }, [visible]);

  // Debounced search
  useEffect(() => {
    if (!visible) return;
    const clean = query.trim();
    if (clean.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchedOnce(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      BookContentService.searchBook(bookTitle, fileUri, clean, totalPages).then((items) => {
        setResults(items);
        setSearching(false);
        setSearchedOnce(true);
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [query, visible, bookTitle, fileUri, totalPages]);

  const handleSelectResult = (page: number) => {
    onSelectPage(page);
    onClose();
  };

  const renderSnippet = (snippet: string, matchWord: string) => {
    if (!matchWord) return <Text style={styles.snippetText}>{snippet}</Text>;

    const lowerSnippet = snippet.toLowerCase();
    const lowerMatch = matchWord.toLowerCase();
    const idx = lowerSnippet.indexOf(lowerMatch);

    if (idx === -1) {
      return <Text style={styles.snippetText}>{snippet}</Text>;
    }

    const before = snippet.substring(0, idx);
    const match = snippet.substring(idx, idx + matchWord.length);
    const after = snippet.substring(idx + matchWord.length);

    return (
      <Text style={styles.snippetText}>
        {before}
        <Text style={styles.highlightedMatch}>{match}</Text>
        {after}
      </Text>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={[styles.searchInputRow, isFocused && styles.searchInputRowFocused]}>
              <Search
                size={18}
                color={isFocused ? '#B45309' : '#9CA3AF'}
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={[
                  styles.searchInput,
                  Platform.select({ web: { outlineStyle: 'none' } as any }),
                ]}
                placeholder={`Search across "${bookTitle}"...`}
                placeholderTextColor="#9CA3AF"
                value={query}
                onChangeText={setQuery}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                autoFocus={true}
                returnKeyType="search"
              />
              {Boolean(query) && (
                <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
                  <X size={16} color="#78716C" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Results Summary Badge */}
          {query.trim().length >= 2 && !searching && (
            <View style={styles.summaryBar}>
              <Text style={styles.summaryText}>
                {results.length} {results.length === 1 ? 'match' : 'matches'} found
              </Text>
            </View>
          )}

          {/* Content Area */}
          {searching ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#D97706" />
              <Text style={styles.statusText}>Searching book pages...</Text>
            </View>
          ) : query.trim().length < 2 ? (
            <View style={styles.centerContainer}>
              <Search size={36} color="#D1D5DB" />
              <Text style={styles.placeholderTitle}>Search Inside This Book</Text>
              <Text style={styles.placeholderSubtitle}>
                Type a character name, place, or phrase to find every matching passage across all pages.
              </Text>
            </View>
          ) : results.length === 0 && searchedOnce ? (
            <View style={styles.centerContainer}>
              <BookOpen size={36} color="#D1D5DB" />
              <Text style={styles.placeholderTitle}>No Occurrences Found</Text>
              <Text style={styles.placeholderSubtitle}>
                No pages contain "{query}". Check spelling or try a different term.
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultCard}
                  onPress={() => handleSelectResult(item.pageNumber)}
                  activeOpacity={0.7}
                >
                  <View style={styles.resultHeader}>
                    <View style={styles.pageBadge}>
                      <Text style={styles.pageBadgeText}>Page {item.pageNumber}</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.chapterBadge}>
                      {item.chapterTitle}
                    </Text>
                    <ChevronRight size={16} color="#9CA3AF" />
                  </View>

                  <View style={styles.snippetBox}>
                    {renderSnippet(item.snippet, item.matchWord)}
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28, 25, 23, 0.65)',
    justifyContent: 'flex-start',
  },
  container: {
    backgroundColor: '#FFFFFF',
    marginTop: Platform.OS === 'web' ? 20 : 44,
    marginHorizontal: Platform.OS === 'web' ? 'auto' : 12,
    maxWidth: 640,
    width: Platform.OS === 'web' ? '92%' : undefined,
    borderRadius: 20,
    maxHeight: '85%',
    flex: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchInputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  searchInputRowFocused: {
    borderColor: '#D97706',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(217, 119, 6, 0.15)',
      } as any,
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1C1917',
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
  cancelBtn: {
    marginLeft: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D97706',
  },
  summaryBar: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: '#FAF7F2',
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE4',
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#78716C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingVertical: 50,
    gap: 10,
  },
  statusText: {
    fontSize: 13,
    color: '#78716C',
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1917',
    marginTop: 6,
  },
  placeholderSubtitle: {
    fontSize: 12,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 18,
  },
  listContent: {
    padding: 12,
    gap: 8,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0ECE4',
    gap: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  chapterBadge: {
    flex: 1,
    fontSize: 11,
    color: '#78716C',
    marginHorizontal: 8,
  },
  snippetBox: {
    backgroundColor: '#FAF7F2',
    padding: 10,
    borderRadius: 8,
  },
  snippetText: {
    fontSize: 13,
    color: '#292524',
    lineHeight: 19,
  },
  highlightedMatch: {
    backgroundColor: '#FDE047',
    fontWeight: '700',
    color: '#1C1917',
  },
});
