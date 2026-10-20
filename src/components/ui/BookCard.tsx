import { BookWithProgress } from '@/types/book';
import { Image } from 'expo-image';
import { Bookmark, CheckCircle2 } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProgressBar } from './ProgressBar';

interface BookCardProps {
  book: BookWithProgress;
  onPress: () => void;
  onAddToShelf?: () => void;
}

// Curated luxury book cover palette generated deterministically from book title
const COVER_THEMES = [
  { bg: '#1E293B', text: '#F8FAFC', accent: '#38BDF8', spine: '#0F172A', badge: '#0284C7' },
  { bg: '#1C1917', text: '#FDF4E3', accent: '#F59E0B', spine: '#0C0A09', badge: '#D97706' },
  { bg: '#1E3A5F', text: '#F0F9FF', accent: '#60A5FA', spine: '#0F2540', badge: '#2563EB' },
  { bg: '#064E3B', text: '#ECFDF5', accent: '#34D399', spine: '#022C22', badge: '#059669' },
  { bg: '#4C1D95', text: '#F5F3FF', accent: '#C084FC', spine: '#2E1065', badge: '#7C3AED' },
  { bg: '#701A75', text: '#FDF2F8', accent: '#F472B6', spine: '#4A044E', badge: '#DB2777' },
  { bg: '#312E81', text: '#EEF2FF', accent: '#818CF8', spine: '#1E1B4B', badge: '#4F46E5' },
  { bg: '#292524', text: '#FAF7F2', accent: '#D97706', spine: '#1C1917', badge: '#B45309' },
];

function getCoverTheme(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % COVER_THEMES.length;
  return COVER_THEMES[index];
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  onPress,
  onAddToShelf,
}) => {
  const percent = book.progress?.percentComplete ?? 0;
  const isFinished = percent >= 100;
  const isReading = percent > 0 && percent < 100;
  // The repository hands back titles that have already been through the cleaner; re-running it
  // here would only let one screen disagree with another about the same book.
  const displayTitle = book.title;
  const displayAuthor = book.author;
  const coverTheme = getCoverTheme(displayTitle);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={styles.card}
    >
      {/* Cover / Faux 3D Book Container */}
      <View style={[styles.coverWrapper, { backgroundColor: coverTheme.bg }]}>
        {/* Faux Book Spine Crease */}
        <View style={[styles.bookSpine, { backgroundColor: coverTheme.spine }]} />

        {/* Faux Ribbon Bookmark Hanging */}
        <View style={styles.ribbonTab} />

        {/* Right Page Edge Gradient Emulation */}
        <View style={styles.pageEdgeBorder} />

        {book.coverUri ? (
          <Image
            source={{ uri: book.coverUri }}
            style={styles.coverImage}
            contentFit="cover"
            transition={250}
          />
        ) : (
          <View style={styles.coverEditorial}>
            <View style={styles.coverTopRow}>
              <Bookmark size={15} color={coverTheme.accent} />
              <View style={[styles.formatTag, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}>
                <Text style={styles.formatTagText}>{book.format.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.coverCenter}>
              <Text numberOfLines={3} style={[styles.coverBookTitle, { color: coverTheme.text }]}>
                {displayTitle}
              </Text>
              <Text numberOfLines={1} style={[styles.coverBookAuthor, { color: coverTheme.accent }]}>
                {displayAuthor && displayAuthor !== 'Unknown Author' ? displayAuthor : 'Classic Edition'}
              </Text>
            </View>

            <View style={styles.coverBottomRow}>
              <View style={styles.editorialStripe} />
            </View>
          </View>
        )}

        {/* Format Pill (if cover exists) */}
        {Boolean(book.coverUri) && (
          <View
            style={[
              styles.formatBadge,
              { backgroundColor: book.format === 'epub' ? '#B45309' : '#DC2626' },
            ]}
          >
            <Text style={styles.formatText}>{book.format.toUpperCase()}</Text>
          </View>
        )}

        {/* Finished Badge */}
        {isFinished && (
          <View style={styles.finishedBadge}>
            <CheckCircle2 size={16} color="#10B981" />
          </View>
        )}
      </View>

      {/* Info Section */}
      <View style={styles.infoWrapper}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.title}>
            {displayTitle}
          </Text>
          {onAddToShelf && (
            <TouchableOpacity
              style={styles.shelfBtn}
              onPress={(e) => {
                e.stopPropagation();
                onAddToShelf();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Add to Shelf"
            >
              <Bookmark size={14} color="#A8A29E" />
            </TouchableOpacity>
          )}
        </View>

        <Text numberOfLines={1} style={styles.author}>
          {displayAuthor}
        </Text>

        {/* Reading Progress */}
        <View style={styles.progressSection}>
          <ProgressBar
            progress={percent}
            color={isFinished ? '#10B981' : '#D97706'}
            height={3}
          />
          <View style={styles.progressLabels}>
            <Text style={[styles.progressText, isReading && { color: '#B45309', fontWeight: '700' }]}>
              {isFinished ? 'Finished' : percent > 0 ? `${percent}%` : 'Unread'}
            </Text>
            {book.progress && book.progress.currentPage > 0 ? (
              <Text style={styles.pageText}>
                p. {book.progress.currentPage}
                {book.totalPages > 0 ? ` / ${book.totalPages}` : ''}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // -------------------------
  // GRID CARD STYLES
  // -------------------------
  card: {
    flex: 1,
    margin: 8,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  coverWrapper: {
    width: '100%',
    aspectRatio: 0.74,
    borderRadius: 14,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  bookSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
  },
  ribbonTab: {
    position: 'absolute',
    top: 0,
    right: 18,
    width: 9,
    height: 14,
    backgroundColor: '#D84A6A',
    zIndex: 12,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  pageEdgeBorder: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 11,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverEditorial: {
    width: '100%',
    height: '100%',
    padding: 12,
    justifyContent: 'space-between',
  },
  coverTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coverCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  coverBookTitle: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  coverBookAuthor: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.85,
  },
  coverBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editorialStripe: {
    width: 24,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1,
  },
  formatTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  formatTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  formatBadge: {
    position: 'absolute',
    top: 9,
    left: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 12,
  },
  formatText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  finishedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#10B981',
    borderRadius: 999,
    padding: 3,
    zIndex: 12,
  },
  infoWrapper: {
    paddingTop: 8,
    paddingHorizontal: 2,
    backgroundColor: 'transparent',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    flex: 1,
    marginRight: 4,
  },
  shelfBtn: {
    padding: 2,
    flexShrink: 0,
  },
  author: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  progressSection: {
    marginTop: 'auto',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  pageText: {
    fontSize: 10,
    color: '#6B7280',
  },
});
