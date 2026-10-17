import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Platform, Dimensions, Pressable } from 'react-native';
import {
  AlertCircle,
  BookOpen,
  Upload,
  Highlighter,
  Sparkles,
  X,
} from 'lucide-react-native';
import { BookContentService, PageContent } from '@/services/parsers/bookContentService';
import { SAFStorageService } from '@/services/storage/safStorage.web';
import { BookRepository } from '@/services/database/bookRepository';
import { PDFMetadataService } from '@/services/parsers/pdfMetadata';
import { PaperThemeId, PAPER_THEMES } from './ReaderThemeModal';
import { HorizontalScroll } from '@/components/ui/HorizontalScroll';

interface PDFReaderViewProps {
  fileUri: string;
  currentPage: number;
  totalPages?: number;
  onPageChange: (page: number, totalPages: number) => void;
  onLoadComplete?: (totalPages: number) => void;
  onTextSelected?: (text: string, coords?: any) => void;
  onClearSelection?: () => void;
  onPageTextExtracted?: (text: string) => void;
  bookTitle?: string;
  fileName?: string;
  bookId?: string;
  theme?: PaperThemeId | 'light' | 'sepia' | 'dark';
  fontSize?: number;
  fontFamily?: 'serif' | 'sans' | 'mono';
  gutterShadowEnabled?: boolean;
}

export const PDFReaderView: React.FC<PDFReaderViewProps> = ({
  fileUri,
  currentPage,
  totalPages = 1,
  onPageChange,
  onLoadComplete,
  onTextSelected,
  onClearSelection,
  onPageTextExtracted,
  bookTitle = 'PDF Document',
  fileName,
  bookId,
  theme = 'sepia',
  fontSize = 18,
  fontFamily = 'serif',
  gutterShadowEnabled = true,
}) => {
  // Toggle between authentic Original PDF View and Clean Reader View (default to document for PDFs)
  const [viewMode, setViewMode] = useState<'reader' | 'document'>('document');
  const [showTextDrawer, setShowTextDrawer] = useState<boolean>(false);
  const [pageData, setPageData] = useState<PageContent | null>(null);
  const [liveUri, setLiveUri] = useState<string>(fileUri);
  const [isUriValid, setIsUriValid] = useState<boolean>(true);
  const [pdfTotalPages, setPdfTotalPages] = useState<number>(totalPages > 1 ? totalPages : 1);

  // Web text selection listener for both Clean Reader and Text Drawer
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const handleWebSelection = () => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';

      if (text.length > 0 && onTextSelected) {
        try {
          const range = sel!.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          onTextSelected(text, {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          });
        } catch {
          onTextSelected(text, null);
        }
      } else if (text.length === 0 && onClearSelection) {
        onClearSelection();
      }
    };

    document.addEventListener('mouseup', handleWebSelection);
    document.addEventListener('touchend', handleWebSelection);

    return () => {
      document.removeEventListener('mouseup', handleWebSelection);
      document.removeEventListener('touchend', handleWebSelection);
    };
  }, [onTextSelected, onClearSelection]);

  // Sync pdfTotalPages if incoming totalPages prop is higher/valid
  useEffect(() => {
    if (totalPages && totalPages > 1) {
      setPdfTotalPages(totalPages);
    }
  }, [totalPages]);

  const onLoadCompleteRef = useRef(onLoadComplete);
  onLoadCompleteRef.current = onLoadComplete;
  const onPageTextExtractedRef = useRef(onPageTextExtracted);
  onPageTextExtractedRef.current = onPageTextExtracted;
  const extractedUriRef = useRef<string | null>(null);

  // Escape closes the text drawer, matching how desktop readers dismiss panels
  useEffect(() => {
    if (Platform.OS !== 'web' || !showTextDrawer || typeof document === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTextDrawer(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showTextDrawer]);

  // Dynamically extract the authentic PDF total page count from the file (once per URI)
  useEffect(() => {
    if (!liveUri || extractedUriRef.current === liveUri) return;
    extractedUriRef.current = liveUri;

    let active = true;
    PDFMetadataService.getPdfPageCount(liveUri, fileName || bookTitle).then((realCount) => {
      if (active && realCount > 0) {
        setPdfTotalPages(realCount);
        if (onLoadCompleteRef.current) {
          onLoadCompleteRef.current(realCount);
        }
        if (bookId) {
          BookRepository.updateBookTotalPages(bookId, realCount).catch(() => {});
        }
      }
    });

    return () => {
      active = false;
    };
  }, [liveUri, fileName, bookTitle, bookId]);

  // Resolve live URI from IndexedDB if blob expired across page reloads
  useEffect(() => {
    let active = true;
    SAFStorageService.getLiveFileUri(fileName || bookTitle, fileUri, bookTitle, bookId).then((resolved) => {
      if (!active) return;
      setLiveUri(resolved);
      const usable = SAFStorageService.isLiveFileUri(resolved);
      setIsUriValid(usable);
      // Persist a URI that was just revived from IndexedDB so the next reload
      // has a name to look it up with.
      if (usable && resolved.startsWith('blob:') && bookId && resolved !== fileUri) {
        BookRepository.updateBookFileUri(bookId, resolved, fileName).catch(() => {});
      }
    });
    return () => {
      active = false;
    };
  }, [fileUri, bookTitle, fileName, bookId]);

  const handleRelinkPdf = async () => {
    try {
      const picked = await SAFStorageService.pickBookFiles();
      if (picked.length > 0) {
        const fresh = picked[0];
        setLiveUri(fresh.fileUri);
        setIsUriValid(true);
        setViewMode('document');
        if (fresh.fileObj) {
          await SAFStorageService.persistBookFile(fresh.fileName, fresh.fileObj, bookId);
        }
        if (bookId) {
          await BookRepository.updateBookFileUri(bookId, fresh.fileUri, fresh.fileName);
        }
      }
    } catch (e) {
      console.warn('Could not re-link PDF file:', e);
    }
  };

  useEffect(() => {
    let isCurrent = true;
    setPageData(null);
    BookContentService.getPageContent(bookTitle, liveUri, currentPage, pdfTotalPages)
      .then((data) => {
        if (!isCurrent) return;
        setPageData(data);
        onPageTextExtractedRef.current?.(data.isAuthentic ? data.paragraphs.join('\n\n') : '');
      })
      .catch(() => {
        if (isCurrent) setPageData(null);
      });
    return () => {
      isCurrent = false;
    };
  }, [liveUri, currentPage, bookTitle, pdfTotalPages]);

  const normalizedThemeKey: PaperThemeId =
    theme === 'light' ? 'parchment' : theme === 'dark' ? 'obsidian' : (theme as PaperThemeId);

  const themeColors = PAPER_THEMES[normalizedThemeKey] || PAPER_THEMES.parchment;

  const fontCss =
    fontFamily === 'sans'
      ? '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif'
      : fontFamily === 'mono'
      ? '"JetBrains Mono", "Courier New", monospace'
      : '"Charter", "Georgia", "Newsreader", serif';

  const fontStyle = {
    fontFamily: Platform.select({
      web: fontCss,
      default: fontFamily === 'mono' ? 'monospace' : fontFamily === 'sans' ? 'sans-serif' : 'serif',
    }),
  };

  const hasNativePdfEmbed = liveUri.startsWith('http') || liveUri.startsWith('blob:');

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      {gutterShadowEnabled && (
        <View
          style={[
            styles.gutterShadow,
            { background: themeColors.gutterShadow } as any,
          ]}
          pointerEvents="none"
        />
      )}
      {hasNativePdfEmbed && (
        <HorizontalScroll
          style={styles.tabBarScroll}
          contentContainerStyle={styles.tabBar}
        >
          <TouchableOpacity
            style={[styles.tabBtn, viewMode === 'document' && styles.activeTabBtn]}
            onPress={() => setViewMode('document')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, viewMode === 'document' && styles.activeTabText]}>
              Original PDF View
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, viewMode === 'reader' && styles.activeTabBtn]}
            onPress={() => setViewMode('reader')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, viewMode === 'reader' && styles.activeTabText]}>
              Clean Reader View
            </Text>
          </TouchableOpacity>
        </HorizontalScroll>
      )}

      {viewMode === 'document' && hasNativePdfEmbed ? (
        isUriValid ? (
          <View style={styles.documentViewportContainer}>
            <iframe
              key={`pdf-viewport-${liveUri}-${currentPage}`}
              src={`${liveUri}#page=${currentPage}&zoom=page-fit&pagemode=none&toolbar=0&navpanes=0&statusbar=0&scrollbars=0`}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              title={bookTitle}
            />

            {/* Page navigation and audio live in the reader chrome; this bar only
                carries the per-page text panel, which has no other home. */}
            <View style={styles.pdfOverlayBar} pointerEvents="box-none">
              {/* Text & Tooltip Drawer Toggle on Original PDF */}
              <TouchableOpacity
                style={[styles.pdfActionBtn, showTextDrawer && styles.pdfActionBtnActive]}
                onPress={() => setShowTextDrawer(!showTextDrawer)}
                activeOpacity={0.8}
              >
                <Highlighter size={14} color="#D84A6A" style={{ marginRight: 5 }} />
                <Text style={styles.pdfActionBtnText}>
                  {showTextDrawer ? 'Close Text' : 'Text & Notes'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Floating Page Text & Tooltip Drawer */}
            {showTextDrawer && (
              <Pressable style={styles.drawerScrim} onPress={() => setShowTextDrawer(false)}>
              <View style={styles.pdfTextDrawer} pointerEvents="auto">
                <View style={styles.drawerHeader}>
                  <View style={styles.drawerHeaderLeft}>
                    <Sparkles size={15} color="#D84A6A" style={{ marginRight: 6 }} />
                    <Text style={styles.drawerTitle}>
                      Page {currentPage} Text & Selection
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowTextDrawer(false)}
                    style={styles.drawerCloseBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.drawerHint}>
                  Highlight any text below to trigger notes, dictionary meaning, or ask AI:
                </Text>

                <ScrollView style={styles.drawerScroll} showsVerticalScrollIndicator={false}>
                  {pageData && pageData.paragraphs.length > 0 ? (
                    pageData.paragraphs.map((p, idx) => (
                      <View key={idx} style={styles.drawerParagraphWrapper}>
                        <View style={styles.paraBadgeRow}>
                          <Text style={styles.paraBadge}>¶ {idx + 1}</Text>
                          <TouchableOpacity
                            onPress={() => {
                              if (onTextSelected) {
                                onTextSelected(p, null);
                              }
                            }}
                            style={styles.selectParaBtn}
                          >
                            <Text style={styles.selectParaText}>Select ¶</Text>
                          </TouchableOpacity>
                        </View>
                        <Text
                          style={[styles.drawerParagraph, fontStyle, { color: themeColors.text }]}
                          selectable={true}
                        >
                          {p}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.drawerEmptyText}>
                      Extracting page text...
                    </Text>
                  )}
                </ScrollView>
              </View>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.expiredNoticeCard}>
            <AlertCircle size={32} color="#D97706" style={{ marginBottom: 12 }} />
            <Text style={styles.expiredNoticeTitle}>Original PDF Cache Expired</Text>
            <Text style={styles.expiredNoticeText}>
              The browser flushed temporary blob memory upon page reload. Your bookmarks, notes, and reading progress remain intact.
            </Text>
            <TouchableOpacity
              onPress={handleRelinkPdf}
              style={[styles.switchModeBtn, { backgroundColor: '#D84A6A', marginBottom: 10 }]}
              activeOpacity={0.8}
            >
              <Upload size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.switchModeBtnText}>Re-link Original PDF File</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setViewMode('reader')}
              style={[styles.switchModeBtn, { backgroundColor: '#27272A' }]}
              activeOpacity={0.8}
            >
              <BookOpen size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.switchModeBtnText}>Read in Clean Reader View</Text>
            </TouchableOpacity>
          </View>
        )
      ) : (
        <ScrollView
          style={[styles.container, { backgroundColor: 'transparent' }]}
          contentContainerStyle={styles.readerScroll}
        >
          {pageData ? (
            <View style={styles.textContent}>
              <Text style={[styles.chapterBadge, { color: themeColors.accent }]}>
                {pageData.chapterBadge}
              </Text>
              <Text
                style={[
                  styles.chapterTitle,
                  fontStyle,
                  { color: themeColors.heading, fontSize: fontSize * 1.3 },
                ]}
              >
                {pageData.chapterTitle}
              </Text>

              {pageData.paragraphs.map((p, idx) => (
                <Text
                  key={idx}
                  style={[
                    styles.paragraph,
                    fontStyle,
                    { color: themeColors.text, fontSize, lineHeight: fontSize * 1.7 },
                  ]}
                  selectable={true}
                >
                  {p}
                </Text>
              ))}

              {Boolean(pageData.quote) && (
                <View style={[styles.quoteCard, { backgroundColor: themeColors.quoteBg, borderLeftColor: themeColors.accent }]}>
                  <Text style={[styles.quoteText, fontStyle, { color: themeColors.text, fontSize: fontSize * 0.95 }]}>
                    "{pageData.quote}"
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={{ color: themeColors.text }}>Loading page {currentPage}...</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  gutterShadow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 22,
    zIndex: 10,
  },
  tabBarScroll: {
    flexGrow: 0,
    maxHeight: 46,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    zIndex: 10,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 6,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  activeTabBtn: {
    backgroundColor: '#1C1917',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FAF7F2',
  },
  readerScroll: {
    paddingHorizontal: 28,
    paddingVertical: 32,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  textContent: {
    width: '100%',
  },
  chapterBadge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  chapterTitle: {
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: -0.4,
  },
  paragraph: {
    marginBottom: 20,
    fontFamily: Platform.select({
      web: '"Charter", "Georgia", "Newsreader", serif',
      default: 'serif',
    }),
  },
  quoteCard: {
    marginVertical: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderLeftWidth: 3,
    borderRadius: 6,
  },
  quoteText: {
    fontStyle: 'italic',
    lineHeight: 24,
  },
  expiredNoticeCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    maxWidth: 480,
    alignSelf: 'center',
    textAlign: 'center',
  },
  expiredNoticeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1917',
    marginBottom: 8,
    textAlign: 'center',
  },
  expiredNoticeText: {
    fontSize: 13,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  switchModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1917',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  switchModeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FAF7F2',
  },
  documentViewportContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  pdfOverlayBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
  },
  pdfActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 19, 24, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  pdfActionBtnActive: {
    borderColor: '#D84A6A',
    backgroundColor: 'rgba(40, 22, 30, 0.96)',
  },
  pdfActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  drawerScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 109,
  },
  pdfTextDrawer: {
    position: 'absolute',
    top: 12,
    right: 12,
    bottom: 64,
    width: Math.min(420, Dimensions.get('window').width - 24),
    backgroundColor: 'rgba(18, 19, 24, 0.97)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(216, 74, 106, 0.35)',
    padding: 16,
    zIndex: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  drawerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  drawerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  drawerCloseBtn: {
    padding: 4,
  },
  drawerHint: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 12,
    lineHeight: 16,
  },
  drawerScroll: {
    flex: 1,
  },
  drawerParagraphWrapper: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  paraBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  paraBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
  },
  selectParaBtn: {
    backgroundColor: 'rgba(216, 74, 106, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selectParaText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F472B6',
  },
  drawerParagraph: {
    fontSize: 13,
    lineHeight: 20,
  },
  drawerEmptyText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
});
