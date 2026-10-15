import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { X, RotateCw, Trophy, CheckCircle, ArrowRight, Sparkles, BookOpen } from 'lucide-react-native';
import { Flashcard, FlashcardReviewRating } from '@/types/book';
import { FlashcardService } from '@/services/flashcards/flashcardService';

interface FlashcardReviewModalProps {
  visible: boolean;
  deckTitle?: string;
  cards: Flashcard[];
  onClose: () => void;
  onSessionComplete: () => void;
}

export const FlashcardReviewModal: React.FC<FlashcardReviewModalProps> = ({
  visible,
  deckTitle = 'Flashcard Deck',
  cards,
  onClose,
  onSessionComplete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  // Animated flip value (0 = front, 180 = back)
  const animatedValue = useRef(new Animated.Value(0)).current;

  const frontInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const flipCard = () => {
    if (isFlipped) {
      Animated.spring(animatedValue, {
        toValue: 0,
        friction: 8,
        tension: 10,
        useNativeDriver: true,
      }).start();
      setIsFlipped(false);
    } else {
      Animated.spring(animatedValue, {
        toValue: 180,
        friction: 8,
        tension: 10,
        useNativeDriver: true,
      }).start();
      setIsFlipped(true);
    }
  };

  const handleRate = async (rating: FlashcardReviewRating) => {
    const currentCard = cards[currentIndex];
    if (currentCard) {
      await FlashcardService.recordReview(currentCard.id, rating);
    }

    setReviewedCount((prev) => prev + 1);
    if (rating === 'good' || rating === 'easy') {
      setCorrectCount((prev) => prev + 1);
    }

    // Reset card flip immediately before switching
    animatedValue.setValue(0);
    setIsFlipped(false);

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsComplete(true);
      onSessionComplete();
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsComplete(false);
    setReviewedCount(0);
    setCorrectCount(0);
    animatedValue.setValue(0);
  };

  if (!visible) return null;

  const currentCard = cards[currentIndex];
  const progressPercent = cards.length > 0 ? (currentIndex / cards.length) * 100 : 0;
  const retentionScore = reviewedCount > 0 ? Math.round((correctCount / reviewedCount) * 100) : 100;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.deckTitle} numberOfLines={1}>
              {deckTitle}
            </Text>
            <Text style={styles.progressText}>
              Card {currentIndex + 1} of {cards.length}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Close Review"
          >
            <X size={20} color="#78716C" />
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>

        {/* Session Complete Screen */}
        {isComplete ? (
          <View style={styles.completeContainer}>
            <View style={styles.trophyCircle}>
              <Trophy size={48} color="#D97706" />
            </View>

            <Text style={styles.completeTitle}>Review Session Completed!</Text>
            <Text style={styles.completeSubtitle}>
              Your memory recall intervals have been scheduled using the SuperMemo SM-2 algorithm.
            </Text>

            <View style={styles.statsCard}>
              <View style={styles.statCol}>
                <Text style={styles.statNum}>{reviewedCount}</Text>
                <Text style={styles.statLabel}>Cards Studied</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={[styles.statNum, { color: '#10B981' }]}>{retentionScore}%</Text>
                <Text style={styles.statLabel}>Retention</Text>
              </View>
            </View>

            <View style={styles.completeActions}>
              <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
                <CheckCircle size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.doneBtnText}>Return to Flashcards</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.repeatBtn} onPress={handleRestart} activeOpacity={0.8}>
                <RotateCw size={16} color="#78716C" style={{ marginRight: 6 }} />
                <Text style={styles.repeatBtnText}>Study Deck Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : currentCard ? (
          /* Active Card Review */
          <View style={styles.studyArea}>
            <Pressable style={styles.cardContainer} onPress={flipCard}>
              {/* Front Card Face */}
              <Animated.View
                style={[
                  styles.cardFace,
                  styles.cardFront,
                  {
                    transform: [{ rotateY: frontInterpolate }],
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>QUESTION / ACTIVE RECALL</Text>
                  </View>
                  {currentCard.context && (
                    <Text style={styles.contextBadge}>{currentCard.context}</Text>
                  )}
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.questionText}>{currentCard.front}</Text>
                </View>

                <View style={styles.cardFooter}>
                  <RotateCw size={14} color="#A8A29E" style={{ marginRight: 6 }} />
                  <Text style={styles.flipPrompt}>Tap card to reveal answer</Text>
                </View>
              </Animated.View>

              {/* Back Card Face */}
              <Animated.View
                style={[
                  styles.cardFace,
                  styles.cardBack,
                  {
                    transform: [{ rotateY: backInterpolate }],
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.typeBadge, { backgroundColor: '#ECFDF5' }]}>
                    <Text style={[styles.typeBadgeText, { color: '#059669' }]}>EXPLANATION / ANSWER</Text>
                  </View>
                  {currentCard.bookTitle && (
                    <Text numberOfLines={1} style={styles.contextBadge}>
                      {currentCard.bookTitle}
                    </Text>
                  )}
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.answerText}>{currentCard.back}</Text>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.ratePrompt}>How well did you recall this?</Text>
                </View>
              </Animated.View>
            </Pressable>

            {/* Bottom SM-2 Rating Bar */}
            {isFlipped ? (
              <View style={styles.ratingBar}>
                <TouchableOpacity
                  style={[styles.rateBtn, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
                  onPress={() => handleRate('again')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rateBtnTitle, { color: '#DC2626' }]}>Again</Text>
                  <Text style={[styles.rateBtnSub, { color: '#EF4444' }]}>1 day</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.rateBtn, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}
                  onPress={() => handleRate('hard')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rateBtnTitle, { color: '#D97706' }]}>Hard</Text>
                  <Text style={[styles.rateBtnSub, { color: '#F59E0B' }]}>2 days</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.rateBtn, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                  onPress={() => handleRate('good')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rateBtnTitle, { color: '#059669' }]}>Good</Text>
                  <Text style={[styles.rateBtnSub, { color: '#10B981' }]}>4 days</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.rateBtn, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                  onPress={() => handleRate('easy')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rateBtnTitle, { color: '#2563EB' }]}>Easy</Text>
                  <Text style={[styles.rateBtnSub, { color: '#3B82F6' }]}>7 days</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.hintBar}>
                <TouchableOpacity style={styles.revealBtn} onPress={flipCard} activeOpacity={0.8}>
                  <Text style={styles.revealBtnText}>Reveal Answer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#FAF7F2',
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE4',
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  deckTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1917',
    letterSpacing: -0.2,
  },
  progressText: {
    fontSize: 12,
    color: '#78716C',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F5F5F4',
    flexShrink: 0,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#E7E5E4',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#D97706',
  },
  studyArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: 'space-between',
  },
  cardContainer: {
    flex: 1,
    position: 'relative',
    marginVertical: 10,
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 24,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardFront: {
    zIndex: 1,
  },
  cardBack: {
    backgroundColor: '#FFFDF9',
    borderColor: '#FDE68A',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  contextBadge: {
    fontSize: 11,
    color: '#A8A29E',
    fontWeight: '500',
    maxWidth: '50%',
  },
  cardBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1917',
    textAlign: 'center',
    lineHeight: 30,
  },
  answerText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1C1917',
    textAlign: 'center',
    lineHeight: 28,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F4',
  },
  flipPrompt: {
    fontSize: 12,
    color: '#A8A29E',
    fontWeight: '500',
  },
  ratePrompt: {
    fontSize: 12,
    color: '#78716C',
    fontWeight: '600',
  },
  hintBar: {
    paddingTop: 12,
  },
  revealBtn: {
    backgroundColor: '#1C1917',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealBtnText: {
    color: '#FAF7F2',
    fontSize: 15,
    fontWeight: '700',
  },
  ratingBar: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
  },
  rateBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  rateBtnTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  rateBtnSub: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  completeContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trophyCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  completeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1917',
    textAlign: 'center',
    marginBottom: 8,
  },
  completeSubtitle: {
    fontSize: 13,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    marginBottom: 32,
    width: '100%',
    justifyContent: 'space-around',
  },
  statCol: {
    alignItems: 'center',
  },
  statNum: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C1917',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A8A29E',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#F5F5F4',
  },
  completeActions: {
    width: '100%',
    gap: 12,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    borderRadius: 14,
    paddingVertical: 14,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  repeatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  repeatBtnText: {
    color: '#78716C',
    fontSize: 14,
    fontWeight: '600',
  },
});
