import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  Search,
  MoreHorizontal,
  FolderOpen,
  FileText,
  Sparkles,
  Plus,
  X,
  BookOpen,
  Bookmark,
} from 'lucide-react-native';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { BookCard } from '@/components/ui/BookCard';
import { BookRepository } from '@/services/database/bookRepository';
import { Shelf, BookWithProgress } from '@/types/book';
import { AddToShelfModal } from '@/components/shelves/AddToShelfModal';
import { ManageShelvesModal } from '@/components/shelves/ManageShelvesModal';
import { AppPalette } from '@/constants/theme';
import { HorizontalScroll } from '@/components/ui/HorizontalScroll';
import { inferBookTitle, inferBookAuthor } from '@/services/parsers/titleInference';
import {
  RecommendationEngine,
  RECOMMENDATION_PARAMETERS,
  RecommendationParameter,
} from '@/services/recommendations/recommendationEngine';

type StatusTab = 'all' | 'reading' | 'unread' | 'finished' | 'pdfs';

export default function LibraryScreen() {
  const router = useRouter();
  const {
    books,
    isScanning,
    isLoading,
    initialize,
    loadBooks,
    rescanDirectory,
    selectDirectoryAndScan,
    importFilesManually,
    refineAllBookTitlesWithAI,
  } = useLibraryStore();

  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedShelfId, setSelectedShelfId] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [shelfTargetBook, setShelfTargetBook] = useState<BookWithProgress | null>(null);
  const [showManageShelves, setShowManageShelves] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExtractingTitles, setIsExtractingTitles] = useState(false);
  const [selectedRecParam, setSelectedRecParam] = useState<RecommendationParameter>('for_you');

  const currentRecommendations = useMemo(() => {
    return RecommendationEngine.getRecommendations(books, selectedRecParam, 6);
  }, [books, selectedRecParam]);

  const loadShelves = async () => {
    try {
      const data = await BookRepository.getShelves();
      setShelves(data);
    } catch (err) {
      console.error('Failed to load shelves:', err);
    }
  };

  /** Shelf membership changed: refresh chip counts and the filtered book grid. */
  const refreshShelfAssignments = async () => {
    await Promise.all([loadShelves(), loadBooks()]);
  };

  useEffect(() => {
    initialize();
    loadShelves();
  }, []);

  const handleOpenBook = (bookId: string) => {
    router.push({
      pathname: '/book/[id]',
      params: { id: bookId },
    });
  };

  const handleSelectFolder = async () => {
    setShowAddModal(false);
    await selectDirectoryAndScan();
  };

  const handleImportFiles = async () => {
    setShowAddModal(false);
    await importFilesManually();
  };

  const handleExtractAllTitles = async () => {
    setIsExtractingTitles(true);
    try {
      const res = await refineAllBookTitlesWithAI();
      await loadBooks();
      setShowAddModal(false);
      Alert.alert(
        'AI Title Extraction Complete',
        res.updatedCount > 0
          ? `Updated ${res.updatedCount} book title(s) to exact canonical versions app-wide.`
          : 'All book titles in your library are already exact and canonical!'
      );
    } catch (e: any) {
      Alert.alert('AI Error', e?.message || 'Failed to extract titles');
    } finally {
      setIsExtractingTitles(false);
    }
  };

  // Counts for each status tab
  const counts = useMemo(() => {
    let reading = 0;
    let unread = 0;
    let finished = 0;
    let pdfs = 0;
    let epubs = 0;
    let magazines = 0;
    let articles = 0;
    for (const b of books) {
      const pct = b.progress?.percentComplete ?? 0;
      if (pct >= 100) finished++;
      else if (pct > 0) reading++;
      else unread++;

      if (b.format === 'pdf') pdfs++;
      else epubs++;

      const isMag = b.genreTags?.some((t) => {
        const lower = t.toLowerCase();
        return lower.includes('magazine') || lower.includes('periodical') || lower.includes('self-help');
      });
      if (isMag) magazines++;

      const isArt = b.genreTags?.some((t) => {
        const lower = t.toLowerCase();
        return lower.includes('article') || lower.includes('essay') || lower.includes('paper') || lower.includes('productivity');
      });
      if (isArt) articles++;
    }
    return {
      all: books.length,
      reading,
      unread,
      finished,
      pdfs,
      epubs,
      magazines,
      articles,
    };
  }, [books]);

  // Extract all unique genre tags
  const availableTags = useMemo(() => {
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
    return books.filter((b) => {
      const pct = b.progress?.percentComplete ?? 0;

      // Status Tab filter
      if (activeTab === 'reading' && (pct <= 0 || pct >= 100)) return false;
      if (activeTab === 'unread' && pct > 0) return false;
      if (activeTab === 'finished' && pct < 100) return false;
      if (activeTab === 'pdfs' && b.format !== 'pdf') return false;

      // Tag filter
      if (selectedTag && !b.genreTags?.includes(selectedTag)) return false;

      // Shelf filter
      if (selectedShelfId !== 'all' && !b.shelfIds?.includes(selectedShelfId)) return false;

      // Search query filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = b.title.toLowerCase().includes(q);
        const matchesAuthor = b.author?.toLowerCase().includes(q);
        const matchesTag = b.genreTags?.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesAuthor && !matchesTag) return false;
      }

      return true;
    });
  }, [books, activeTab, selectedTag, selectedShelfId, searchQuery]);

  const epubBooks = useMemo(() => books.filter((b) => b.format === 'epub'), [books]);
  const pdfBooks = useMemo(() => books.filter((b) => b.format === 'pdf'), [books]);
  const magazineBooks = useMemo(
    () =>
      books.filter((b) =>
        b.genreTags?.some((t) => {
          const lower = t.toLowerCase();
          return lower.includes('magazine') || lower.includes('periodical') || lower.includes('self-help');
        })
      ),
    [books]
  );
  const articleBooks = useMemo(
    () =>
      books.filter((b) =>
        b.genreTags?.some((t) => {
          const lower = t.toLowerCase();
          return lower.includes('article') || lower.includes('essay') || lower.includes('paper') || lower.includes('productivity');
        })
      ),
    [books]
  );

  const currentlyReading = useMemo(() => {
    return (
      books.find(
        (b) => (b.progress?.percentComplete ?? 0) > 0 && (b.progress?.percentComplete ?? 0) < 100
      ) || null
    );
  }, [books]);

  const mainScrollRef = React.useRef<ScrollView>(null);

  const scrollToBooksSection = () => {
    mainScrollRef.current?.scrollTo({ y: 440, animated: true });
  };

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      {/* ENTIRE PAGE IS 100% SCROLLABLE */}
      <ScrollView
        ref={mainScrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        directionalLockEnabled
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isLoading || isScanning}
            onRefresh={rescanDirectory}
            tintColor="#FFFFFF"
            colors={['#FFFFFF']}
          />
        }
      >
        {/* Header Bar matching Screen 2 */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>My Library</Text>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setShowSearchModal(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Search size={21} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setShowAddModal(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MoreHorizontal size={21} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Primary Status Filter Pills Row (ALL, READING, UNREAD, FINISHED, PDFS) */}
        <HorizontalScroll
          contentContainerStyle={styles.statusPillsContent}
          style={styles.statusPillsRow}
        >
          <TouchableOpacity
            style={[styles.statusPill, activeTab === 'all' && styles.statusPillActive]}
            onPress={() => {
              setActiveTab('all');
              setSelectedTag(null);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.statusPillText, activeTab === 'all' && styles.statusPillTextActive]}>
              ALL
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusPill, activeTab === 'reading' && styles.statusPillActive]}
            onPress={() => setActiveTab('reading')}
            activeOpacity={0.8}
          >
            <Text style={[styles.statusPillText, activeTab === 'reading' && styles.statusPillTextActive]}>
              READING ({counts.reading})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusPill, activeTab === 'unread' && styles.statusPillActive]}
            onPress={() => setActiveTab('unread')}
            activeOpacity={0.8}
          >
            <Text style={[styles.statusPillText, activeTab === 'unread' && styles.statusPillTextActive]}>
              UNREAD ({counts.unread})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusPill, activeTab === 'finished' && styles.statusPillActive]}
            onPress={() => setActiveTab('finished')}
            activeOpacity={0.8}
          >
            <Text style={[styles.statusPillText, activeTab === 'finished' && styles.statusPillTextActive]}>
              FINISHED ({counts.finished})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusPill, activeTab === 'pdfs' && styles.statusPillActive]}
            onPress={() => setActiveTab('pdfs')}
            activeOpacity={0.8}
          >
            <Text style={[styles.statusPillText, activeTab === 'pdfs' && styles.statusPillTextActive]}>
              PDFS ({counts.pdfs})
            </Text>
          </TouchableOpacity>
        </HorizontalScroll>

        {/* Shelves & Collections Filter Strip */}
        {shelves.length > 0 && (
          <HorizontalScroll
            contentContainerStyle={styles.shelvesPillsContent}
            style={styles.shelvesPillsRow}
          >
            <TouchableOpacity
              style={[
                styles.shelfFilterChip,
                selectedShelfId === 'all' && styles.shelfFilterChipActive,
              ]}
              onPress={() => setSelectedShelfId('all')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.shelfFilterChipText,
                  selectedShelfId === 'all' && styles.shelfFilterChipTextActive,
                ]}
              >
                All Shelves
              </Text>
            </TouchableOpacity>

            {shelves.map((shelf) => {
              const isSelected = selectedShelfId === shelf.id;
              return (
                <TouchableOpacity
                  key={shelf.id}
                  style={[
                    styles.shelfFilterChip,
                    isSelected && {
                      backgroundColor: `${shelf.color}25`,
                      borderColor: shelf.color,
                    },
                  ]}
                  onPress={() => setSelectedShelfId(isSelected ? 'all' : shelf.id)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.shelfDot,
                      { backgroundColor: shelf.color || '#D97706' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.shelfFilterChipText,
                      isSelected && { color: '#FFFFFF', fontWeight: '700' },
                    ]}
                  >
                    {shelf.name} ({shelf.bookCount})
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.manageShelvesPillBtn}
              onPress={() => setShowManageShelves(true)}
              activeOpacity={0.8}
            >
              <Plus size={12} color="#D97706" style={{ marginRight: 4 }} />
              <Text style={styles.manageShelvesPillText}>Manage</Text>
            </TouchableOpacity>
          </HorizontalScroll>
        )}

        {/* Continue Reading Hero Card (when user is reading a book) */}
        {currentlyReading && activeTab === 'all' && !selectedTag && !searchQuery.trim() && (
          <View style={styles.continueCard}>
            <View style={styles.continueCoverWrap}>
              {currentlyReading.coverUri ? (
                <Image
                  source={{ uri: currentlyReading.coverUri }}
                  style={styles.continueCoverImg}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.continueCoverPlaceholder}>
                  <BookOpen size={24} color="#FFFFFF" />
                </View>
              )}
            </View>

            <View style={styles.continueInfo}>
              <Text numberOfLines={1} style={styles.continueTitle}>
                {inferBookTitle(currentlyReading.title)}
              </Text>
              <Text numberOfLines={1} style={styles.continueAuthor}>
                by {inferBookAuthor(currentlyReading.title, currentlyReading.author)}
              </Text>

              {/* Progress & Duration */}
              <View style={styles.continueProgressRow}>
                <Text style={styles.continueProgressText}>
                  {Math.round(currentlyReading.progress?.percentComplete ?? 0)}% •{' '}
                  {currentlyReading.progress?.currentPage || 1} of {currentlyReading.totalPages || 100}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.continuePillBtn}
                onPress={() => handleOpenBook(currentlyReading.id)}
                activeOpacity={0.85}
              >
                <Text style={styles.continuePillText}>Continue reading</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Frosted Acrylic Glass Pockets Grid (Signature UI from Image 1) */}
        {activeTab === 'all' && !selectedTag && !searchQuery.trim() && (
          <View style={styles.pocketsGrid}>
            {/* Pocket 1: BOOKS (EPUBs) */}
            <TouchableOpacity
              style={styles.pocketCard}
              activeOpacity={0.85}
              onPress={() => {
                if (epubBooks.length === 1) {
                  handleOpenBook(epubBooks[0].id);
                } else {
                  setActiveTab('all');
                  setSelectedTag(null);
                  scrollToBooksSection();
                }
              }}
            >
              {/* Peek-out Book Covers behind the glass pocket */}
              <View style={styles.pocketCoversBackdrop}>
                <TouchableOpacity
                  style={[styles.miniCover, styles.miniCoverLeft, { backgroundColor: '#1E3A5F' }]}
                  onPress={() => {
                    if (epubBooks.length > 0) {
                      handleOpenBook(epubBooks[0].id);
                    } else if (books.length > 0) {
                      handleOpenBook(books[0].id);
                    } else {
                      setShowAddModal(true);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text numberOfLines={2} style={styles.miniCoverText}>
                    {epubBooks[0]?.title || 'BOOKS'}
                  </Text>
                  <Text style={styles.miniCoverSub}>
                    {epubBooks[0]?.author ? epubBooks[0].author.slice(0, 10) : 'READ'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.miniCover, styles.miniCoverRight, { backgroundColor: '#3F1D38' }]}
                  onPress={() => {
                    if (epubBooks.length > 1) {
                      handleOpenBook(epubBooks[1].id);
                    } else if (epubBooks.length > 0) {
                      handleOpenBook(epubBooks[0].id);
                    } else if (books.length > 0) {
                      handleOpenBook(books[0].id);
                    } else {
                      setShowAddModal(true);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text numberOfLines={2} style={styles.miniCoverText}>
                    {epubBooks[1]?.title || (epubBooks[0] ? 'TAP TO OPEN' : 'COLLECTION')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Frosted Glass Acrylic Pocket with Corner Rivets */}
              <View style={styles.glassPocketFront}>
                <View style={[styles.rivet, styles.rivetTopLeft]} />
                <View style={[styles.rivet, styles.rivetTopRight]} />
                <View style={[styles.rivet, styles.rivetBottomLeft]} />
                <View style={[styles.rivet, styles.rivetBottomRight]} />
              </View>

              {/* Label Under Pocket (the pocket itself is the tap target) */}
              <View style={styles.pocketMeta}>
                <Text style={styles.pocketTitle}>BOOKS</Text>
                <Text style={styles.pocketCount}>{counts.epubs} ITEMS</Text>
              </View>
            </TouchableOpacity>

            {/* Pocket 2: MAGAZINES */}
            <TouchableOpacity
              style={styles.pocketCard}
              activeOpacity={0.85}
              onPress={() => {
                if (magazineBooks.length > 0) {
                  const tag = magazineBooks[0].genreTags?.find((t) =>
                    t.toLowerCase().includes('magazine') || t.toLowerCase().includes('self-help')
                  );
                  setSelectedTag(tag || null);
                  scrollToBooksSection();
                } else {
                  Alert.alert(
                    'Magazines & Periodicals',
                    'No magazines in your collection yet. Would you like to import files now?',
                    [
                      { text: 'Import Files', onPress: handleImportFiles },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                }
              }}
            >
              <View style={styles.pocketCoversBackdrop}>
                <TouchableOpacity
                  style={[styles.miniCover, styles.miniCoverLeft, { backgroundColor: '#27272A' }]}
                  onPress={() => {
                    if (magazineBooks.length > 0) {
                      handleOpenBook(magazineBooks[0].id);
                    } else {
                      Alert.alert(
                        'Magazines & Periodicals',
                        'No magazines in your collection yet. Would you like to import files now?',
                        [
                          { text: 'Import Files', onPress: handleImportFiles },
                          { text: 'Cancel', style: 'cancel' },
                        ]
                      );
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text numberOfLines={2} style={styles.miniCoverText}>
                    {magazineBooks[0]?.title || 'KINFORK'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.miniCover, styles.miniCoverRight, { backgroundColor: '#E4E4E7' }]}
                  onPress={() => {
                    if (magazineBooks.length > 1) {
                      handleOpenBook(magazineBooks[1].id);
                    } else if (magazineBooks.length > 0) {
                      handleOpenBook(magazineBooks[0].id);
                    } else {
                      Alert.alert(
                        'Magazines & Periodicals',
                        'No magazines in your collection yet. Would you like to import files now?',
                        [
                          { text: 'Import Files', onPress: handleImportFiles },
                          { text: 'Cancel', style: 'cancel' },
                        ]
                      );
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text numberOfLines={2} style={[styles.miniCoverText, { color: '#18181B' }]}>
                    {magazineBooks[1]?.title || 'anthology'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.glassPocketFront}>
                <View style={[styles.rivet, styles.rivetTopLeft]} />
                <View style={[styles.rivet, styles.rivetTopRight]} />
                <View style={[styles.rivet, styles.rivetBottomLeft]} />
                <View style={[styles.rivet, styles.rivetBottomRight]} />
              </View>

              <View style={styles.pocketMeta}>
                <Text style={styles.pocketTitle}>MAGAZINES</Text>
                <Text style={styles.pocketCount}>{counts.magazines} ITEMS</Text>
              </View>
            </TouchableOpacity>

            {/* Pocket 3: ARTICLES */}
            <TouchableOpacity
              style={styles.pocketCard}
              activeOpacity={0.85}
              onPress={() => {
                if (articleBooks.length > 0) {
                  const tag = articleBooks[0].genreTags?.find((t) =>
                    t.toLowerCase().includes('article') || t.toLowerCase().includes('productivity')
                  );
                  setSelectedTag(tag || null);
                  scrollToBooksSection();
                } else {
                  Alert.alert(
                    'Articles & Essays',
                    'No articles in your collection yet. Would you like to import files now?',
                    [
                      { text: 'Import Files', onPress: handleImportFiles },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                }
              }}
            >
              <View style={styles.pocketCoversBackdrop}>
                <TouchableOpacity
                  style={[styles.miniCover, styles.miniCoverLeft, { backgroundColor: '#1C1917' }]}
                  onPress={() => {
                    if (articleBooks.length > 0) {
                      handleOpenBook(articleBooks[0].id);
                    } else {
                      Alert.alert(
                        'Articles & Essays',
                        'No articles in your collection yet. Would you like to import files now?',
                        [
                          { text: 'Import Files', onPress: handleImportFiles },
                          { text: 'Cancel', style: 'cancel' },
                        ]
                      );
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text numberOfLines={2} style={styles.miniCoverText}>
                    {articleBooks[0]?.title || 'Atlantic'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.miniCover, styles.miniCoverRight, { backgroundColor: '#C2410C' }]}
                  onPress={() => {
                    if (articleBooks.length > 1) {
                      handleOpenBook(articleBooks[1].id);
                    } else if (articleBooks.length > 0) {
                      handleOpenBook(articleBooks[0].id);
                    } else {
                      Alert.alert(
                        'Articles & Essays',
                        'No articles in your collection yet. Would you like to import files now?',
                        [
                          { text: 'Import Files', onPress: handleImportFiles },
                          { text: 'Cancel', style: 'cancel' },
                        ]
                      );
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text numberOfLines={2} style={styles.miniCoverText}>
                    {articleBooks[1]?.title || 'CLOCKWORK'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.glassPocketFront}>
                <View style={[styles.rivet, styles.rivetTopLeft]} />
                <View style={[styles.rivet, styles.rivetTopRight]} />
                <View style={[styles.rivet, styles.rivetBottomLeft]} />
                <View style={[styles.rivet, styles.rivetBottomRight]} />
              </View>

              <View style={styles.pocketMeta}>
                <Text style={styles.pocketTitle}>ARTICLES</Text>
                <Text style={styles.pocketCount}>{counts.articles} ITEMS</Text>
              </View>
            </TouchableOpacity>

            {/* Pocket 4: DOCUMENTS (PDFs) */}
            <TouchableOpacity
              style={styles.pocketCard}
              activeOpacity={0.85}
              onPress={() => {
                if (pdfBooks.length === 1) {
                  handleOpenBook(pdfBooks[0].id);
                } else if (pdfBooks.length > 1) {
                  setActiveTab('pdfs');
                  scrollToBooksSection();
                } else {
                  Alert.alert(
                    'PDF Documents',
                    'No PDF documents found in your library. Would you like to import a PDF file now?',
                    [
                      { text: 'Import PDF', onPress: handleImportFiles },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                }
              }}
            >
              <View style={styles.pocketCoversBackdrop}>
                <TouchableOpacity
                  style={[styles.miniCover, styles.miniCoverLeft, { backgroundColor: '#312E81' }]}
                  onPress={() => {
                    if (pdfBooks.length > 0) {
                      handleOpenBook(pdfBooks[0].id);
                    } else {
                      Alert.alert(
                        'PDF Documents',
                        'No PDF documents found yet. Would you like to import a PDF file now?',
                        [
                          { text: 'Import PDF', onPress: handleImportFiles },
                          { text: 'Cancel', style: 'cancel' },
                        ]
                      );
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text numberOfLines={2} style={styles.miniCoverText}>
                    {pdfBooks[0]?.title || 'DOCUMENTS'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.miniCover, styles.miniCoverRight, { backgroundColor: '#451A03' }]}
                  onPress={() => {
                    if (pdfBooks.length > 1) {
                      handleOpenBook(pdfBooks[1].id);
                    } else if (pdfBooks.length > 0) {
                      handleOpenBook(pdfBooks[0].id);
                    } else {
                      Alert.alert(
                        'PDF Documents',
                        'No PDF documents found yet. Would you like to import a PDF file now?',
                        [
                          { text: 'Import PDF', onPress: handleImportFiles },
                          { text: 'Cancel', style: 'cancel' },
                        ]
                      );
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text numberOfLines={2} style={styles.miniCoverText}>
                    {pdfBooks[1]?.title || (pdfBooks[0] ? 'TAP TO OPEN' : 'OFFLINE PDF')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.glassPocketFront}>
                <View style={[styles.rivet, styles.rivetTopLeft]} />
                <View style={[styles.rivet, styles.rivetTopRight]} />
                <View style={[styles.rivet, styles.rivetBottomLeft]} />
                <View style={[styles.rivet, styles.rivetBottomRight]} />
              </View>

              <View style={styles.pocketMeta}>
                <Text style={styles.pocketTitle}>DOCUMENTS</Text>
                <Text style={styles.pocketCount}>{counts.pdfs} ITEMS</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Smart In-Library Recommendations Section */}
        {books.length > 0 && activeTab === 'all' && !selectedTag && !searchQuery.trim() && (
          <View style={styles.recommendationsContainer}>
            <View style={styles.recommendationsHeader}>
              <View style={styles.recommendationsTitleRow}>
                <View style={styles.recIconBadge}>
                  <Sparkles size={16} color="#D97706" />
                </View>
                <View>
                  <Text style={styles.recommendationsTitle}>Curated For You</Text>
                  <Text style={styles.recommendationsSubtitle}>
                    Personalized suggestions from your library
                  </Text>
                </View>
              </View>
            </View>

            {/* Parameter Selector Pills */}
            <HorizontalScroll
              contentContainerStyle={styles.paramPillsContent}
              style={styles.paramPillsRow}
            >
              {RECOMMENDATION_PARAMETERS.map((param) => {
                const isSelected = selectedRecParam === param.id;
                return (
                  <TouchableOpacity
                    key={param.id}
                    style={[
                      styles.paramPill,
                      isSelected && styles.paramPillActive,
                    ]}
                    onPress={() => setSelectedRecParam(param.id)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.paramPillText,
                        isSelected && styles.paramPillTextActive,
                      ]}
                    >
                      {param.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </HorizontalScroll>

            {/* Horizontal Recommendations Cards */}
            <HorizontalScroll
              contentContainerStyle={styles.recCardsContent}
              style={styles.recCardsRow}
            >
              {currentRecommendations.map((rec) => (
                <TouchableOpacity
                  key={`${rec.parameter}_${rec.book.id}`}
                  style={styles.recCard}
                  onPress={() => handleOpenBook(rec.book.id)}
                  activeOpacity={0.88}
                >
                  <View style={styles.recCoverWrapper}>
                    {rec.book.coverUri ? (
                      <Image
                        source={{ uri: rec.book.coverUri }}
                        style={styles.recCoverImg}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={styles.recCoverPlaceholder}>
                        <BookOpen size={24} color="#D97706" />
                        <Text numberOfLines={2} style={styles.recCoverPlaceholderTitle}>
                          {rec.book.title}
                        </Text>
                      </View>
                    )}
                    <View style={styles.recBadge}>
                      <Text style={styles.recBadgeText}>{rec.badge}</Text>
                    </View>
                  </View>

                  <View style={styles.recInfo}>
                    <Text numberOfLines={1} style={styles.recBookTitle}>
                      {rec.book.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.recBookAuthor}>
                      by {rec.book.author}
                    </Text>
                    <Text numberOfLines={2} style={styles.recReason}>
                      {rec.reason}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </HorizontalScroll>
          </View>
        )}

        {/* Tags Horizontal Scroll Row */}
        {availableTags.length > 0 && (
          <HorizontalScroll
            contentContainerStyle={styles.tagsScrollContent}
            style={styles.tagsScrollView}
          >
            <TouchableOpacity
              style={[styles.tagPill, !selectedTag && styles.tagPillActive]}
              onPress={() => setSelectedTag(null)}
            >
              <Text style={[styles.tagText, !selectedTag && styles.tagTextActive]}>
                All Genres
              </Text>
            </TouchableOpacity>

            {availableTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[styles.tagPill, selectedTag === tag && styles.tagPillActive]}
                onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                <Text style={[styles.tagText, selectedTag === tag && styles.tagTextActive]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </HorizontalScroll>
        )}

        {/* Active Search Banner if Query is active */}
        {searchQuery.trim().length > 0 && (
          <View style={styles.activeSearchBanner}>
            <Text style={styles.activeSearchText}>
              Searching for "{searchQuery}" ({filteredBooks.length} results)
            </Text>
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearSearchBtn}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {activeTab === 'reading'
              ? `Currently Reading (${filteredBooks.length})`
              : activeTab === 'unread'
              ? `Unread Books (${filteredBooks.length})`
              : activeTab === 'finished'
              ? `Finished (${filteredBooks.length})`
              : activeTab === 'pdfs'
              ? `PDF Documents (${filteredBooks.length})`
              : selectedTag
              ? `${selectedTag} (${filteredBooks.length})`
              : `All Books (${filteredBooks.length})`}
          </Text>

          {(selectedTag || activeTab !== 'all') && (
            <TouchableOpacity
              onPress={() => {
                setActiveTab('all');
                setSelectedTag(null);
                setSearchQuery('');
              }}
            >
              <Text style={styles.resetBtnText}>Reset Filter</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Books Grid */}
        {filteredBooks.length === 0 ? (
          <View style={styles.emptyWrap}>
            <BookOpen size={40} color="#374151" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No books found</Text>
            <Text style={styles.emptySub}>
              {activeTab === 'reading'
                ? 'Tap any book to begin reading and track progress!'
                : activeTab === 'finished'
                ? 'Books will appear here once you reach 100% completion.'
                : 'Select books from storage or import sample files.'}
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.emptyActionText}>Add Books</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cardsGrid}>
            {filteredBooks.map((item) => (
              <View key={item.id} style={styles.cardCol}>
                <BookCard
                  book={item}
                  onPress={() => handleOpenBook(item.id)}
                  onAddToShelf={() => setShelfTargetBook(item)}
                />
              </View>
            ))}
          </View>
        )}

        {/* Bottom Inset for Tab Bar */}
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Search Modal */}
      <Modal
        visible={showSearchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.searchModalCard}>
            <View style={styles.searchBarRow}>
              <Search size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search title, author, or genre..."
                placeholderTextColor="#6B7280"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.closeSearchBtn}
              onPress={() => setShowSearchModal(false)}
            >
              <Text style={styles.closeSearchBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Books & Import Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalSheetTitle}>Library Options</Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={handleSelectFolder}
              activeOpacity={0.8}
            >
              <View style={styles.modalOptionIcon}>
                <FolderOpen size={20} color="#FFFFFF" />
              </View>
              <View style={styles.modalOptionTextCol}>
                <Text style={styles.modalOptionTitle}>Sync Storage Folder</Text>
                <Text style={styles.modalOptionDesc}>Scan EPUBs and PDFs from Android SAF</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={handleImportFiles}
              activeOpacity={0.8}
            >
              <View style={styles.modalOptionIcon}>
                <FileText size={20} color="#FFFFFF" />
              </View>
              <View style={styles.modalOptionTextCol}>
                <Text style={styles.modalOptionTitle}>Import Specific Files</Text>
                <Text style={styles.modalOptionDesc}>Choose single book files from storage</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowAddModal(false);
                setShowManageShelves(true);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.modalOptionIcon}>
                <Bookmark size={20} color="#FFFFFF" />
              </View>
              <View style={styles.modalOptionTextCol}>
                <Text style={styles.modalOptionTitle}>Manage Shelves & Collections</Text>
                <Text style={styles.modalOptionDesc}>Organize books into custom reading tags</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalOption, { borderColor: 'rgba(16, 185, 129, 0.4)' }]}
              onPress={handleExtractAllTitles}
              disabled={isExtractingTitles}
              activeOpacity={0.8}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: '#10B981' }]}>
                {isExtractingTitles ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Sparkles size={20} color="#FFFFFF" />
                )}
              </View>
              <View style={styles.modalOptionTextCol}>
                <Text style={styles.modalOptionTitle}>
                  {isExtractingTitles ? 'Extracting Exact Titles...' : 'AI Clean All Titles App-Wide'}
                </Text>
                <Text style={styles.modalOptionDesc}>Extract exact book titles & authors using AI</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add To Shelf Modal */}
      {shelfTargetBook && (
        <AddToShelfModal
          visible={Boolean(shelfTargetBook)}
          book={shelfTargetBook}
          onShelvesUpdated={refreshShelfAssignments}
          onClose={() => {
            setShelfTargetBook(null);
            refreshShelfAssignments();
          }}
        />
      )}

      {/* Manage Shelves Modal */}
      <ManageShelvesModal
        visible={showManageShelves}
        onClose={() => {
          setShowManageShelves(false);
          loadShelves();
        }}
        onShelvesUpdated={loadShelves}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0D0E11',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 24,
  },

  /* Header Bar */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    fontFamily: Platform.select({
      web: '"Georgia", "Charter", serif',
      default: 'serif',
    }),
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Status Pills Row */
  statusPillsRow: {
    marginVertical: 12,
    flexGrow: 0,
  },
  statusPillsContent: {
    paddingHorizontal: 20,
    gap: 8,
    paddingRight: 28,
  },
  statusPill: {
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  statusPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
  },
  statusPillTextActive: {
    color: '#0D0E11',
    fontWeight: '800',
  },

  /* Continue Reading Card */
  continueCard: {
    flexDirection: 'row',
    backgroundColor: '#16181D',
    borderRadius: 18,
    marginHorizontal: 20,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  continueCoverWrap: {
    width: 60,
    height: 85,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#27272A',
    marginRight: 14,
  },
  continueCoverImg: {
    width: '100%',
    height: '100%',
  },
  continueCoverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueInfo: {
    flex: 1,
  },
  continueTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  continueAuthor: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  continueProgressRow: {
    marginBottom: 8,
  },
  continueProgressText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  continuePillBtn: {
    alignSelf: 'flex-start',
    backgroundColor: AppPalette.accentBerry,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  continuePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Frosted Glass Pockets Grid (Image 1 Signature) */
  pocketsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  pocketCard: {
    width: '50%',
    padding: 6,
  },
  pocketCoversBackdrop: {
    height: 70,
    position: 'relative',
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  miniCover: {
    position: 'absolute',
    width: 58,
    height: 75,
    borderRadius: 6,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  miniCoverLeft: {
    bottom: -10,
    left: 18,
    transform: [{ rotate: '-8deg' }],
    zIndex: 1,
  },
  miniCoverRight: {
    bottom: -12,
    right: 18,
    transform: [{ rotate: '10deg' }],
    zIndex: 2,
  },
  miniCoverText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  miniCoverSub: {
    fontSize: 6,
    color: '#9CA3AF',
    fontWeight: '700',
    marginTop: 2,
  },
  glassPocketFront: {
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    position: 'relative',
    marginTop: -8,
    zIndex: 10,
  },
  rivet: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
    opacity: 0.75,
  },
  rivetTopLeft: {
    top: 6,
    left: 6,
  },
  rivetTopRight: {
    top: 6,
    right: 6,
  },
  rivetBottomLeft: {
    bottom: 6,
    left: 6,
  },
  rivetBottomRight: {
    bottom: 6,
    right: 6,
  },
  pocketMeta: {
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  pocketTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  pocketCount: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },

  /* Tags Horizontal Row */
  tagsScrollView: {
    marginBottom: 16,
  },
  tagsScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#16181D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tagPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  tagText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  tagTextActive: {
    color: '#0D0E11',
    fontWeight: '800',
  },

  /* Search Banner */
  activeSearchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#16181D',
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeSearchText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  clearSearchBtn: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Section Header */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },

  /* Grid Layout */
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  cardCol: {
    width: '50%',
  },

  /* Empty State */
  emptyWrap: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  emptyActionBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 20,
  },
  emptyActionText: {
    color: '#0D0E11',
    fontSize: 13,
    fontWeight: '800',
  },

  /* Search Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-start',
  },
  searchModalCard: {
    backgroundColor: '#16181D',
    marginHorizontal: 16,
    marginTop: Platform.OS === 'ios' ? 60 : 30,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F222A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
  },
  closeSearchBtn: {
    alignSelf: 'flex-end',
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  closeSearchBtnText: {
    color: '#0D0E11',
    fontSize: 13,
    fontWeight: '800',
  },

  /* Modal Sheet */
  modalSheet: {
    marginTop: 'auto',
    backgroundColor: '#16181D',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalSheetTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F222A',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  modalOptionTextCol: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  modalOptionDesc: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  /* Shelves / Collections Row */
  shelvesPillsRow: {
    marginBottom: 16,
  },
  shelvesPillsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  shelfFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#16181D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  shelfFilterChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: '#FFFFFF',
  },
  shelfFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  shelfFilterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  shelfDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  manageShelvesPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  manageShelvesPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },

  /* Smart Recommendations Section */
  recommendationsContainer: {
    marginBottom: 24,
    paddingTop: 8,
  },
  recommendationsHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  recommendationsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  recommendationsTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  recommendationsSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  paramPillsRow: {
    marginBottom: 14,
  },
  paramPillsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  paramPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#16181D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  paramPillActive: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  paramPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  paramPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  recCardsRow: {
    marginBottom: 4,
  },
  recCardsContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  recCard: {
    width: 170,
    backgroundColor: '#16181D',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  recCoverWrapper: {
    width: '100%',
    height: 180,
    backgroundColor: '#1E293B',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recCoverImg: {
    width: '100%',
    height: '100%',
  },
  recCoverPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#1C1917',
  },
  recCoverPlaceholderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
    textAlign: 'center',
    marginTop: 8,
  },
  recBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  recBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FCD34D',
  },
  recInfo: {
    padding: 10,
  },
  recBookTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  recBookAuthor: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  recReason: {
    fontSize: 10,
    color: '#D1D5DB',
    lineHeight: 14,
  },
});
