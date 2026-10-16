import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Platform, Text, ScrollView, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { BookContentService, PageContent } from '@/services/parsers/bookContentService';
import { PaperThemeId, PAPER_THEMES } from './ReaderThemeModal';

const WebViewComponent: any = WebView;

interface SelectionCoords {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EPUBReaderViewProps {
  bookTitle: string;
  fileUri?: string;
  theme: PaperThemeId | 'light' | 'sepia' | 'dark';
  fontSize: number;
  fontFamily?: 'serif' | 'sans' | 'mono';
  gutterShadowEnabled?: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number, totalPages: number) => void;
  onTextSelected?: (text: string, coords?: SelectionCoords | null) => void;
  onClearSelection?: () => void;
}

export const EPUBReaderView: React.FC<EPUBReaderViewProps> = ({
  bookTitle,
  fileUri,
  theme,
  fontSize,
  fontFamily = 'serif',
  gutterShadowEnabled = true,
  currentPage,
  totalPages,
  onPageChange,
  onTextSelected,
  onClearSelection,
}) => {
  const webViewRef = useRef<WebView>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const [pageData, setPageData] = useState<PageContent>({
    chapterBadge: `PAGE ${currentPage}`,
    chapterTitle: bookTitle,
    paragraphs: ['Loading page content...'],
    isAuthentic: false,
  });

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

  // Fetch dynamic page content whenever page, book, or fileUri changes
  useEffect(() => {
    let isCurrent = true;
    BookContentService.getPageContent(bookTitle, fileUri, currentPage, totalPages).then((content) => {
      if (isCurrent) {
        setPageData(content);
        // Scroll smoothly back to top when advancing page
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: true });
        }
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [bookTitle, fileUri, currentPage, totalPages]);

  // Web keyboard arrow navigation (Left/Right)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (currentPage < totalPages) {
          onPageChange(currentPage + 1, totalPages);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (currentPage > 1) {
          onPageChange(currentPage - 1, totalPages);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentPage, totalPages, onPageChange]);

  // Web text selection handler
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

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SELECTION') {
        if (onTextSelected) {
          onTextSelected(data.text, data.rect);
        }
      } else if (data.type === 'CLEAR_SELECTION') {
        if (onClearSelection) {
          onClearSelection();
        }
      }
    } catch {
      // Non-JSON message, ignore
    }
  };

  const paragraphsHtml = pageData.paragraphs
    .map((p) => `<p>${p}</p>`)
    .join('');

  const quoteHtml = pageData.quote
    ? `<blockquote>"${pageData.quote}"</blockquote>`
    : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          * {
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
          }
          body {
            background-color: ${themeColors.bg};
            color: ${themeColors.text};
            font-family: ${fontCss};
            font-size: ${fontSize}px;
            line-height: 1.75;
            padding: 24px 22px 80px 22px;
            margin: 0;
            user-select: text;
            -webkit-user-select: text;
          }
          ::selection {
            background-color: #FDE047;
            color: #1C1917;
          }
          .chapter-number {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            color: ${themeColors.accent};
            margin-bottom: 6px;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          }
          h2 {
            font-family: ${fontCss};
            font-size: ${fontSize * 1.35}px;
            font-weight: 700;
            color: ${themeColors.heading};
            letter-spacing: -0.02em;
            margin-bottom: 20px;
          }
          p {
            margin-bottom: 20px;
            text-align: justify;
            text-justify: inter-word;
          }
          blockquote {
            margin: 24px 0;
            padding: 14px 18px;
            background-color: ${themeColors.quoteBg};
            border-left: 3px solid ${themeColors.accent};
            border-radius: 4px;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <div class="chapter-number">${pageData.chapterBadge}</div>
        <h2>${pageData.chapterTitle}</h2>
        ${paragraphsHtml}
        ${quoteHtml}

        <script>
          window.scrollTo(0, 0);
          let lastDispatchedText = '';

          function checkSelection() {
            const sel = window.getSelection();
            const text = sel ? sel.toString().trim() : '';

            if (text.length > 0 && text !== lastDispatchedText) {
              lastDispatchedText = text;
              try {
                const range = sel.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                const payload = JSON.stringify({
                  type: 'SELECTION',
                  text: text,
                  rect: {
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height
                  }
                });
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(payload);
                }
              } catch (e) {}
            } else if (text.length === 0 && lastDispatchedText.length > 0) {
              lastDispatchedText = '';
              const clearPayload = JSON.stringify({ type: 'CLEAR_SELECTION' });
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(clearPayload);
              }
            }
          }

          document.addEventListener('mouseup', checkSelection);
          document.addEventListener('touchend', checkSelection);
          document.addEventListener('selectionchange', () => {
            setTimeout(checkSelection, 80);
          });
        </script>
      </body>
    </html>
  `;

  if (Platform.OS === 'web') {
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
        <ScrollView
          ref={scrollViewRef}
          style={[styles.container, { backgroundColor: 'transparent' }]}
          contentContainerStyle={styles.webContentContainer}
        >
          <Text style={[styles.chapterBadge, { color: themeColors.accent }]}>
            {pageData.chapterBadge}
          </Text>
          <Text
            style={[
              styles.webHeading,
              fontStyle,
              { color: themeColors.heading, fontSize: fontSize * 1.35 },
            ]}
          >
            {pageData.chapterTitle}
          </Text>

          {pageData.paragraphs.map((p, index) => (
            <Text
              key={index}
              style={[
                styles.webParagraph,
                fontStyle,
                { color: themeColors.text, fontSize, lineHeight: fontSize * 1.75 },
              ]}
              selectable={true}
            >
              {p}
            </Text>
          ))}

          {Boolean(pageData.quote) && (
            <View
              style={[
                styles.webQuoteCard,
                { backgroundColor: themeColors.quoteBg, borderLeftColor: themeColors.accent },
              ]}
            >
              <Text
                style={[
                  styles.webQuoteText,
                  fontStyle,
                  { color: themeColors.text, fontSize: fontSize * 0.95, lineHeight: fontSize * 1.6 },
                ]}
                selectable={true}
              >
                "{pageData.quote}"
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {gutterShadowEnabled && (
        <View
          style={[styles.gutterShadow, { backgroundColor: 'rgba(0, 0, 0, 0.05)' }]}
          pointerEvents="none"
        />
      )}
      <WebViewComponent
        ref={webViewRef}
        key={`reader-page-${currentPage}`}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={[styles.webview, { backgroundColor: themeColors.bg }]}
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
        onMessage={handleWebViewMessage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  webview: {
    flex: 1,
  },
  webContentContainer: {
    paddingHorizontal: 28,
    paddingVertical: 32,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  chapterBadge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  webHeading: {
    fontWeight: '700',
    marginBottom: 22,
    letterSpacing: -0.5,
  },
  webParagraph: {
    marginBottom: 22,
    fontFamily: Platform.select({
      web: '"Charter", "Georgia", "Newsreader", serif',
      default: 'serif',
    }),
  },
  webQuoteCard: {
    marginVertical: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderLeftWidth: 3,
    borderRadius: 6,
  },
  webQuoteText: {
    fontStyle: 'italic',
    fontFamily: Platform.select({
      web: '"Charter", "Georgia", "Newsreader", serif',
      default: 'serif',
    }),
  },
});
