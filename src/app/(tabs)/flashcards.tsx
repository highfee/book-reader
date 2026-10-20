import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import {
  GraduationCap,
  Sparkles,
  Play,
  RotateCw,
  BookOpen,
  Layers,
  Bookmark,
  Heart,
  Book,
  Compass,
  FolderPlus,
  SlidersHorizontal,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react-native';
import { FlashcardService } from '@/services/flashcards/flashcardService';
import { BookRepository } from '@/services/database/bookRepository';
import { Flashcard, BookWithProgress, Shelf } from '@/types/book';
import { FlashcardReviewModal } from '@/components/flashcards/FlashcardReviewModal';
import { ManageShelvesModal } from '@/components/shelves/ManageShelvesModal';
import { inferBookTitle } from '@/services/parsers/titleInference';
import { AppPalette } from '@/constants/theme';

interface BookDeck {
  bookId: string;
  bookTitle: string;
  author: string;
  totalCards: number;
  dueCards: number;
  cards: Flashcard[];
}

const SHELF_ICONS: Record<string, React.FC<any>> = {
  heart: Heart,
  bookmark: Bookmark,
  book: Book,
  compass: Compass,
  folder: FolderPlus,
  sparkles: Sparkles,
};

type CollectionViewTab = 'shelves' | 'flashcards';

export default function FlashcardsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CollectionViewTab>('shelves');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [decks, setDecks] = useState<BookDeck[]>([]);
  const [books, setBooks] = useState<BookWithProgress[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [selectedShelf, setSelectedShelf] = useState<Shelf | null>(null);
  const [showManageShelves, setShowManageShelves] = useState(false);

  // Active Review State
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewCards, setReviewCards] = useState<Flashcard[]>([]);
  const [reviewDeckTitle, setReviewDeckTitle] = useState('Daily Review');
  const [generatingForBookId, setGeneratingForBookId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [cards, due, allBooks, allShelves] = await Promise.all([
        FlashcardService.getFlashcards(),
        FlashcardService.getDueFlashcards(),
        BookRepository.getAllBooks(),
        BookRepository.getShelves(),
      ]);

      setAllCards(cards);
      setDueCards(due);
      setBooks(allBooks);
      setShelves(allShelves);

      // Group cards into book decks
      const deckMap: Record<string, BookDeck> = {};

      for (const b of allBooks) {
        deckMap[b.id] = {
          bookId: b.id,
          bookTitle: b.title,
          author: b.author,
          totalCards: 0,
          dueCards: 0,
          cards: [],
        };
      }

      const nowIso = new Date().toISOString();

      for (const card of cards) {
        if (!deckMap[card.bookId]) {
          deckMap[card.bookId] = {
            bookId: card.bookId,
            // Cards copy the title at creation, so rows written before the import cleaner can still
            // carry a download label; this is the one place that has to re-clean.
            bookTitle: inferBookTitle(card.bookTitle || 'Untitled Book'),
            author: 'Unknown Author',
            totalCards: 0,
            dueCards: 0,
            cards: [],
          };
        }
        deckMap[card.bookId].totalCards += 1;
        deckMap[card.bookId].cards.push(card);
        if (card.dueDate <= nowIso) {
          deckMap[card.bookId].dueCards += 1;
        }
      }

      setDecks(Object.values(deckMap));
    } catch (err) {
      console.error('Failed to load collections data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenBook = (bookId: string) => {
    router.push({
      pathname: '/book/[id]',
      params: { id: bookId },
    });
  };

  const startDailyReview = () => {
    if (dueCards.length === 0) {
      if (allCards.length === 0) return;
      setReviewCards(allCards);
      setReviewDeckTitle('Practice All Cards');
    } else {
      setReviewCards(dueCards);
      setReviewDeckTitle('Daily Recall Session');
    }
    setReviewModalVisible(true);
  };

  const startDeckReview = (deck: BookDeck) => {
    if (deck.cards.length === 0) return;
    const cardsToStudy =
      deck.dueCards > 0
        ? deck.cards.filter((c) => c.dueDate <= new Date().toISOString())
        : deck.cards;
    setReviewCards(cardsToStudy.length > 0 ? cardsToStudy : deck.cards);
    setReviewDeckTitle(deck.bookTitle);
    setReviewModalVisible(true);
  };

  const handleGenerateCards = async (bookId: string) => {
    try {
      setGeneratingForBookId(bookId);
      const generated = await FlashcardService.generateFlashcardsFromNotes(bookId);
      await loadData();
      Alert.alert(
        'Cards Generated!',
        `Created ${generated.length} active-recall flashcards from your notes and highlights.`
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to generate flashcards');
    } finally {
      setGeneratingForBookId(null);
    }
  };

  const totalMastered = allCards.filter((c) => c.repetitions >= 4).length;
  const totalReviewing = allCards.filter((c) => c.repetitions >= 1 && c.repetitions < 4).length;
  const totalLearning = allCards.filter((c) => c.repetitions === 0).length;

  // Filter books for selected shelf
  const booksInSelectedShelf = selectedShelf
    ? books.filter((b) => b.shelfIds?.includes(selectedShelf.id))
    : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerSubtitle}>ORGANIZATION & MASTERY</Text>
          <Text style={styles.headerTitle}>Collections & Shelves</Text>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          activeOpacity={0.7}
          accessibilityLabel="Refresh collections"
        >
          <RotateCw size={18} color="#78716C" />
        </TouchableOpacity>
      </View>

      {/* Segmented Controller: Shelves & Collections vs Recall Decks */}
      <View style={styles.segmentedRow}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'shelves' && styles.segmentBtnActive]}
          onPress={() => {
            setActiveTab('shelves');
            setSelectedShelf(null);
          }}
          activeOpacity={0.8}
        >
          <Layers size={15} color={activeTab === 'shelves' ? '#FFFFFF' : '#9CA3AF'} style={{ marginRight: 6 }} />
          <Text style={[styles.segmentText, activeTab === 'shelves' && styles.segmentTextActive]}>
            Shelves & Shelving ({shelves.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'flashcards' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('flashcards')}
          activeOpacity={0.8}
        >
          <GraduationCap size={15} color={activeTab === 'flashcards' ? '#FFFFFF' : '#9CA3AF'} style={{ marginRight: 6 }} />
          <Text style={[styles.segmentText, activeTab === 'flashcards' && styles.segmentTextActive]}>
            Active Recall ({allCards.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#D97706" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#D97706']} />
          }
        >
          {/* ======================================================== */}
          {/* VIEW 1: SHELVES & COLLECTIONS                            */}
          {/* ======================================================== */}
          {activeTab === 'shelves' && (
            <View>
              {selectedShelf ? (
                /* Detail View of a Selected Shelf */
                <View>
                  <TouchableOpacity
                    style={styles.backToShelvesBtn}
                    onPress={() => setSelectedShelf(null)}
                    activeOpacity={0.7}
                  >
                    <ArrowLeft size={16} color="#D97706" style={{ marginRight: 6 }} />
                    <Text style={styles.backToShelvesText}>All Collections</Text>
                  </TouchableOpacity>

                  {/* Shelf Hero Card */}
                  <View style={[styles.shelfHeroCard, { borderColor: `${selectedShelf.color}40` }]}>
                    <View style={styles.shelfHeroHeader}>
                      <View style={[styles.shelfIconLarge, { backgroundColor: `${selectedShelf.color}25` }]}>
                        {(() => {
                          const IconComp = SHELF_ICONS[selectedShelf.icon] || Bookmark;
                          return <IconComp size={22} color={selectedShelf.color} />;
                        })()}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.shelfHeroTitle}>{selectedShelf.name}</Text>
                        <Text style={styles.shelfHeroMeta}>
                          {booksInSelectedShelf.length} {booksInSelectedShelf.length === 1 ? 'book' : 'books'} curated in this shelf
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Books inside shelf */}
                  {booksInSelectedShelf.length === 0 ? (
                    <View style={styles.shelfEmptyCard}>
                      <BookOpen size={36} color="#78716C" style={{ marginBottom: 12 }} />
                      <Text style={styles.shelfEmptyTitle}>No Books in this Collection Yet</Text>
                      <Text style={styles.shelfEmptySub}>
                        Go to your Library and tap the bookmark icon on any book to add it to "{selectedShelf.name}".
                      </Text>
                      <TouchableOpacity
                        style={styles.browseLibBtn}
                        onPress={() => router.push('/(tabs)')}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.browseLibBtnText}>Browse Library</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.shelfBookList}>
                      {booksInSelectedShelf.map((b) => (
                        <TouchableOpacity
                          key={b.id}
                          style={styles.shelfBookRow}
                          onPress={() => handleOpenBook(b.id)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.shelfBookCoverWrapper}>
                            {b.coverUri ? (
                              <Image source={{ uri: b.coverUri }} style={styles.shelfBookCover} contentFit="cover" />
                            ) : (
                              <View style={styles.shelfBookCoverPlaceholder}>
                                <BookOpen size={16} color="#D97706" />
                              </View>
                            )}
                          </View>

                          <View style={styles.shelfBookDetails}>
                            <Text numberOfLines={1} style={styles.shelfBookTitle}>
                              {b.title}
                            </Text>
                            <Text numberOfLines={1} style={styles.shelfBookAuthor}>
                              by {b.author}
                            </Text>
                            <View style={styles.shelfBookProgressRow}>
                              <Text style={styles.shelfBookProgressText}>
                                {b.progress?.percentComplete ? `${b.progress.percentComplete}% read` : 'Unread'} • {b.format.toUpperCase()}
                              </Text>
                            </View>
                          </View>

                          <ChevronRight size={18} color="#78716C" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                /* All Shelves Grid */
                <View>
                  {/* Actions Bar */}
                  <View style={styles.shelvesActionBar}>
                    <Text style={styles.shelvesCountLabel}>
                      {shelves.length} Active {shelves.length === 1 ? 'Collection' : 'Collections'}
                    </Text>

                    <TouchableOpacity
                      style={styles.manageShelvesActionBtn}
                      onPress={() => setShowManageShelves(true)}
                      activeOpacity={0.8}
                    >
                      <SlidersHorizontal size={14} color="#D97706" style={{ marginRight: 6 }} />
                      <Text style={styles.manageShelvesActionText}>Manage & New</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Shelves Cards Grid */}
                  <View style={styles.shelvesGrid}>
                    {shelves.map((shelf) => {
                      const IconComp = SHELF_ICONS[shelf.icon] || Bookmark;
                      const assignedBooks = books.filter((b) => b.shelfIds?.includes(shelf.id));

                      return (
                        <TouchableOpacity
                          key={shelf.id}
                          style={[styles.shelfCard, { borderColor: `${shelf.color}35` }]}
                          onPress={() => setSelectedShelf(shelf)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.shelfCardTop}>
                            <View style={[styles.shelfIconBadge, { backgroundColor: `${shelf.color}20` }]}>
                              <IconComp size={18} color={shelf.color} />
                            </View>
                            <View style={[styles.shelfCountBadge, { backgroundColor: `${shelf.color}15` }]}>
                              <Text style={[styles.shelfCountBadgeText, { color: shelf.color }]}>
                                {assignedBooks.length} {assignedBooks.length === 1 ? 'book' : 'books'}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.shelfCardName} numberOfLines={1}>
                            {shelf.name}
                          </Text>

                          {/* Mini book preview covers */}
                          <View style={styles.shelfMiniCoversRow}>
                            {assignedBooks.slice(0, 3).map((ab, idx) => (
                              <View
                                key={ab.id}
                                style={[
                                  styles.shelfMiniCover,
                                  { marginLeft: idx > 0 ? -10 : 0, zIndex: 3 - idx },
                                ]}
                              >
                                {ab.coverUri ? (
                                  <Image source={{ uri: ab.coverUri }} style={styles.shelfMiniCoverImg} contentFit="cover" />
                                ) : (
                                  <View style={[styles.shelfMiniCoverPlaceholder, { backgroundColor: shelf.color }]}>
                                    <Text numberOfLines={1} style={styles.shelfMiniCoverText}>
                                      {ab.title.charAt(0)}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            ))}
                            {assignedBooks.length === 0 && (
                              <Text style={styles.shelfEmptyMiniText}>Empty collection</Text>
                            )}
                          </View>

                          <View style={styles.shelfCardFooter}>
                            <Text style={styles.shelfTapToOpenText}>View books</Text>
                            <ChevronRight size={14} color="#9CA3AF" />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ======================================================== */}
          {/* VIEW 2: ACTIVE RECALL FLASHCARDS                         */}
          {/* ======================================================== */}
          {activeTab === 'flashcards' && (
            <View>
              {/* Daily Review Spotlight Card */}
              <View style={styles.spotlightCard}>
                <View style={styles.spotlightTop}>
                  <View style={styles.spotlightIcon}>
                    <GraduationCap size={24} color="#D97706" />
                  </View>
                  <View style={styles.spotlightInfo}>
                    <Text style={styles.spotlightTitle}>Daily Spaced Repetition</Text>
                    <Text style={styles.spotlightSubtitle}>
                      Optimized by the SuperMemo SM-2 algorithm
                    </Text>
                  </View>
                </View>

                <View style={styles.spotlightMetrics}>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricNum, { color: dueCards.length > 0 ? '#D97706' : '#10B981' }]}>
                      {dueCards.length}
                    </Text>
                    <Text style={styles.metricLabel}>Due Today</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricItem}>
                    <Text style={styles.metricNum}>{allCards.length}</Text>
                    <Text style={styles.metricLabel}>Total Cards</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricItem}>
                    <Text style={styles.metricNum}>{decks.filter((d) => d.totalCards > 0).length}</Text>
                    <Text style={styles.metricLabel}>Active Decks</Text>
                  </View>
                </View>

                {/* Overall Retention Health Bar */}
                {allCards.length > 0 && (
                  <View style={styles.spotlightMasteryRow}>
                    <View style={styles.spotlightMasteryBar}>
                      {totalMastered > 0 && (
                        <View
                          style={[
                            styles.spotlightMasteryFill,
                            { width: `${(totalMastered / allCards.length) * 100}%`, backgroundColor: '#10B981' },
                          ]}
                        />
                      )}
                      {totalReviewing > 0 && (
                        <View
                          style={[
                            styles.spotlightMasteryFill,
                            { width: `${(totalReviewing / allCards.length) * 100}%`, backgroundColor: '#3B82F6' },
                          ]}
                        />
                      )}
                      {totalLearning > 0 && (
                        <View
                          style={[
                            styles.spotlightMasteryFill,
                            { width: `${(totalLearning / allCards.length) * 100}%`, backgroundColor: '#F59E0B' },
                          ]}
                        />
                      )}
                    </View>
                    <View style={styles.spotlightMasteryLabels}>
                      <Text style={styles.spotlightMasteryLabel}>
                        {Math.round((totalMastered / allCards.length) * 100)}% Mastered
                      </Text>
                      <Text style={styles.spotlightMasteryLabel}>
                        {totalReviewing} Reviewing • {totalLearning} Learning
                      </Text>
                    </View>
                  </View>
                )}

                {/* Main Action Button */}
                <TouchableOpacity
                  style={[styles.startReviewBtn, allCards.length === 0 && { opacity: 0.5 }]}
                  onPress={startDailyReview}
                  disabled={allCards.length === 0}
                  activeOpacity={0.85}
                >
                  <Play size={16} color="#FFFFFF" fill="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.startReviewBtnText}>
                    {dueCards.length > 0
                      ? `Start Daily Recall (${dueCards.length} Due)`
                      : allCards.length > 0
                      ? 'Practice All Cards'
                      : 'No Cards Yet'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Book Decks Section */}
              <View style={styles.decksHeaderRow}>
                <Text style={styles.decksSectionTitle}>Recall Decks by Book</Text>
                <Text style={styles.decksSectionSubtitle}>
                  Spaced repetition flashcards generated from your notes
                </Text>
              </View>

              {decks.length === 0 ? (
                <View style={styles.emptyDecks}>
                  <BookOpen size={36} color="#78716C" />
                  <Text style={styles.emptyTitle}>No Books in Library</Text>
                  <Text style={styles.emptySub}>
                    Import books to start collecting notes and generating active-recall flashcards.
                  </Text>
                </View>
              ) : (
                <View style={styles.decksGrid}>
                  {decks.map((deck) => (
                    <View key={deck.bookId} style={styles.deckCard}>
                      <View style={styles.deckCardTop}>
                        <View style={styles.deckInfo}>
                          <Text numberOfLines={1} style={styles.deckTitle}>
                            {deck.bookTitle}
                          </Text>
                          <Text numberOfLines={1} style={styles.deckAuthor}>
                            by {deck.author}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.deckStatsRow}>
                        <View style={styles.deckStatCol}>
                          <Text style={styles.deckStatNum}>{deck.totalCards}</Text>
                          <Text style={styles.deckStatLabel}>Cards</Text>
                        </View>
                        <View style={styles.deckStatCol}>
                          <Text style={[styles.deckStatNum, { color: deck.dueCards > 0 ? '#D97706' : '#10B981' }]}>
                            {deck.dueCards}
                          </Text>
                          <Text style={styles.deckStatLabel}>Due Today</Text>
                        </View>
                      </View>

                      <View style={styles.deckActionsRow}>
                        {deck.totalCards > 0 ? (
                          <TouchableOpacity
                            style={styles.deckStudyBtn}
                            onPress={() => startDeckReview(deck)}
                            activeOpacity={0.8}
                          >
                            <Play size={13} color="#FFFFFF" fill="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.deckStudyBtnText}>Study Deck</Text>
                          </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity
                          style={[styles.deckGenerateBtn, deck.totalCards === 0 && { flex: 1 }]}
                          onPress={() => handleGenerateCards(deck.bookId)}
                          disabled={generatingForBookId === deck.bookId}
                          activeOpacity={0.8}
                        >
                          {generatingForBookId === deck.bookId ? (
                            <ActivityIndicator size="small" color="#D97706" />
                          ) : (
                            <>
                              <Sparkles size={13} color="#D97706" style={{ marginRight: 6 }} />
                              <Text style={styles.deckGenerateBtnText}>
                                {deck.totalCards === 0 ? 'Generate from Notes' : 'Regenerate'}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Review Modal */}
      <FlashcardReviewModal
        visible={reviewModalVisible}
        cards={reviewCards}
        deckTitle={reviewDeckTitle}
        onClose={() => {
          setReviewModalVisible(false);
          loadData();
        }}
        onSessionComplete={() => {
          loadData();
        }}
      />

      {/* Manage Shelves Modal */}
      <ManageShelvesModal
        visible={showManageShelves}
        onClose={() => {
          setShowManageShelves(false);
          loadData();
        }}
        onShelvesUpdated={loadData}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0E11',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerLeft: {
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#16181D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 3,
    backgroundColor: '#16181D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 11,
  },
  segmentBtnActive: {
    backgroundColor: '#262933',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  /* Shelves Views */
  shelvesActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  shelvesCountLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  manageShelvesActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  manageShelvesActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  shelvesGrid: {
    gap: 12,
  },
  shelfCard: {
    backgroundColor: '#16181D',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  shelfCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  shelfIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shelfCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  shelfCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  shelfCardName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  shelfMiniCoversRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    height: 48,
  },
  shelfMiniCover: {
    width: 34,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#16181D',
  },
  shelfMiniCoverImg: {
    width: '100%',
    height: '100%',
  },
  shelfMiniCoverPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shelfMiniCoverText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  shelfEmptyMiniText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  shelfCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  shelfTapToOpenText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },

  /* Selected Shelf Detail */
  backToShelvesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backToShelvesText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
  },
  shelfHeroCard: {
    backgroundColor: '#16181D',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  shelfHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shelfIconLarge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  shelfHeroTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  shelfHeroMeta: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  shelfEmptyCard: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16181D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  shelfEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  shelfEmptySub: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  browseLibBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#D97706',
    borderRadius: 12,
  },
  browseLibBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shelfBookList: {
    gap: 8,
  },
  shelfBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16181D',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  shelfBookCoverWrapper: {
    width: 42,
    height: 58,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: AppPalette.surfaceElevated,
    marginRight: 12,
  },
  shelfBookCover: {
    width: '100%',
    height: '100%',
  },
  shelfBookCoverPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppPalette.surface,
  },
  shelfBookDetails: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  shelfBookTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  shelfBookAuthor: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  shelfBookProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shelfBookProgressText: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: '600',
  },

  /* Flashcards Spotlight Card */
  spotlightCard: {
    backgroundColor: '#16181D',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    marginBottom: 24,
  },
  spotlightTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  spotlightIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  spotlightInfo: {
    flex: 1,
  },
  spotlightTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  spotlightSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  spotlightMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#1F222A',
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricNum: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  metricLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  spotlightMasteryRow: {
    marginBottom: 16,
  },
  spotlightMasteryBar: {
    flexDirection: 'row',
    height: 6,
    backgroundColor: '#262933',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  spotlightMasteryFill: {
    height: '100%',
  },
  spotlightMasteryLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  spotlightMasteryLabel: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  startReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    borderRadius: 14,
    paddingVertical: 13,
  },
  startReviewBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* Decks Section */
  decksHeaderRow: {
    marginBottom: 14,
  },
  decksSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  decksSectionSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  emptyDecks: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 10,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  decksGrid: {
    gap: 12,
  },
  deckCard: {
    backgroundColor: '#16181D',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  deckCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  deckInfo: {
    flex: 1,
    marginRight: 8,
  },
  deckTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  deckAuthor: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  dueBadge: {
    backgroundColor: 'rgba(217, 119, 6, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D97706',
  },
  dueBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
  },
  deckStatsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
  },
  deckStatCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  deckStatNum: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  deckStatLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  deckActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  deckStudyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    borderRadius: 10,
    paddingVertical: 8,
  },
  deckStudyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deckGenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F222A',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  deckGenerateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
});
