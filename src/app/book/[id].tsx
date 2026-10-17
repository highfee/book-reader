import { FlashcardReviewModal } from '@/components/flashcards/FlashcardReviewModal';
import { NotesModal } from '@/components/notes/NotesModal';
import { AddToShelfModal } from '@/components/shelves/AddToShelfModal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { AppPalette } from '@/constants/theme';
import { GeminiAIService, RecommendationResult } from '@/services/ai/geminiService';
import { BookRepository } from '@/services/database/bookRepository';
import { FlashcardService } from '@/services/flashcards/flashcardService';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { AISummary, BookWithProgress, Flashcard, HighlightNote, ReadingProgress, Shelf } from '@/types/book';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  BrainCircuit,
  Clock,
  Compass,
  Highlighter,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  StickyNote,
  Tag
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function BookDetailSkeleton() {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 850, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <View style={[styles.skelBase, styles.navBtn]} />
        <View style={[styles.skelBase, { height: 14, width: '42%', borderRadius: 7 }]} />
        <View style={[styles.skelBase, styles.navBtn]} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: pulse }}>
          <View style={styles.heroSection}>
            <View style={[styles.skelBase, { width: 156, height: 228, borderRadius: 8 }]} />
            <View style={[styles.skelBase, { height: 24, width: '68%', borderRadius: 7, marginTop: 18 }]} />
            <View style={[styles.skelBase, { height: 14, width: '38%', borderRadius: 7, marginTop: 10 }]} />
            <View style={[styles.skelBase, { height: 26, width: '58%', borderRadius: 13, marginTop: 16 }]} />
          </View>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.card}>
              <View style={styles.skelCardHeader}>
                <View style={[styles.skelBase, { height: 15, width: '46%', borderRadius: 7 }]} />
                <View style={[styles.skelBase, { height: 20, width: 84, borderRadius: 6 }]} />
              </View>
              <View style={[styles.skelBase, { height: 7, width: '100%', borderRadius: 4, marginBottom: 6 }]} />
              <View style={[styles.skelBase, { height: 7, width: '72%', borderRadius: 4, marginBottom: 14 }]} />
              <View style={[styles.skelBase, { height: 38, width: '100%', borderRadius: 12 }]} />
            </View>
          ))}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [book, setBook] = useState<BookWithProgress | null>(null);
  const [summaries, setSummaries] = useState<AISummary[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [assignedShelves, setAssignedShelves] = useState<Shelf[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [dueFlashcards, setDueFlashcards] = useState<Flashcard[]>([]);
  const [notes, setNotes] = useState<HighlightNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingRecap, setGeneratingRecap] = useState(false);
  const [detectingTags, setDetectingTags] = useState(false);
  const [generatingCards, setGeneratingCards] = useState(false);
  const [isRefiningTitle, setIsRefiningTitle] = useState(false);

  const updateBookTitleAndAuthor = useLibraryStore((s) => s.updateBookTitleAndAuthor);

  const handleRefineTitleWithAI = async () => {
    if (!book) return;
    setIsRefiningTitle(true);
    try {
      const extracted = await GeminiAIService.extractExactTitleAndAuthor(book);
      if (extracted.title && (extracted.title !== book.title || extracted.author !== book.author)) {
        await updateBookTitleAndAuthor(book.id, extracted.title, extracted.author);
        setBook((prev) => (prev ? { ...prev, title: extracted.title, author: extracted.author } : null));
        Alert.alert(
          'Title Updated App-Wide',
          `Title: "${extracted.title}"\nAuthor: "${extracted.author}"\n\nThis exact title is now used across all shelves, search, and reading screens.`
        );
      } else {
        Alert.alert('AI Title Verified', `"${book.title}" is already the clean canonical title.`);
      }
    } catch (err: any) {
      Alert.alert('AI Error', err?.message || 'Failed to extract exact title');
    } finally {
      setIsRefiningTitle(false);
    }
  };

  // Modals
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showShelfModal, setShowShelfModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showResetProgressModal, setShowResetProgressModal] = useState(false);

  const detectTagsForBook = async (targetBook: BookWithProgress) => {
    try {
      setDetectingTags(true);
      const result = await GeminiAIService.detectGenresAndThemes(targetBook, targetBook.title);
      setBook((prev) => (prev ? { ...prev, genreTags: result.genres } : prev));
    } catch {
      // Non-blocking
    } finally {
      setDetectingTags(false);
    }
  };

  const loadBookDetails = async (bookId: string) => {
    try {
      setLoading(true);
      const data = await BookRepository.getBookById(bookId);
      setBook(data);

      if (data) {
        const [summs, existingNotes, allShelves, bookShelfIds, bookCards, dueCards, allBooks] =
          await Promise.all([
            BookRepository.getAISummaries(bookId),
            BookRepository.getNotesForBook(bookId),
            BookRepository.getShelves(),
            BookRepository.getShelvesForBook(bookId),
            FlashcardService.getFlashcards(bookId),
            FlashcardService.getDueFlashcards(bookId),
            BookRepository.getAllBooks(),
          ]);

        setSummaries(summs);
        setNotes(existingNotes);
        setShelves(allShelves);
        setAssignedShelves(allShelves.filter((s) => bookShelfIds.includes(s.id)));
        setFlashcards(bookCards);
        setDueFlashcards(dueCards);

        // Fetch recommendations from other books in library
        const recs = GeminiAIService.getInLibraryRecommendations(data, allBooks);
        setRecommendations(recs);

        // If no genre tags yet, auto-detect tags in background
        if (!data.genreTags || data.genreTags.length === 0) {
          detectTagsForBook(data);
        }
      }
    } catch (err) {
      console.error('Failed to load book details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadBookDetails(id);
    }
  }, [id]);

  const reloadShelves = async () => {
    if (!book) return;
    try {
      const [allShelves, bookShelfIds] = await Promise.all([
        BookRepository.getShelves(),
        BookRepository.getShelvesForBook(book.id),
      ]);
      setShelves(allShelves);
      setAssignedShelves(allShelves.filter((s) => bookShelfIds.includes(s.id)));
    } catch (err) {
      console.error('Failed to reload shelves:', err);
    }
  };

  const reloadFlashcards = async () => {
    if (!book) return;
    try {
      const [cards, due] = await Promise.all([
        FlashcardService.getFlashcards(book.id),
        FlashcardService.getDueFlashcards(book.id),
      ]);
      setFlashcards(cards);
      setDueFlashcards(due);
    } catch (err) {
      console.error('Failed to reload flashcards:', err);
    }
  };

  const reloadNotes = async () => {
    if (!book) return;
    try {
      const updatedNotes = await BookRepository.getNotesForBook(book.id);
      setNotes(updatedNotes);
    } catch (err) {
      console.error('Failed to reload notes:', err);
    }
  };

  const handleGenerateRecap = async () => {
    if (!book) return;
    try {
      setGeneratingRecap(true);
      const page = book.progress?.currentPage || 1;
      const total = book.totalPages || 100;
      const newRecap = await GeminiAIService.getProgressRecap(book, page, total);
      setSummaries([newRecap, ...summaries]);
      Alert.alert('Recap Ready', 'Your spoiler-safe recap has been generated and cached.');
    } catch (err: any) {
      Alert.alert('Recap Error', err?.message || 'Failed to generate recap');
    } finally {
      setGeneratingRecap(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!book) return;
    try {
      setGeneratingCards(true);
      const generated = await FlashcardService.generateFlashcardsFromNotes(book.id);
      await reloadFlashcards();
      Alert.alert(
        'Flashcards Generated',
        `Successfully created ${generated.length} active-recall flashcard(s) from your notes and highlights.`
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to generate flashcards');
    } finally {
      setGeneratingCards(false);
    }
  };

  const handleConfirmResetProgress = async () => {
    if (!book) return;
    try {
      const resetProg: ReadingProgress = {
        bookId: book.id,
        userId: book.userId,
        currentPage: 1,
        currentLocation: undefined,
        percentComplete: 0,
        lastReadAt: new Date().toISOString(),
        totalTimeReadSeconds: 0,
      };
      await BookRepository.saveReadingProgress(resetProg);
      setBook((prev) => (prev ? { ...prev, progress: resetProg } : prev));
      setShowResetProgressModal(false);
      Alert.alert('Progress Reset', 'Your reading progress has been rewound to page 1.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to reset progress');
    }
  };

  const handleStartReading = () => {
    if (!book) return;
    router.push({
      pathname: '/reader/[id]',
      params: { id: book.id },
    });
  };

  const isInactiveFor24Hours = (lastReadAt?: string): boolean => {
    if (!lastReadAt) return false;
    const diffHours = (Date.now() - new Date(lastReadAt).getTime()) / (1000 * 60 * 60);
    return diffHours >= 24;
  };

  const formatReadingTime = (seconds: number): string => {
    if (!seconds || seconds < 60) return `${seconds || 0}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hours = (mins / 60).toFixed(1);
    return `${hours} hrs`;
  };

  if (loading) {
    return <BookDetailSkeleton />;
  }

  if (!book) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>Book not found</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
        >
          <Text style={styles.backBtnText}>Return to Library</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const percent = book.progress?.percentComplete || 0;
  const isFinished = percent >= 100;
  const hasStarted = percent > 0;
  const currentPage = book.progress?.currentPage || 1;
  const totalPages = book.totalPages || 100;
  const pagesRemaining = Math.max(0, totalPages - currentPage);
  const needs24hRecap = hasStarted && !isFinished && isInactiveFor24Hours(book.progress?.lastReadAt);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
          style={styles.navBtn}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text numberOfLines={1} style={styles.navTitle}>
          {book.title}
        </Text>
        {/* Shelving has one home: the labelled chip in the title block. */}
        <View style={styles.navBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        directionalLockEnabled
      >
        {/* 24-Hour Inactive Recap Banner */}
        {needs24hRecap && (
          <View style={styles.inactiveBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Clock size={16} color="#B45309" style={{ marginRight: 6 }} />
              <Text style={styles.inactiveBannerTitle}>Welcome Back</Text>
            </View>
            <Text style={styles.inactiveBannerText}>
              It has been over a day since you last turned a page. Use “Generate Recap” below to
              catch up on key milestones up to page {currentPage} without spoilers.
            </Text>
          </View>
        )}

        {/* Hero Section with Luxury 3D Physical Book Cover */}
        <View style={styles.heroSection}>
          <View style={styles.book3DWrapper}>
            {/* Silk Ribbon Bookmark */}
            <View style={styles.ribbonBookmark} />

            {/* 3D Stacked Page Edges Effect on Right */}
            <View style={styles.coverFrame}>
              {book.coverUri ? (
                <Image
                  source={{ uri: book.coverUri }}
                  style={styles.coverImage}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.coverPlaceholder,
                    { backgroundColor: book.format === 'epub' ? '#1C1917' : '#292524' },
                  ]}
                >
                  <View style={styles.placeholderOrnament}>
                    <Text style={styles.placeholderOrnamentText}>✦</Text>
                  </View>
                  <Text numberOfLines={3} style={styles.placeholderTitle}>
                    {book.title}
                  </Text>
                  <View style={styles.placeholderDivider} />
                  <Text numberOfLines={1} style={styles.placeholderAuthor}>
                    {book.author}
                  </Text>
                </View>
              )}

              {/* Spine Shading & Crease Gradient Overlays */}
              <View style={styles.spineShadow} />
              <View style={styles.spineCrease} />

              {/* Embossed Foil Format Badge */}
              <View
                style={[
                  styles.foilBadge,
                  { backgroundColor: book.format === 'epub' ? '#D97706' : '#B91C1C' },
                ]}
              >
                <Text style={styles.foilBadgeText}>{book.format.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {/* Book Title & Attribution */}
          <Text style={styles.bookTitle}>{book.title}</Text>
          <Text style={styles.bookAuthor}>by {book.author}</Text>

          {/* Shelf Tags Row */}
          <View style={styles.shelvesRow}>
            {assignedShelves.map((shelf) => (
              <View
                key={shelf.id}
                style={[styles.shelfBadge, { borderColor: shelf.color || '#D97706' }]}
              >
                <Bookmark size={11} color={shelf.color || '#D97706'} style={{ marginRight: 4 }} />
                <Text style={[styles.shelfBadgeText, { color: shelf.color || '#D97706' }]}>
                  {shelf.name}
                </Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.addShelfChip}
              onPress={() => setShowShelfModal(true)}
            >
              <Plus size={12} color="#78716C" style={{ marginRight: 4 }} />
              <Text style={styles.addShelfChipText}>
                {assignedShelves.length > 0 ? 'Edit Shelves' : 'Add to Shelf'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Genre / Thematic Tags */}
          <View style={styles.tagsRow}>
            {book.genreTags && book.genreTags.length > 0 ? (
              book.genreTags.map((tag, idx) => (
                <View key={idx} style={styles.tagPill}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))
            ) : detectingTags ? (
              <ActivityIndicator size="small" color="#D97706" />
            ) : (
              <TouchableOpacity
                style={styles.detectTagsBtn}
                onPress={() => detectTagsForBook(book)}
              >
                <Tag size={12} color="#D97706" style={{ marginRight: 4 }} />
                <Text style={styles.detectTagsText}>Detect Themes (AI)</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.refineTitleBtn}
              onPress={handleRefineTitleWithAI}
              disabled={isRefiningTitle}
              activeOpacity={0.8}
            >
              <Sparkles size={12} color="#D84A6A" style={{ marginRight: 4 }} />
              <Text style={styles.refineTitleText}>
                {isRefiningTitle ? 'Extracting...' : 'AI Clean Title'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Primary Action Buttons */}
          <View style={styles.actionButtonGroup}>
            <TouchableOpacity
              style={styles.readButton}
              onPress={handleStartReading}
              activeOpacity={0.85}
            >
              <Play size={18} color="#FAF8F5" fill="#FAF8F5" style={{ marginRight: 8 }} />
              <Text style={styles.readButtonText}>
                {isFinished
                  ? 'Read Again'
                  : hasStarted
                    ? `Continue Reading • Page ${currentPage}`
                    : 'Open & Begin Reading'}
              </Text>
            </TouchableOpacity>

            {hasStarted && (
              <TouchableOpacity
                style={styles.rewindButton}
                onPress={() => setShowResetProgressModal(true)}
                activeOpacity={0.7}
              >
                <RotateCcw size={14} color="#78716C" style={{ marginRight: 6 }} />
                <Text style={styles.rewindButtonText}>Restart from Page 1</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Reading Progress Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <BookOpen size={17} color="#D97706" style={{ marginRight: 8 }} />
              <Text style={styles.cardTitle}>Reading Progress</Text>
            </View>
          </View>

          <ProgressBar
            progress={percent}
            color={isFinished ? '#059669' : '#D97706'}
            height={7}
          />

          <View style={styles.progressMeta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Current Leaf</Text>
              <Text style={styles.metaValue}>
                Page {currentPage} of {totalPages}
              </Text>
              <Text style={styles.metaSub}>
                {pagesRemaining > 0 ? `${pagesRemaining} pages left` : 'Completed'}
              </Text>
            </View>

            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Time Spent</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Clock size={13} color="#78716C" style={{ marginRight: 4 }} />
                <Text style={styles.metaValue}>
                  {formatReadingTime(book.progress?.totalTimeReadSeconds || 0)}
                </Text>
              </View>
              <Text style={styles.metaSub}>Tracked offline</Text>
            </View>

            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Est. to Finish</Text>
              <Text style={styles.metaValue}>
                {pagesRemaining > 0 ? `~${Math.ceil((pagesRemaining * 1.5) / 60)} hrs` : 'Finished'}
              </Text>
              <Text style={styles.metaSub}>At standard pace</Text>
            </View>
          </View>
        </View>

        {/* Active Recall Flashcards Deck Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <BrainCircuit size={17} color="#D97706" style={{ marginRight: 8 }} />
              <Text style={styles.cardTitle}>Spaced Repetition Deck</Text>
            </View>
            <View
              style={[
                styles.percentBadge,
                dueFlashcards.length > 0
                  ? { backgroundColor: 'rgba(239, 68, 68, 0.15)' }
                  : { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
              ]}
            >
              <Text
                style={[
                  styles.percentBadgeText,
                  dueFlashcards.length > 0 ? { color: '#EF4444' } : { color: '#10B981' },
                ]}
              >
                {dueFlashcards.length > 0
                  ? `${dueFlashcards.length} Due for Review`
                  : `${flashcards.length} Cards Active`}
              </Text>
            </View>
          </View>

          <Text style={styles.cardDescription}>
            Master key character arcs, vocabulary, and literary motifs using the SM-2 active recall
            algorithm.
          </Text>

          <View style={styles.cardActionRow}>
            {flashcards.length > 0 ? (
              <TouchableOpacity
                style={[styles.luxuryBtn, { backgroundColor: '#FFFFFF' }]}
                onPress={() => setShowReviewModal(true)}
              >
                <BrainCircuit size={15} color="#0D0E11" style={{ marginRight: 6 }} />
                <Text style={[styles.luxuryBtnText, { color: '#0D0E11' }]}>
                  {dueFlashcards.length > 0
                    ? `Review ${dueFlashcards.length} Due Cards`
                    : `Review Deck (${flashcards.length})`}
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[
                styles.luxuryBtn,
                {
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                },
              ]}
              onPress={handleGenerateFlashcards}
              disabled={generatingCards}
            >
              {generatingCards ? (
                <ActivityIndicator size="small" color="#D97706" />
              ) : (
                <>
                  <Sparkles
                    size={15}
                    color="#FFFFFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.luxuryBtnText,
                      { color: '#FFFFFF' },
                    ]}
                  >
                    {flashcards.length > 0
                      ? 'Generate from Highlights'
                      : 'Auto-Generate Flashcards'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Notes & Highlights Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <StickyNote size={17} color="#D97706" style={{ marginRight: 8 }} />
              <Text style={styles.cardTitle}>Notes & Marginalia</Text>
            </View>
            <View style={[styles.percentBadge, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.percentBadgeText, { color: '#B45309' }]}>
                {notes.length} {notes.length === 1 ? 'Note' : 'Notes'}
              </Text>
            </View>
          </View>

          {notes.length > 0 ? (
            <View style={styles.notesExcerptList}>
              {notes.slice(0, 2).map((n) => (
                <TouchableOpacity
                  key={n.id}
                  style={styles.noteExcerptItem}
                  onPress={() => setShowNotesModal(true)}
                  activeOpacity={0.8}
                >
                  <View style={styles.noteExcerptBar} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={styles.noteExcerptQuote}>
                      "{n.text}"
                    </Text>
                    {n.note && (
                      <Text numberOfLines={1} style={styles.noteExcerptComment}>
                        ↳ {n.note}
                      </Text>
                    )}
                    <Text style={styles.noteExcerptPage}>Page {n.pageNumber}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.cardDescription}>
              Highlight sentences and capture private reflections in the reader to build your
              personal library anthology.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.luxuryBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)' }]}
            onPress={() => setShowNotesModal(true)}
            activeOpacity={0.8}
          >
            <Highlighter size={15} color="#D97706" style={{ marginRight: 6 }} />
            <Text style={[styles.luxuryBtnText, { color: '#FFFFFF' }]}>
              {notes.length > 0 ? 'View All Annotations' : 'Add First Note'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* AI Reading Companion Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Sparkles size={17} color="#D97706" style={{ marginRight: 8 }} />
              <Text style={styles.cardTitle}>AI Reading Companion</Text>
            </View>
            <View style={[styles.percentBadge, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.percentBadgeText, { color: '#B45309' }]}>Spoiler Protected</Text>
            </View>
          </View>

          {summaries.length > 0 ? (
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryDate}>
                Recap generated on {new Date(summaries[0].generatedAt).toLocaleDateString()}
              </Text>
              <Text style={styles.summaryText}>{summaries[0].content}</Text>
            </View>
          ) : (
            <Text style={styles.cardDescription}>
              Discuss character motives, untangle convoluted prose, or request a spoiler-free recap
              strictly up to page {currentPage}.
            </Text>
          )}

          <View style={styles.cardActionRow}>
            <TouchableOpacity
              style={[
                styles.luxuryBtn,
                { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)' },
              ]}
              onPress={handleGenerateRecap}
              disabled={generatingRecap}
            >
              {generatingRecap ? (
                <ActivityIndicator size="small" color="#D97706" />
              ) : (
                <>
                  <RotateCcw size={14} color="#D97706" style={{ marginRight: 6 }} />
                  <Text style={[styles.luxuryBtnText, { color: '#FFFFFF' }]}>Generate Recap</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* In-Library Recommendations Shelf */}
        {recommendations.length > 0 && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Compass size={17} color="#D97706" style={{ marginRight: 8 }} />
              <Text style={styles.cardTitle}>Related from Your Collection</Text>
            </View>

            {recommendations.map((rec) => (
              <TouchableOpacity
                key={rec.book.id}
                style={styles.recItem}
                onPress={() => {
                  router.push({
                    pathname: '/book/[id]',
                    params: { id: rec.book.id },
                  });
                }}
              >
                <View style={styles.recDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recTitle}>{rec.book.title}</Text>
                  <Text style={styles.recReason}>{rec.reason}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Book Technical & Archival Specifications */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { marginBottom: 10 }]}>Volume Specifications</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Format Edition</Text>
            <Text style={styles.detailValue}>{book.format.toUpperCase()} Document</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Pages</Text>
            <Text style={styles.detailValue}>{book.totalPages || 'Dynamic pagination'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>File Identifier</Text>
            <Text numberOfLines={1} style={styles.detailValue}>
              {book.fileName}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date Cataloged</Text>
            <Text style={styles.detailValue}>
              {new Date(book.addedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Notes & Highlights Modal */}
      <NotesModal
        visible={showNotesModal}
        bookId={book.id}
        bookTitle={book.title}
        currentPage={currentPage}
        onClose={() => setShowNotesModal(false)}
        onNotesUpdated={reloadNotes}
      />

      {/* Add To Shelf Modal */}
      <AddToShelfModal
        visible={showShelfModal}
        book={book}
        onClose={() => setShowShelfModal(false)}
        onShelvesUpdated={reloadShelves}
      />

      {/* Flashcard Review Modal */}
      <FlashcardReviewModal
        visible={showReviewModal}
        deckTitle={`${book.title} • Active Recall`}
        cards={dueFlashcards.length > 0 ? dueFlashcards : flashcards}
        onClose={() => setShowReviewModal(false)}
        onSessionComplete={reloadFlashcards}
      />

      {/* Reset Progress Confirmation Modal */}
      <Modal
        visible={showResetProgressModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetProgressModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowResetProgressModal(false)}
        >
          <Pressable style={styles.modalDialog} onPress={(e) => e.stopPropagation()}>
            <View style={styles.resetModalIconWrapper}>
              <RotateCcw size={26} color="#DC2626" />
            </View>

            <Text style={styles.resetModalTitle}>Rewind Reading Progress?</Text>
            <Text style={styles.resetModalDescription}>
              This will return your reading position to Page 1 and reset your completion percentage
              to 0%. Your notes and flashcards will be preserved.
            </Text>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowResetProgressModal(false)}
              >
                <Text style={styles.cancelBtnText}>Keep Place</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmResetBtn}
                onPress={handleConfirmResetProgress}
              >
                <Text style={styles.confirmResetBtnText}>Reset to Page 1</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0E11',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D0E11',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0D0E11',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    maxWidth: '72%',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  inactiveBanner: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  inactiveBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
  },
  inactiveBannerText: {
    fontSize: 12,
    color: '#D1D5DB',
    lineHeight: 17,
    marginBottom: 10,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 6,
  },
  book3DWrapper: {
    position: 'relative',
    marginBottom: 18,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  ribbonBookmark: {
    position: 'absolute',
    top: -6,
    right: 24,
    width: 14,
    height: 34,
    backgroundColor: '#D97706',
    zIndex: 10,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  coverFrame: {
    width: 156,
    height: 228,
    borderRadius: 8,
    backgroundColor: '#292524',
    overflow: 'hidden',
    position: 'relative',
    borderRightWidth: 5,
    borderRightColor: '#E2DCD5',
    borderTopWidth: 1,
    borderTopColor: '#44403C',
    borderBottomWidth: 2,
    borderBottomColor: '#1C1917',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderOrnament: {
    marginBottom: 10,
  },
  placeholderOrnamentText: {
    fontSize: 18,
    color: '#D97706',
  },
  placeholderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FAF8F5',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
  },
  placeholderDivider: {
    width: 32,
    height: 1,
    backgroundColor: '#D97706',
    marginVertical: 10,
  },
  placeholderAuthor: {
    fontSize: 11,
    color: '#A8A29E',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  spineShadow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  spineCrease: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 16,
    width: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  foilBadge: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  foilBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  bookTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
    paddingHorizontal: 12,
    lineHeight: 28,
  },
  bookAuthor: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 12,
  },
  shelvesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  shelfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#16181D',
    borderWidth: 1,
  },
  shelfBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  addShelfChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#1F222A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  addShelfChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  tagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  detectTagsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16181D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  detectTagsText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  actionButtonGroup: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  readButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    width: '100%',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  readButtonText: {
    color: '#0D0E11',
    fontSize: 15,
    fontWeight: '800',
  },
  rewindButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  rewindButtonText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#16181D',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 14,
  },
  skelBase: {
    backgroundColor: '#1F222A',
  },
  skelCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardDescription: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
    marginBottom: 12,
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  percentBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  percentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F4',
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metaSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },
  luxuryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#1F222A',
    flex: 1,
  },
  luxuryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  notesExcerptList: {
    marginBottom: 12,
    gap: 8,
  },
  noteExcerptItem: {
    flexDirection: 'row',
    backgroundColor: '#1F222A',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  noteExcerptBar: {
    width: 3,
    backgroundColor: AppPalette.accentBerry,
    borderRadius: 2,
    marginRight: 10,
  },
  noteExcerptQuote: {
    fontSize: 12,
    color: '#FFFFFF',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  noteExcerptComment: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  noteExcerptPage: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
  },
  summaryContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  summaryDate: {
    fontSize: 10,
    color: '#A8A29E',
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 13,
    color: '#E5E7EB',
    lineHeight: 18,
  },
  recItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  recDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D97706',
    marginRight: 10,
  },
  recTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  recReason: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  detailLabel: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    maxWidth: '65%',
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    marginBottom: 12,
  },
  backBtn: {
    backgroundColor: '#1C1917',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#FAF8F5',
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(28, 25, 23, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  resetModalIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  resetModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
  },
  resetModalDescription: {
    fontSize: 13,
    color: '#57534E',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F5F5F4',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#57534E',
  },
  confirmResetBtn: {
    flex: 1.2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  confirmResetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  refineTitleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(216, 74, 106, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(216, 74, 106, 0.35)',
    marginLeft: 6,
  },
  refineTitleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D84A6A',
  },
});
