import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { X, BookOpen, CheckCircle2, ChevronRight, Bookmark } from 'lucide-react-native';
import { BookContentService, TableOfContentsItem } from '@/services/parsers/bookContentService';

interface TableOfContentsModalProps {
  visible: boolean;
  bookTitle: string;
  fileUri?: string;
  currentPage: number;
  totalPages: number;
  onClose: () => void;
  onSelectPage: (pageNumber: number) => void;
}

export const TableOfContentsModal: React.FC<TableOfContentsModalProps> = ({
  visible,
  bookTitle,
  fileUri,
  currentPage,
  totalPages,
  onClose,
  onSelectPage,
}) => {
  const [chapters, setChapters] = useState<TableOfContentsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      BookContentService.getTableOfContents(bookTitle, fileUri, totalPages).then((items) => {
        setChapters(items);
        setLoading(false);
      });
    }
  }, [visible, bookTitle, fileUri, totalPages]);

  const handleSelectChapter = (page: number) => {
    onSelectPage(page);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text style={styles.title}>Table of Contents</Text>
              <Text numberOfLines={1} style={styles.subtitle}>
                {bookTitle} • Currently on Page {currentPage}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#78716C" />
            </TouchableOpacity>
          </View>

          {/* Chapters List */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#D97706" />
              <Text style={styles.loadingText}>Reading chapter structure...</Text>
            </View>
          ) : chapters.length === 0 ? (
            <View style={styles.centerContainer}>
              <BookOpen size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No chapter breakdown detected.</Text>
            </View>
          ) : (
            <FlatList
              data={chapters}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item, index }) => {
                const nextItem = chapters[index + 1];
                const isCurrent =
                  currentPage >= item.pageNumber &&
                  (!nextItem || currentPage < nextItem.pageNumber);
                const isCompleted = nextItem && currentPage >= nextItem.pageNumber;

                return (
                  <TouchableOpacity
                    style={[styles.chapterCard, isCurrent && styles.activeChapterCard]}
                    onPress={() => handleSelectChapter(item.pageNumber)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.chapterLeft}>
                      <View style={styles.statusIndicator}>
                        {isCurrent ? (
                          <View style={styles.currentDot} />
                        ) : isCompleted ? (
                          <CheckCircle2 size={16} color="#10B981" />
                        ) : (
                          <Bookmark size={15} color="#A8A29E" />
                        )}
                      </View>

                      <View style={styles.chapterTextCol}>
                        <Text
                          numberOfLines={1}
                          style={[styles.chapterTitle, isCurrent && styles.activeTitle]}
                        >
                          {item.title}
                        </Text>
                        {Boolean(item.subtitle) && (
                          <Text numberOfLines={1} style={styles.chapterSubtitle}>
                            {item.subtitle}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.chapterRight}>
                      <View
                        style={[
                          styles.pageBadge,
                          isCurrent && { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pageBadgeText,
                            isCurrent && { color: '#B45309', fontWeight: '800' },
                          ]}
                        >
                          p. {item.pageNumber}
                        </Text>
                      </View>
                      <ChevronRight size={16} color={isCurrent ? '#D97706' : '#D1D5DB'} />
                    </View>
                  </TouchableOpacity>
                );
              }}
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#16181D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '85%',
    minHeight: '55%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    flexShrink: 0,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chapterCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#1F222A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeChapterCard: {
    backgroundColor: 'rgba(216, 74, 106, 0.16)',
    borderColor: '#D84A6A',
  },
  chapterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  statusIndicator: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  currentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D84A6A',
  },
  chapterTextCol: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  activeTitle: {
    color: '#D84A6A',
  },
  chapterSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  chapterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#16181D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pageBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
});
