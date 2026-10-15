import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Type,
  Maximize2,
  StickyNote,
  Search,
  List,
  Headphones,
  Sliders,
  Target,
  MoreVertical,
} from 'lucide-react-native';
import { TargetFocusHUD } from '@/components/reader/TargetFocusHUD';
import { ReaderOverflowModal } from '@/components/reader/ReaderOverflowModal';
import { NotificationReminderModal } from '@/components/stats/NotificationReminderModal';
import { BookWithProgress } from '@/types/book';
import { BookRepository } from '@/services/database/bookRepository';
import { useReadingStore } from '@/stores/useReadingStore';
import { AICompanionModal } from '@/components/ai/AICompanionModal';
import { NotesModal } from '@/components/notes/NotesModal';
import { TableOfContentsModal } from '@/components/reader/TableOfContentsModal';
import { BookSearchModal } from '@/components/reader/BookSearchModal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PDFMetadataService } from '@/services/parsers/pdfMetadata';
import { PDFReaderView } from '@/components/reader/PDFReaderView';
import { EPUBReaderView } from '@/components/reader/EPUBReaderView';
import { SelectionTooltip, SelectionCoords } from '@/components/reader/SelectionTooltip';
import { TextExtractorService } from '@/services/parsers/textExtractor';
import { BookContentService } from '@/services/parsers/bookContentService';
import { AudioStudioModal } from '@/components/reader/AudioStudioModal';
import { AudioMiniPlayer } from '@/components/reader/AudioMiniPlayer';
import { DictionaryModal } from '@/components/dictionary/DictionaryModal';
import { TTSService } from '@/services/audio/textToSpeechService';
import { AmbientService } from '@/services/audio/ambientAudioService';
import {
  ReaderThemeModal,
  PaperThemeId,
  PAPER_THEMES,
} from '@/components/reader/ReaderThemeModal';

type ReaderTheme = 'light' | 'sepia' | 'dark';

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [book, setBook] = useState<BookWithProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<PaperThemeId>('obsidian');
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans' | 'mono'>('serif');
  const [gutterShadowEnabled, setGutterShadowEnabled] = useState(true);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [fontSize, setFontSize] = useState<number>(18);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showTocModal, setShowTocModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showAudioStudio, setShowAudioStudio] = useState(false);
  const [showDictionaryModal, setShowDictionaryModal] = useState(false);
  const [dictionaryTerm, setDictionaryTerm] = useState('');
  const [currentPageText, setCurrentPageText] = useState('');

  // Selection & Tooltip state
  const [selectedText, setSelectedText] = useState('');
  const [selectionCoords, setSelectionCoords] = useState<SelectionCoords | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [initialNoteText, setInitialNoteText] = useState('');
  const [initialNoteColor, setInitialNoteColor] = useState('#FEF08A');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Daily Target HUD state
  const [dailyTargetMinutes, setDailyTargetMinutes] = useState(20);
  const [todayBaseMinutes, setTodayBaseMinutes] = useState(0);
  const [showTargetHUD, setShowTargetHUD] = useState(true);
  const [showOverflowModal, setShowOverflowModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  const {
    startReadingSession,
    updatePageProgress,
    endReadingSession,
    recordUserInteraction,
    tickActiveReadingSecond,
    activeReadingSeconds,
    currentPage,
    totalPages,
  } = useReadingStore();

  const loadBook = async (bookId: string) => {
    try {
      setLoading(true);
      const data = await BookRepository.getBookById(bookId);
      if (data) {
        setBook(data);
        startReadingSession(data);

        // For PDF books, extract the authentic page count and synchronize
        if (data.format === 'pdf') {
          PDFMetadataService.getPdfPageCount(data.fileUri, data.fileName || data.title).then(async (realPages) => {
            if (realPages > 0 && realPages !== data.totalPages) {
              setBook((prev) => (prev ? { ...prev, totalPages: realPages } : null));
              await BookRepository.updateBookTotalPages(data.id, realPages);
              await updatePageProgress(currentPage, undefined, realPages);
            }
          });
        }
      }
    } catch (err) {
      console.error('Failed to load book in reader:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadBook(id);
    }

    const loadGoalsAndToday = async () => {
      try {
        const [goals, actMap] = await Promise.all([
          BookRepository.getReadingGoals(),
          BookRepository.getReadingActivityMap(1),
        ]);
        setDailyTargetMinutes(goals.dailyMinutes || 20);
        const todayStr = new Date().toISOString().substring(0, 10);
        const todaySecs = actMap[todayStr]?.durationSeconds || 0;
        setTodayBaseMinutes(Math.round(todaySecs / 60));
      } catch (e) {
        console.warn('Failed to load goals for reader HUD:', e);
      }
    };
    loadGoalsAndToday();

    // 1-second cadence timer respecting idle activity
    const timer = setInterval(() => {
      tickActiveReadingSecond();
    }, 1000);

    return () => {
      clearInterval(timer);
      endReadingSession();
      TTSService.stop();
      AmbientService.stop();
    };
  }, [id, tickActiveReadingSecond, endReadingSession]);

  // Load current page text for Audio Studio (TTS narration)
  useEffect(() => {
    if (book) {
      setCurrentPageText('');
      const total = totalPages > 1 ? totalPages : 100;
      let active = true;
      BookContentService.getPageContent(book.title, book.fileUri, currentPage, total)
        .then((content) => {
          if (active) {
            const text = content.paragraphs.join('\n\n');
            setCurrentPageText(text);
          }
        })
        .catch(() => {
          if (active) {
            setCurrentPageText('');
          }
        });
      return () => {
        active = false;
      };
    }
  }, [book, currentPage, totalPages]);

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  const maxPages = totalPages > 0 ? totalPages : (book?.totalPages && book.totalPages > 0 ? book.totalPages : 1);

  const handleJumpToPage = useCallback(async (pageNumber: number) => {
    recordUserInteraction();
    const target = Math.max(1, Math.min(pageNumber, maxPages));
    await updatePageProgress(target, undefined, maxPages);
    triggerToast(`Jumped to Page ${target}`);
  }, [maxPages, updatePageProgress, recordUserInteraction, triggerToast]);

  const handleNextPage = useCallback(async () => {
    recordUserInteraction();
    const next = Math.min(maxPages, currentPage + 1);
    await updatePageProgress(next, undefined, maxPages);
  }, [maxPages, currentPage, updatePageProgress, recordUserInteraction]);

  const handlePrevPage = useCallback(async () => {
    recordUserInteraction();
    const prev = Math.max(1, currentPage - 1);
    await updatePageProgress(prev, undefined, maxPages);
  }, [maxPages, currentPage, updatePageProgress, recordUserInteraction]);

  const handleTextSelected = useCallback((text: string, coords?: SelectionCoords | null) => {
    recordUserInteraction();
    setSelectedText(text);
    setSelectionCoords(coords || null);
    setIsTooltipVisible(true);
  }, [recordUserInteraction]);

  const handleClearSelection = useCallback(() => {
    setIsTooltipVisible(false);
    setSelectedText('');
  }, []);

  const handleAddNoteFromTooltip = (text: string, color: string) => {
    setIsTooltipVisible(false);
    setInitialNoteText(text);
    setInitialNoteColor(color);
    setShowNotesModal(true);
  };

  const handleHighlightOnly = async (text: string, color: string) => {
    setIsTooltipVisible(false);
    if (!book) return;
    try {
      const newNote = {
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        bookId: book.id,
        pageNumber: currentPage,
        location: `page_${currentPage}`,
        text: text.trim(),
        color,
        createdAt: new Date().toISOString(),
      };
      await BookRepository.saveNote(newNote);
      triggerToast('Highlight added to Notes ✓');
    } catch {
      triggerToast('Failed to save highlight');
    }
  };

  const handleAskAIFromTooltip = (text: string) => {
    setIsTooltipVisible(false);
    setShowAiModal(true);
  };

  const handleLookupMeaning = (text: string) => {
    setIsTooltipVisible(false);
    setDictionaryTerm(text.trim());
    setShowDictionaryModal(true);
  };

  const handleAddNoteWithDefinition = async (term: string, definition: string) => {
    if (!book) return;
    try {
      const newNote = {
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        bookId: book.id,
        pageNumber: currentPage,
        location: `page_${currentPage}`,
        text: term,
        note: definition,
        color: '#BFDBFE',
        createdAt: new Date().toISOString(),
      };
      await BookRepository.saveNote(newNote);
      triggerToast(`Saved "${term}" definition to Notes ✓`);
    } catch {
      triggerToast('Failed to save definition to Notes');
    }
  };

  const cycleTheme = () => {
    const themeKeys: PaperThemeId[] = ['parchment', 'sepia', 'nordic', 'obsidian', 'oled'];
    const nextIdx = (themeKeys.indexOf(theme) + 1) % themeKeys.length;
    setTheme(themeKeys[nextIdx]);
  };

  const cycleFontSize = () => {
    if (fontSize === 16) setFontSize(18);
    else if (fontSize === 18) setFontSize(22);
    else setFontSize(16);
  };

  const currentTheme = PAPER_THEMES[theme] || PAPER_THEMES.sepia;
  const effectiveTotalPages = totalPages > 0 ? totalPages : (book?.totalPages && book.totalPages > 0 ? book.totalPages : 1);
  const progressPercent = Math.min(100, Math.round((currentPage / effectiveTotalPages) * 100));

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: currentTheme.bg }]}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </SafeAreaView>
    );
  }

  if (!book) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: currentTheme.bg, padding: 24 }]}>
        <View style={{ alignItems: 'center', maxWidth: 360, gap: 16 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(239, 68, 68, 0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={28} color="#EF4444" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: currentTheme.text, textAlign: 'center' }}>
            Book Unavailable
          </Text>
          <Text style={{ fontSize: 14, color: currentTheme.secondaryText, textAlign: 'center', lineHeight: 20 }}>
            Could not open or locate this book file. The file may have been moved, deleted, or its storage access permission may have expired.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/')}
            activeOpacity={0.8}
            style={{
              marginTop: 8,
              backgroundColor: '#4F46E5',
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ArrowLeft size={18} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>
              Return to Library
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.bg }]} edges={['top', 'bottom']}>
      {/* Top Controls Bar */}
      <View
        style={[
          styles.header,
          { backgroundColor: currentTheme.headerBg, borderBottomColor: currentTheme.headerBorder },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
          style={styles.headerBtn}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color={currentTheme.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.titleWrapper}
          onPress={() => setShowTocModal(true)}
          activeOpacity={0.7}
        >
          <Text numberOfLines={1} style={[styles.bookTitle, { color: currentTheme.text }]}>
            {book.title}
          </Text>
          <Text style={[styles.pageIndicator, { color: currentTheme.secondaryText }]}>
            Page {currentPage} of {effectiveTotalPages} • {progressPercent}%
          </Text>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          {/* Typography, Paper Themes & Font Size */}
          <TouchableOpacity
            onPress={() => setShowThemeModal(true)}
            style={styles.headerBtn}
            activeOpacity={0.7}
            accessibilityLabel="Typography & Themes"
          >
            <Sliders size={18} color={currentTheme.text} />
          </TouchableOpacity>

          {/* Audio & Ambience Studio Trigger */}
          <TouchableOpacity
            onPress={() => setShowAudioStudio(true)}
            style={styles.headerBtn}
            activeOpacity={0.7}
            accessibilityLabel="Audio & Ambience Studio"
          >
            <Headphones size={18} color="#D97706" />
          </TouchableOpacity>

          {/* More Actions Overflow Menu */}
          <TouchableOpacity
            onPress={() => setShowOverflowModal(true)}
            style={styles.headerBtn}
            activeOpacity={0.7}
            accessibilityLabel="More options"
          >
            <MoreVertical size={19} color={currentTheme.text} />
          </TouchableOpacity>

          {/* AI Companion Trigger */}
          <TouchableOpacity
            onPress={() => setShowAiModal(true)}
            style={styles.aiTriggerBtn}
            activeOpacity={0.8}
            accessibilityLabel="AI Companion"
          >
            <Sparkles size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Real-Time Daily Hourly Target HUD */}
      {showTargetHUD && (
        <TargetFocusHUD
          dailyTargetMinutes={dailyTargetMinutes}
          todayBaseMinutes={todayBaseMinutes}
          onClose={() => setShowTargetHUD(false)}
        />
      )}

      {/* Reader Page Viewport */}
      {book.format === 'pdf' ? (
        <PDFReaderView
          fileUri={book.fileUri}
          currentPage={currentPage}
          bookTitle={book.title}
          fileName={book.fileName}
          bookId={book.id}
          theme={theme}
          fontSize={fontSize}
          fontFamily={fontFamily}
          gutterShadowEnabled={gutterShadowEnabled}
          totalPages={effectiveTotalPages}
          onPageChange={(page, total) => {
            updatePageProgress(page, undefined, total || effectiveTotalPages);
          }}
          onLoadComplete={(total) => {
            if (total && total > 0 && book) {
              setBook((prev) => (prev ? { ...prev, totalPages: total } : null));
              BookRepository.updateBookTotalPages(book.id, total).catch(() => {});
            }
            updatePageProgress(currentPage, undefined, total || effectiveTotalPages);
          }}
          onTextSelected={handleTextSelected}
          onClearSelection={handleClearSelection}
          onOpenAudioStudio={() => setShowAudioStudio(true)}
          onPageTextExtracted={(text) => {
            if (text && text.trim().length > 0) {
              setCurrentPageText(text);
            }
          }}
          onNextPage={handleNextPage}
          onPrevPage={handlePrevPage}
          onJumpToPage={handleJumpToPage}
        />
      ) : (
        <EPUBReaderView
          bookTitle={book.title}
          fileUri={book.fileUri}
          theme={theme}
          fontSize={fontSize}
          fontFamily={fontFamily}
          gutterShadowEnabled={gutterShadowEnabled}
          currentPage={currentPage}
          totalPages={effectiveTotalPages}
          onPageChange={(page, total) => {
            updatePageProgress(page, undefined, total || effectiveTotalPages);
          }}
          onTextSelected={handleTextSelected}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* Floating Selection Tooltip ("Add to Note", "Meaning", Quick Highlight, Ask AI) */}
      <SelectionTooltip
        visible={isTooltipVisible}
        selectedText={selectedText}
        coords={selectionCoords}
        onAddNote={handleAddNoteFromTooltip}
        onHighlightOnly={handleHighlightOnly}
        onLookupMeaning={handleLookupMeaning}
        onAskAI={handleAskAIFromTooltip}
        onDismiss={() => setIsTooltipVisible(false)}
      />

      {/* Floating Micro-Toast Notification */}
      {Boolean(toastMessage) && (
        <View style={styles.toastCard}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Bottom Navigation & Pagination Bar */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: currentTheme.headerBg, borderTopColor: currentTheme.headerBorder },
        ]}
      >
        <ProgressBar progress={progressPercent} color="#D84A6A" height={3} />

        <View style={styles.bottomControls}>
          <TouchableOpacity
            onPress={handlePrevPage}
            disabled={currentPage <= 1}
            style={[styles.pageStepBtn, currentPage <= 1 && styles.disabledBtn]}
          >
            <ChevronLeft size={22} color={currentPage <= 1 ? '#D1D5DB' : currentTheme.text} />
            <Text style={[styles.pageStepText, { color: currentPage <= 1 ? '#D1D5DB' : currentTheme.text }]}>
              Prev
            </Text>
          </TouchableOpacity>

          <Text style={[styles.bottomPageText, { color: currentTheme.secondaryText }]}>
            {currentPage} / {effectiveTotalPages}
          </Text>

          <TouchableOpacity
            onPress={handleNextPage}
            disabled={currentPage >= effectiveTotalPages}
            style={[styles.pageStepBtn, currentPage >= effectiveTotalPages && styles.disabledBtn]}
          >
            <Text
              style={[
                styles.pageStepText,
                { color: currentPage >= effectiveTotalPages ? '#D1D5DB' : currentTheme.text },
              ]}
            >
              Next
            </Text>
            <ChevronRight
              size={22}
              color={currentPage >= effectiveTotalPages ? '#D1D5DB' : currentTheme.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* AI Companion Modal */}
      <AICompanionModal
        visible={showAiModal}
        book={book}
        currentPage={currentPage}
        totalPages={effectiveTotalPages}
        onClose={() => setShowAiModal(false)}
      />

      {/* Notes & Highlights Modal */}
      <NotesModal
        visible={showNotesModal}
        bookId={book.id}
        bookTitle={book.title}
        currentPage={currentPage}
        initialHighlightText={initialNoteText}
        initialColor={initialNoteColor}
        onClose={() => {
          setShowNotesModal(false);
          setInitialNoteText('');
        }}
      />

      {/* Table of Contents Modal */}
      <TableOfContentsModal
        visible={showTocModal}
        bookTitle={book.title}
        fileUri={book.fileUri}
        currentPage={currentPage}
        totalPages={effectiveTotalPages}
        onClose={() => setShowTocModal(false)}
        onSelectPage={handleJumpToPage}
      />

      {/* In-Book Full-Text Search Modal */}
      <BookSearchModal
        visible={showSearchModal}
        bookTitle={book.title}
        fileUri={book.fileUri}
        totalPages={effectiveTotalPages}
        onClose={() => setShowSearchModal(false)}
        onSelectPage={handleJumpToPage}
      />

      {/* Floating Audio Mini-Player Pill */}
      <AudioMiniPlayer
        currentPage={currentPage}
        onOpenStudio={() => setShowAudioStudio(true)}
      />

      {/* Audio & Ambience Studio Modal */}
      <AudioStudioModal
        visible={showAudioStudio}
        onClose={() => setShowAudioStudio(false)}
        bookId={book.id}
        bookTitle={book.title}
        pageText={currentPageText}
        currentPage={currentPage}
        totalPages={effectiveTotalPages}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
        onJumpToPage={handleJumpToPage}
      />

      {/* Dictionary & Word Meaning Modal */}
      <DictionaryModal
        visible={showDictionaryModal}
        term={dictionaryTerm}
        bookTitle={book.title}
        currentPage={currentPage}
        onClose={() => setShowDictionaryModal(false)}
        onAddNoteWithDefinition={handleAddNoteWithDefinition}
        onAskAIContext={(term) => {
          setShowAiModal(true);
        }}
      />

      {/* Luxury Typography & Paper Themes Modal */}
      <ReaderThemeModal
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        currentTheme={theme}
        onSelectTheme={setTheme}
        fontSize={fontSize}
        onChangeFontSize={setFontSize}
        fontFamily={fontFamily}
        onChangeFontFamily={setFontFamily}
        gutterShadowEnabled={gutterShadowEnabled}
        onToggleGutterShadow={setGutterShadowEnabled}
      />

      {/* Reader Overflow Sheet */}
      <ReaderOverflowModal
        visible={showOverflowModal}
        onClose={() => setShowOverflowModal(false)}
        onOpenToc={() => setShowTocModal(true)}
        onOpenSearch={() => setShowSearchModal(true)}
        onOpenNotes={() => setShowNotesModal(true)}
        onOpenAudio={() => setShowAudioStudio(true)}
        onOpenTheme={() => setShowThemeModal(true)}
        onCycleTheme={cycleTheme}
        isDarkTheme={theme === 'obsidian' || theme === 'oled'}
        showTargetHUD={showTargetHUD}
        onToggleTargetHUD={() => setShowTargetHUD(!showTargetHUD)}
        onOpenReminders={() => setShowReminderModal(true)}
        dailyGoalText={`${todayBaseMinutes + Math.floor(activeReadingSeconds / 60)}m of ${dailyTargetMinutes >= 60 ? (dailyTargetMinutes / 60).toFixed(1) + ' hrs' : dailyTargetMinutes + 'm'} daily goal`}
      />

      {/* Target Reminder Notification Modal */}
      <NotificationReminderModal
        visible={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        dailyTargetMinutes={dailyTargetMinutes}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 48,
    maxHeight: 54,
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 6,
    borderRadius: 8,
  },
  titleWrapper: {
    flex: 1,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  pageIndicator: {
    fontSize: 10.5,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  aiTriggerBtn: {
    backgroundColor: '#D84A6A',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    shadowColor: '#D84A6A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  readerViewport: {
    flex: 1,
  },
  readerContent: {
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  chapterTitle: {
    fontWeight: '700',
    marginBottom: 20,
  },
  bookText: {
    marginBottom: 20,
    letterSpacing: 0.2,
  },
  bottomBar: {
    borderTopWidth: 1,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pageStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  pageStepText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bottomPageText: {
    fontSize: 12,
    fontWeight: '500',
  },
  toastCard: {
    position: 'absolute',
    bottom: 74,
    alignSelf: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 99999,
  },
  toastText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
});
