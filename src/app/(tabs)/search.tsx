import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, X, BookOpen } from 'lucide-react-native';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { BookCard } from '@/components/ui/BookCard';
import { HorizontalScroll } from '@/components/ui/HorizontalScroll';

export default function SearchScreen() {
  const router = useRouter();
  const { books } = useLibraryStore();
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Extract tags
  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const b of books) {
      for (const t of b.genreTags || []) {
        if (t !== 'Most Popular' && t !== 'Recommendations') {
          set.add(t);
        }
      }
    }
    return Array.from(set);
  }, [books]);

  // Filtered books
  const filteredBooks = useMemo(() => {
    let result = books;
    if (selectedTag) {
      result = result.filter((b) => b.genreTags?.includes(selectedTag));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author?.toLowerCase().includes(q) ||
          b.genreTags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [books, query, selectedTag]);

  const handleOpenBook = (bookId: string) => {
    router.push({
      pathname: '/book/[id]',
      params: { id: bookId },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Entire page is inside one unified ScrollView */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        directionalLockEnabled
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Search</Text>
          <Text style={styles.headerSub}>Explore books across your private library</Text>
        </View>

        {/* Modern Search Bar */}
        <View style={styles.searchBar}>
          <Search size={18} color="#9CA3AF" style={{ marginRight: 10 }} />
          <TextInput
            style={[
              styles.input,
              Platform.select({
                web: { outlineStyle: 'none' } as any,
              }),
            ]}
            placeholder="Search titles, authors, keywords..."
            placeholderTextColor="#6B7280"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills Row */}
        {tags.length > 0 && (
          <HorizontalScroll
            contentContainerStyle={styles.tagsRow}
            style={styles.tagsContainer}
          >
            <TouchableOpacity
              style={[styles.tagPill, !selectedTag && styles.tagPillActive]}
              onPress={() => setSelectedTag(null)}
            >
              <Text style={[styles.tagText, !selectedTag && styles.tagTextActive]}>All</Text>
            </TouchableOpacity>

            {tags.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tagPill, selectedTag === t && styles.tagPillActive]}
                onPress={() => setSelectedTag(selectedTag === t ? null : t)}
              >
                <Text style={[styles.tagText, selectedTag === t && styles.tagTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </HorizontalScroll>
        )}

        {/* Results Header */}
        <View style={styles.resultsHeaderRow}>
          <Text style={styles.resultsTitle}>
            {query.trim() || selectedTag ? `Results (${filteredBooks.length})` : 'All Books'}
          </Text>
          {(query.trim() || selectedTag) && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                setSelectedTag(null);
              }}
            >
              <Text style={styles.clearBtn}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Books Grid */}
        {filteredBooks.length === 0 ? (
          <View style={styles.emptyWrap}>
            <BookOpen size={40} color="#4B5563" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No matching books</Text>
            <Text style={styles.emptySub}>Try searching for another keyword or author name.</Text>
          </View>
        ) : (
          <View style={styles.cardsGrid}>
            {filteredBooks.map((item) => (
              <View key={item.id} style={styles.cardCol}>
                <BookCard book={item} onPress={() => handleOpenBook(item.id)} />
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0E11',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 13,
    color: '#6B7280',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16181D',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  tagsContainer: {
    marginBottom: 16,
    flexGrow: 0,
  },
  tagsRow: {
    gap: 8,
    paddingHorizontal: 2,
    paddingRight: 28,
  },
  tagPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tagPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  tagText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  tagTextActive: {
    color: '#0D0E11',
    fontWeight: '700',
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clearBtn: {
    fontSize: 12,
    color: '#D84A6A',
    fontWeight: '600',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  cardCol: {
    width: '50%',
  },
  emptyWrap: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
});
