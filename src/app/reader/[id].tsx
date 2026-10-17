import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Sliders,
  MoreVertical,
  ChevronsUpDown,
} from 'lucide-react-native';
import { TargetFocusHUD } from '@/components/reader/TargetFocusHUD';
import { ReaderOverflowModal } from '@/components/reader/ReaderOverflowModal';
import { NotificationReminderModal } from '@/components/stats/NotificationReminderModal';
import { BookWithProgress, ReadingGoals } from '@/types/book';
import { BookRepository } from '@/services/database/bookRepository';
import { useReadingStore } from '@/stores/useReadingStore';
import { AICompanionModal } from '@/components/ai/AICompanionModal';
import { NotesModal } from '@/components/notes/NotesModal';
import { TableOfContentsModal } from '@/components/reader/TableOfContentsModal';
import { GoToPageModal } from '@/components/reader/GoToPageModal';
import { BookSearchModal } from '@/components/reader/BookSearchModal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PDFMetadataService } from '@/services/parsers/pdfMetadata';
import { PDFReaderView } from '@/components/reader/PDFReaderView';
import { EPUBReaderView } from '@/components/reader/EPUBReaderView';
import { SelectionTooltip, SelectionCoords } from '@/components/reader/SelectionTooltip';
import { BookContentService } from '@/services/parsers/bookContentService';
import { AudioStudioModal } from '@/components/reader/AudioStudioModal';
import { AudioMiniPlayer } from '@/components/reader/AudioMiniPlayer';
import { DictionaryModal } from '@/components/dictionary/DictionaryModal';
import { TTSService } from '@/services/audio/textToSpeechService';
import { AmbientService } from '@/services/audio/ambientAudioService';
import { ReadingNotificationService } from '@/services/notifications/readingNotificationService';
import {
  ReaderThemeModal,
  PaperThemeId,
  PAPER_THEMES,
} from '@/components/reader/ReaderThemeModal';

function formatGoalLabel(minutes: number): string {
  return minutes >= 60 ? `${(minutes / 60).toFixed(1)} hrs` : `${minutes}m`;
}

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
  const [showGoToModal, setShowGoToModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showAudioStudio, setShowAudioStudio] = useState(false);
  const [showDictionaryModal, setShowDictionaryModal] = useState(false);
  const [dictionaryTerm, setDictionaryTerm] = useState('');
  const [currentPageText, setCurrentPageText] = useState('');
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Selection & Tooltip state
  const [selectedText, setSelectedText] = useState('');
  const [selectionCoords, setSelectionCoords] = useState<SelectionCoords | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [initialNoteText, setInitialNoteText] = useState('');
  const [initialNoteColor, setInitialNoteColor] = useState('#FEF08A');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Daily Target HUD state
  const [goals, setGoals] = useState<ReadingGoals>({ dailyMinutes: 20, yearlyBooks: 12 });
  const [todayBaseSeconds, setTodayBaseSeconds] = useState(0);
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

        // Replace the guessed page count with the one the file really has,
        // otherwise the reader parks on page 1 for every book.
        const syncRealPageCount = async (realPages: number) => {
          if (realPages <= 0) return;
          setBook((prev) => (prev ? { ...prev, totalPages: realPages } : null));
          await updatePageProgress(currentPage, undefined, realPages);
          BookRepository.updateBookTotalPages(data.id, realPages).catch(() => {});
        };

        // Trust the file over the recorded format: a page count read from the
        // container works for EPUB and plain text, and PDFs fall through to the
        // metadata reader.
        const pageCount = (async () => {
          const fromContent = await BookContentService.countPages(data.title, data.fileUri);
          if (fromContent > 0) return fromContent;
          if (data.format === 'pdf') {
            return await PDFMetadataService.getPdfPageCount(data.fileUri, data.fileName || data.title);
          }
          return 0;
        })();

        pageCount.then(syncRealPageCount).catch(() => {});
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
        const [savedGoals, actMap, hudVisibility] = await Promise.all([
          BookRepository.getReadingGoals(),
          BookRepository.getReadingActivityMap(1),
          BookRepository.getSetting('target_hud_visible'),
        ]);
        setGoals(savedGoals);
        const todayStr = new Date().toISOString().substring(0, 10);
        setTodayBaseSeconds(actMap[todayStr]?.durationSeconds || 0);
        if (hudVisibility !== null) setShowTargetHUD(hudVisibility === 'true');
      } catch (e) {
        console.warn('Failed to load goals for reader HUD:', e);
      }
    };
    loadGoalsAndToday();

    const loadReadingPreferences = async () => {
      try {
        const [savedTheme, savedFont, savedSize, savedGutter] = await Promise.all([
          BookRepository.getSetting('reader_default_theme'),
          BookRepository.getSetting('reader_default_font'),
          BookRepository.getSetting('reader_default_font_size'),
          BookRepository.getSetting('reader_gutter_shadow'),
        ]);
        if (savedTheme && savedTheme in PAPER_THEMES) setTheme(savedTheme as PaperThemeId);
        if (savedFont === 'serif' || savedFont === 'sans' || savedFont === 'mono') {
          setFontFamily(savedFont);
        }
        const parsedSize = Number(savedSize);
        if (Number.isFinite(parsedSize) && parsedSize > 0) setFontSize(parsedSize);
        if (savedGutter !== null) setGutterShadowEnabled(savedGutter === 'true');
      } catch (e) {
        console.warn('Failed to load reading preferences:', e);
      } finally {
        setPrefsLoaded(true);
      }
    };
    loadReadingPreferences();

    // 1-second cadence timer respecting idle activity
    const timer = setInterval(() => {
      tickActiveReadingSecond();
    }, 1000);

    return () => {
      clearInterval(timer);
      endReadingSession()
        // Today's tally just changed, so the pending nudge needs new numbers
        // — or no nudge at all if the goal is now met.
        .then(() => ReadingNotificationService.scheduleDailyReminderDaemon())
        .catch(() => {});
      TTSService.stop();
      AmbientService.stop();
    };
  }, [id, tickActiveReadingSecond, endReadingSession]);

  // Typography choices are app-wide defaults (the same keys Settings edits),
  // so they are only written once the stored values have been read back.
  useEffect(() => {
    if (!prefsLoaded) return;
    BookRepository.setSetting('reader_default_theme', theme).catch(() => {});
    BookRepository.setSetting('reader_default_font', fontFamily).catch(() => {});
    BookRepository.setSetting('reader_default_font_size', String(fontSize)).catch(() => {});
    BookRepository.setSetting('reader_gutter_shadow', String(gutterShadowEnabled)).catch(() => {});
  }, [prefsLoaded, theme, fontFamily, fontSize, gutterShadowEnabled]);

  // Page text for TTS narration. PDFs supply their own extracted text through
  // PDFReaderView.onPageTextExtracted, so only EPUBs are fetched here.
  useEffect(() => {
    if (!book || book.format === 'pdf') return;
    setCurrentPageText('');
    const total = totalPages > 0 ? totalPages : (book.totalPages ?? 1);
    let active = true;
    BookContentService.getPageContent(book.title, book.fileUri, currentPage, total)
      .then((content) => {
        if (active) {
          setCurrentPageText(content.isAuthentic ? content.paragraphs.join('\n\n') : '');
        }
      })
      .catch(() => {
        if (active) setCurrentPageText('');
      });
    return () => {
      active = false;
    };
  }, [book, currentPage, totalPages]);

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  const handleSaveGoals = useCallback(async (next: ReadingGoals) => {
    setGoals(next);
    await BookRepository.saveReadingGoals(next);
    await ReadingNotificationService.scheduleDailyReminderDaemon();
  }, []);

  const persistHudVisibility = useCallback((visible: boolean) => {
    setShowTargetHUD(visible);
    BookRepository.setSetting('target_hud_visible', String(visible)).catch(() => {});
  }, []);

  const hideTargetHUD = useCallback(() => persistHudVisibility(false), [persistHudVisibility]);

  const effectiveTotalPages =
    totalPages > 0 ? totalPages : book?.totalPages && book.totalPages > 0 ? book.totalPages : 1;

  const handleJumpToPage = useCallback(async (pageNumber: number) => {
    recordUserInteraction();
    const target = Math.max(1, Math.min(pageNumber, effectiveTotalPages));
    await updatePageProgress(target, undefined, effectiveTotalPages);
    triggerToast(`Jumped to Page ${target}`);
  }, [effectiveTotalPages, updatePageProgress, recordUserInteraction, triggerToast]);

  const handleNextPage = useCallback(async () => {
    recordUserInteraction();
    const next = Math.min(effectiveTotalPages, currentPage + 1);
    await updatePageProgress(next, undefined, effectiveTotalPages);
  }, [effectiveTotalPages, currentPage, updatePageProgress, recordUserInteraction]);

  const handlePrevPage = useCallback(async () => {
    recordUserInteraction();
    const prev = Math.max(1, currentPage - 1);
    await updatePageProgress(prev, undefined, effectiveTotalPages);
  }, [effectiveTotalPages, currentPage, updatePageProgress, recordUserInteraction]);

  const handlePageChange = useCallback(
    (page: number, total?: number) => {
      updatePageProgress(page, undefined, total || effectiveTotalPages);
    },
    [updatePageProgress, effectiveTotalPages]
  );

  const handleLoadComplete = useCallback(
    (total?: number) => {
      if (!book) return;
      const nextTotal = total && total > 0 ? total : effectiveTotalPages;
      if (total && total > 0 && total !== book.totalPages) {
        setBook((prev) => (prev ? { ...prev, totalPages: total } : null));
        BookRepository.updateBookTotalPages(book.id, total).catch(() => {});
      }
      updatePageProgress(currentPage, undefined, nextTotal);
    },
    [book, effectiveTotalPages, currentPage, updatePageProgress]
  );

  const handlePageTextExtracted = useCallback((text: string) => {
    setCurrentPageText(text || '');
  }, []);

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

  const currentTheme = PAPER_THEMES[theme] || PAPER_THEMES.sepia;
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

        <View style={styles.titleWrapper}>
          <Text numberOfLines={1} style={[styles.bookTitle, { color: currentTheme.text }]}>
            {book.title}
          </Text>
          <Text style={[styles.pageIndicator, { color: currentTheme.secondaryText }]}>
            {progressPercent}% read
          </Text>
        </View>

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

      {/* Real-Time Daily Target HUD */}
      {showTargetHUD && (
        <TargetFocusHUD
          goals={goals}
          todayBaseSeconds={todayBaseSeconds}
          sessionElapsedSeconds={activeReadingSeconds}
          onSaveGoals={handleSaveGoals}
          onClose={hideTargetHUD}
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
          onPageChange={handlePageChange}
          onLoadComplete={handleLoadComplete}
          onTextSelected={handleTextSelected}
          onClearSelection={handleClearSelection}
          onPageTextExtracted={handlePageTextExtracted}
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
          onPageChange={handlePageChange}
          onLoadComplete={handleLoadComplete}
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

          <TouchableOpacity
            onPress={() => setShowGoToModal(true)}
            style={[styles.gotoPill, { borderColor: currentTheme.headerBorder }]}
            activeOpacity={0.75}
            accessibilityLabel="Go to page"
          >
            <Text style={[styles.bottomPageText, { color: currentTheme.text }]}>
              {currentPage} / {effectiveTotalPages}
            </Text>
            <ChevronsUpDown size={13} color={currentTheme.secondaryText} />
          </TouchableOpacity>

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

      {/* Go To Page Modal */}
      <GoToPageModal
        visible={showGoToModal}
        currentPage={currentPage}
        totalPages={effectiveTotalPages}
        onClose={() => setShowGoToModal(false)}
        onJump={handleJumpToPage}
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
        showTargetHUD={showTargetHUD}
        onToggleTargetHUD={() => persistHudVisibility(!showTargetHUD)}
        onOpenReminders={() => setShowReminderModal(true)}
        dailyGoalText={`${Math.floor(
          (todayBaseSeconds + activeReadingSeconds) / 60
        )}m of ${formatGoalLabel(goals.dailyMinutes)} daily goal`}
      />

      {/* Target Reminder Notification Modal */}
      <NotificationReminderModal
        visible={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        dailyTargetMinutes={goals.dailyMinutes}
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
  gotoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
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
