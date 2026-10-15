import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Pdf from 'react-native-pdf';
import {
  ChevronLeft,
  ChevronRight,
  Headphones,
  Highlighter,
  Sparkles,
  X,
} from 'lucide-react-native';
import { BookContentService, PageContent } from '@/services/parsers/bookContentService';
import { PaperThemeId } from './ReaderThemeModal';

const PdfComponent: any = Pdf;

interface PDFReaderViewProps {
  fileUri: string;
  currentPage: number;
  totalPages?: number;
  onPageChange: (page: number, totalPages: number) => void;
  onLoadComplete?: (totalPages: number) => void;
  onTextSelected?: (text: string, coords?: any) => void;
  onClearSelection?: () => void;
  onOpenAudioStudio?: () => void;
  onPageTextExtracted?: (text: string) => void;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  onJumpToPage?: (page: number) => void;
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
  onOpenAudioStudio,
  onPageTextExtracted,
  onNextPage,
  onPrevPage,
  bookTitle = 'PDF Document',
  theme = 'sepia',
  fontSize = 18,
}) => {
  const [showTextDrawer, setShowTextDrawer] = useState(false);
  const [pageData, setPageData] = useState<PageContent | null>(null);

  const source = {
    uri: fileUri,
    cache: true,
  };

  useEffect(() => {
    let isCurrent = true;
    setPageData(null);
    BookContentService.getPageContent(bookTitle, fileUri, currentPage, totalPages || 1).then((data) => {
      if (isCurrent) {
        setPageData(data);
        if (onPageTextExtracted && data?.paragraphs?.length) {
          onPageTextExtracted(data.paragraphs.join('\n\n'));
        }
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [fileUri, currentPage, bookTitle, totalPages, onPageTextExtracted]);

  return (
    <View style={styles.container}>
      <PdfComponent
        source={source}
        page={currentPage}
        horizontal={false}
        enablePaging={true}
        onLoadComplete={(numberOfPages: number) => {
          if (onLoadComplete) onLoadComplete(numberOfPages);
          onPageChange(currentPage || 1, numberOfPages);
        }}
        onPageChanged={(page: number, numberOfPages: number) => {
          onPageChange(page, numberOfPages);
        }}
        onError={(error: any) => {
          console.warn('PDF view error:', error);
        }}
        style={styles.pdf}
        activityIndicator={<ActivityIndicator size="large" color="#D84A6A" />}
      />

      {/* Floating Original PDF Companion HUD */}
      <View style={styles.pdfOverlayBar} pointerEvents="box-none">
        {/* Page Number & Navigation Pill */}
        <View style={styles.pdfPagePill} pointerEvents="auto">
          <TouchableOpacity
            onPress={onPrevPage}
            disabled={currentPage <= 1}
            style={[styles.pdfStepBtn, currentPage <= 1 && styles.pdfStepBtnDisabled]}
          >
            <ChevronLeft size={16} color={currentPage <= 1 ? '#6B7280' : '#FFFFFF'} />
          </TouchableOpacity>

          <Text style={styles.pdfPageText}>
            Page {currentPage} of {totalPages || 1}
          </Text>

          <TouchableOpacity
            onPress={onNextPage}
            disabled={currentPage >= (totalPages || 1)}
            style={[styles.pdfStepBtn, currentPage >= (totalPages || 1) && styles.pdfStepBtnDisabled]}
          >
            <ChevronRight size={16} color={currentPage >= (totalPages || 1) ? '#6B7280' : '#FFFFFF'} />
          </TouchableOpacity>
        </View>

        {/* TTS / Listen Button on Original PDF */}
        <TouchableOpacity
          style={styles.pdfActionBtn}
          onPress={onOpenAudioStudio}
          activeOpacity={0.8}
        >
          <Headphones size={14} color="#F59E0B" style={{ marginRight: 5 }} />
          <Text style={styles.pdfActionBtnText}>Listen</Text>
        </TouchableOpacity>

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
            Highlight or select any text below to trigger notes, dictionary meaning, or ask AI:
          </Text>

          <ScrollView style={styles.drawerScroll} showsVerticalScrollIndicator={true}>
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
                  <Text style={styles.drawerParagraph} selectable={true}>
                    {p}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.drawerEmptyText}>Extracting page text...</Text>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#FAF8F5',
  },
  pdf: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
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
  pdfPagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 19, 24, 0.94)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  pdfStepBtn: {
    padding: 4,
    borderRadius: 12,
  },
  pdfStepBtnDisabled: {
    opacity: 0.3,
  },
  pdfPageText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginHorizontal: 8,
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
    color: '#FFFFFF',
  },
  drawerEmptyText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
});
