import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import {
  X,
  Headphones,
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Timer,
  CloudRain,
  Coffee,
  Trees,
  Waves,
  Flame,
  Wind,
  Sparkles,
  FastForward,
  RotateCcw,
  CloudLightning,
  Moon,
  Clock,
  Train,
  Snowflake,
  Bell,
  SkipForward,
  SkipBack,
  BookmarkCheck,
} from 'lucide-react-native';
import { TTSService, TTSOptions } from '@/services/audio/textToSpeechService';
import {
  AmbientService,
  SOUNDSCAPES,
  SoundscapeId,
} from '@/services/audio/ambientAudioService';
import { BookRepository } from '@/services/database/bookRepository';
import { Fonts } from '@/constants/theme';
import { HorizontalScroll } from '@/components/ui/HorizontalScroll';

interface AudioStudioModalProps {
  visible: boolean;
  onClose: () => void;
  bookId?: string;
  bookTitle?: string;
  pageText: string;
  currentPage: number;
  totalPages: number;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  onJumpToPage?: (page: number) => void;
}

interface SavedTTSPosition {
  page: number;
  paragraphIndex: number;
  snippet: string;
  updatedAt: string;
}

const SPEED_OPTIONS = [0.8, 1.0, 1.25, 1.5, 2.0];
const TIMER_OPTIONS = [
  { label: 'Off', minutes: null },
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '60m', minutes: 60 },
];
const VOLUME_LEVELS = [0.2, 0.4, 0.6, 0.8, 1.0];

export const AudioStudioModal: React.FC<AudioStudioModalProps> = ({
  visible,
  onClose,
  bookId,
  bookTitle,
  pageText,
  currentPage,
  totalPages,
  onNextPage,
  onPrevPage,
  onJumpToPage,
}) => {
  const [activeTab, setActiveTab] = useState<'tts' | 'ambient'>('tts');

  // TTS State
  const [isSpeaking, setIsSpeaking] = useState(TTSService.isSpeaking());
  const [isPaused, setIsPaused] = useState(TTSService.isPaused());
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Paragraph-level tracking
  const [activeParagraphIndex, setActiveParagraphIndex] = useState(0);
  const [savedPosition, setSavedPosition] = useState<SavedTTSPosition | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);

  // Auto-advance and page transition refs to seamlessly continue speech across page flips
  const shouldPlayWhenReadyRef = useRef(false);
  const autoAdvanceTargetParagraphRef = useRef(0);
  const activeParagraphRef = useRef(0);
  activeParagraphRef.current = activeParagraphIndex;

  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  const prevPageRef = useRef(currentPage);

  // Split page text into clean paragraphs
  const paragraphs = useMemo(() => {
    if (!pageText || pageText.trim().length === 0) return [];
    return pageText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }, [pageText]);

  // Ambient State
  const [activeSoundscape, setActiveSoundscape] = useState<SoundscapeId | null>(
    AmbientService.getActiveSoundscape()
  );
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(AmbientService.isPlaying());
  const [volume, setVolume] = useState(AmbientService.getVolume());
  const [remainingTimerSeconds, setRemainingTimerSeconds] = useState<number | null>(
    AmbientService.getRemainingTimerSeconds()
  );

  // Subscribe to ambient state updates
  useEffect(() => {
    const unsubscribe = AmbientService.subscribe((state) => {
      setActiveSoundscape(state.activeSoundscape);
      setIsAmbientPlaying(state.isPlaying);
      setVolume(state.volume);
      setRemainingTimerSeconds(state.remainingTimerSeconds);
    });
    return unsubscribe;
  }, []);

  const persistTTSPosition = async (page: number, pIndex: number, text: string) => {
    if (!bookId) return;
    try {
      const pos: SavedTTSPosition = {
        page,
        paragraphIndex: pIndex,
        snippet: text.substring(0, 90).replace(/\s+/g, ' ').trim(),
        updatedAt: new Date().toISOString(),
      };
      await BookRepository.setSetting(`tts_last_pos_${bookId}`, JSON.stringify(pos));
      setSavedPosition(pos);
    } catch {
      // Safe fallback
    }
  };

  const speakParagraph = (pIndex: number) => {
    if (pIndex < 0 || pIndex >= paragraphs.length) {
      setIsSpeaking(false);
      setIsPaused(false);
      return;
    }

    const currentText = paragraphs[pIndex];
    setActiveParagraphIndex(pIndex);
    persistTTSPosition(currentPage, pIndex, currentText);

    const options: TTSOptions = {
      rate: speed,
      pitch,
      onStart: () => {
        setIsSpeaking(true);
        setIsPaused(false);
      },
      onDone: () => {
        const nextIndex = pIndex + 1;
        if (nextIndex < paragraphs.length) {
          // Speak next paragraph on current page
          speakParagraph(nextIndex);
        } else {
          // Finished all paragraphs on this page!
          if (autoAdvance && onNextPage && currentPage < totalPages) {
            shouldPlayWhenReadyRef.current = true;
            autoAdvanceTargetParagraphRef.current = 0;
            TTSService.stop();
            onNextPage();
          } else {
            setIsSpeaking(false);
            setIsPaused(false);
          }
        }
      },
      onStopped: () => {
        // If transitioning to next page, do not clear the playing state
        if (!shouldPlayWhenReadyRef.current) {
          setIsSpeaking(false);
          setIsPaused(false);
        }
      },
      onError: () => {
        setIsSpeaking(false);
        setIsPaused(false);
      },
    };

    TTSService.speak(currentText, options);
  };

  const loadSavedPosition = async () => {
    if (!bookId) return;
    try {
      const raw = await BookRepository.getSetting(`tts_last_pos_${bookId}`);
      if (raw) {
        const parsed: SavedTTSPosition = JSON.parse(raw);
        setSavedPosition(parsed);
        // Show resume banner if the saved position is different from current state
        if (parsed.page !== currentPage || parsed.paragraphIndex > 0) {
          setShowResumeBanner(true);
        }
      }
    } catch {
      // Ignore parse errors
    }
  };

  // Sync TTS state and load saved session position
  useEffect(() => {
    setIsSpeaking(TTSService.isSpeaking());
    setIsPaused(TTSService.isPaused());

    if (visible && bookId) {
      loadSavedPosition();
    }
  }, [visible, bookId]);

  // Handle page transitions (both auto-advance and manual page turns)
  useEffect(() => {
    if (currentPage !== prevPageRef.current) {
      const wasPlaying = isSpeakingRef.current || TTSService.isSpeaking() || shouldPlayWhenReadyRef.current;
      prevPageRef.current = currentPage;

      // Always stop previous page's audio immediately
      TTSService.stop();
      setActiveParagraphIndex(0);

      if (wasPlaying) {
        // Automatically narrate the newly arrived page
        shouldPlayWhenReadyRef.current = true;
        autoAdvanceTargetParagraphRef.current = 0;
        setIsSpeaking(true);
        setIsPaused(false);
      } else {
        shouldPlayWhenReadyRef.current = false;
      }
    }
  }, [currentPage]);

  // When fresh pageText arrives for the new page and playback is queued
  useEffect(() => {
    if (shouldPlayWhenReadyRef.current && paragraphs.length > 0) {
      shouldPlayWhenReadyRef.current = false;
      const targetIdx = Math.min(autoAdvanceTargetParagraphRef.current, paragraphs.length - 1);
      autoAdvanceTargetParagraphRef.current = 0;
      setActiveParagraphIndex(targetIdx);
      speakParagraph(targetIdx);
    }
  }, [pageText, paragraphs]);

  const handleToggleTTS = () => {
    if (isSpeaking && !isPaused) {
      TTSService.pause();
      setIsPaused(true);
      return;
    }

    if (isSpeaking && isPaused) {
      TTSService.resume();
      setIsPaused(false);
      return;
    }

    // Start speaking from active paragraph or paragraph 0
    if (paragraphs.length > 0) {
      const idx = activeParagraphIndex >= 0 && activeParagraphIndex < paragraphs.length ? activeParagraphIndex : 0;
      speakParagraph(idx);
    } else if (pageText && pageText.trim()) {
      TTSService.speak(pageText, {
        rate: speed,
        pitch,
        onStart: () => {
          setIsSpeaking(true);
          setIsPaused(false);
        },
        onDone: () => {
          setIsSpeaking(false);
          setIsPaused(false);
          if (autoAdvance && onNextPage && currentPage < totalPages) {
            onNextPage();
          }
        },
        onStopped: () => {
          setIsSpeaking(false);
          setIsPaused(false);
        },
      });
    }
  };

  const handleStopTTS = () => {
    shouldPlayWhenReadyRef.current = false;
    TTSService.stop();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  const handleResumeFromSaved = () => {
    if (!savedPosition) return;
    setShowResumeBanner(false);

    if (savedPosition.page !== currentPage && onJumpToPage) {
      // Set target paragraph and queue flag so it speaks upon page arrival
      shouldPlayWhenReadyRef.current = true;
      autoAdvanceTargetParagraphRef.current = savedPosition.paragraphIndex;
      onJumpToPage(savedPosition.page);
    } else {
      setActiveParagraphIndex(savedPosition.paragraphIndex);
      speakParagraph(savedPosition.paragraphIndex);
    }
  };

  const handleSelectParagraph = (index: number) => {
    handleStopTTS();
    setActiveParagraphIndex(index);
    setTimeout(() => {
      speakParagraph(index);
    }, 100);
  };

  const handleSkipNextParagraph = () => {
    if (activeParagraphIndex + 1 < paragraphs.length) {
      handleStopTTS();
      const next = activeParagraphIndex + 1;
      setActiveParagraphIndex(next);
      setTimeout(() => speakParagraph(next), 100);
    } else if (onNextPage && currentPage < totalPages) {
      handleStopTTS();
      shouldPlayWhenReadyRef.current = true;
      autoAdvanceTargetParagraphRef.current = 0;
      onNextPage();
    }
  };

  const handleSkipPrevParagraph = () => {
    if (activeParagraphIndex > 0) {
      handleStopTTS();
      const prev = activeParagraphIndex - 1;
      setActiveParagraphIndex(prev);
      setTimeout(() => speakParagraph(prev), 100);
    } else if (onPrevPage && currentPage > 1) {
      handleStopTTS();
      shouldPlayWhenReadyRef.current = true;
      autoAdvanceTargetParagraphRef.current = 0;
      onPrevPage();
    }
  };

  const handleSoundscapeSelect = (id: SoundscapeId) => {
    AmbientService.playSoundscape(id, volume);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    AmbientService.setVolume(newVol);
  };

  const handleTimerSelect = (mins: number | null) => {
    AmbientService.setSleepTimer(mins);
  };

  const formatTimerCountdown = (totalSecs: number | null): string => {
    if (totalSecs === null || totalSecs <= 0) return '';
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const renderSoundscapeIcon = (iconName: string, color: string) => {
    switch (iconName) {
      case 'CloudRain':
        return <CloudRain size={22} color={color} />;
      case 'Coffee':
        return <Coffee size={22} color={color} />;
      case 'Trees':
        return <Trees size={22} color={color} />;
      case 'Waves':
        return <Waves size={22} color={color} />;
      case 'Flame':
        return <Flame size={22} color={color} />;
      case 'Wind':
        return <Wind size={22} color={color} />;
      case 'CloudLightning':
        return <CloudLightning size={22} color={color} />;
      case 'Moon':
        return <Moon size={22} color={color} />;
      case 'Clock':
        return <Clock size={22} color={color} />;
      case 'Train':
        return <Train size={22} color={color} />;
      case 'Snowflake':
        return <Snowflake size={22} color={color} />;
      case 'Bell':
        return <Bell size={22} color={color} />;
      default:
        return <Headphones size={22} color={color} />;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconCircle}>
                <Headphones size={20} color="#D97706" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Audio & Ambience Studio</Text>
                <Text style={styles.headerSubtitle}>
                  {bookTitle ? `${bookTitle} • ` : ''}Page {currentPage} of {totalPages}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Navigation Sub-Tabs */}
          <HorizontalScroll
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsRow}
          >
            <TouchableOpacity
              onPress={() => setActiveTab('tts')}
              style={[styles.tabButton, activeTab === 'tts' && styles.tabButtonActive]}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.tabButtonText, activeTab === 'tts' && styles.tabButtonTextActive]}
              >
                🎙️ Read Aloud
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('ambient')}
              style={[styles.tabButton, activeTab === 'ambient' && styles.tabButtonActive]}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.tabButtonText, activeTab === 'ambient' && styles.tabButtonTextActive]}
              >
                🎧 Ambient Atmosphere
              </Text>
            </TouchableOpacity>
          </HorizontalScroll>

          <ScrollView style={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {/* TAB 1: READ ALOUD (TTS) */}
            {activeTab === 'tts' ? (
              <View style={styles.tabSection}>
                {/* Resume Previous Session Banner */}
                {showResumeBanner && savedPosition && (
                  <View style={styles.resumeBanner}>
                    <View style={styles.resumeBannerHeader}>
                      <BookmarkCheck size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                      <Text style={styles.resumeBannerTitle}>
                        Resume from Last Session
                      </Text>
                    </View>
                    <Text style={styles.resumeBannerDesc}>
                      Stopped at Page {savedPosition.page}, Paragraph {savedPosition.paragraphIndex + 1}
                    </Text>
                    {savedPosition.snippet ? (
                      <Text numberOfLines={2} style={styles.resumeSnippet}>
                        "{savedPosition.snippet}..."
                      </Text>
                    ) : null}
                    <View style={styles.resumeActionsRow}>
                      <TouchableOpacity
                        style={styles.resumeBtn}
                        onPress={handleResumeFromSaved}
                        activeOpacity={0.8}
                      >
                        <Play size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
                        <Text style={styles.resumeBtnText}>Resume from here</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.dismissResumeBtn}
                        onPress={() => setShowResumeBanner(false)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.dismissResumeBtnText}>Start Current Page</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Playing Status Banner */}
                <View style={styles.ttsStatusBanner}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ttsStatusTitle}>
                      {isSpeaking && !isPaused
                        ? `Narrating Paragraph ${activeParagraphIndex + 1} of ${paragraphs.length || 1}`
                        : isSpeaking && isPaused
                        ? `Paused at Paragraph ${activeParagraphIndex + 1}`
                        : `Ready to Read Page ${currentPage}`}
                    </Text>
                    <Text style={styles.ttsStatusSubtitle}>
                      {isSpeaking
                        ? 'Continuous smart auto-advance enabled'
                        : `${paragraphs.length} paragraphs on this page`}
                    </Text>
                  </View>

                  {/* Main Play / Pause / Skip Controls */}
                  <View style={styles.ttsControlsRow}>
                    <TouchableOpacity
                      onPress={handleSkipPrevParagraph}
                      style={styles.skipBtn}
                      activeOpacity={0.7}
                      accessibilityLabel="Previous paragraph"
                    >
                      <SkipBack size={18} color="#D1D5DB" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleToggleTTS}
                      style={styles.ttsPlayBtn}
                      activeOpacity={0.8}
                    >
                      {isSpeaking && !isPaused ? (
                        <Pause size={22} color="#FFFFFF" />
                      ) : (
                        <Play size={22} color="#FFFFFF" style={{ marginLeft: 2 }} />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleSkipNextParagraph}
                      style={styles.skipBtn}
                      activeOpacity={0.7}
                      accessibilityLabel="Next paragraph"
                    >
                      <SkipForward size={18} color="#D1D5DB" />
                    </TouchableOpacity>

                    {isSpeaking && (
                      <TouchableOpacity
                        onPress={handleStopTTS}
                        style={styles.ttsStopBtn}
                        activeOpacity={0.8}
                      >
                        <Square size={14} color="#78716C" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Paragraphs Interactive Flow */}
                {paragraphs.length > 0 && (
                  <View style={styles.paragraphsContainer}>
                    <Text style={styles.optionLabel}>Page Paragraphs (Tap to Read From)</Text>
                    <View style={styles.paragraphsList}>
                      {paragraphs.map((p, idx) => {
                        const isCurrent = idx === activeParagraphIndex && isSpeaking;
                        return (
                          <TouchableOpacity
                            key={idx}
                            style={[
                              styles.paragraphCard,
                              isCurrent && styles.paragraphCardActive,
                            ]}
                            onPress={() => handleSelectParagraph(idx)}
                            activeOpacity={0.75}
                          >
                            <View style={styles.paragraphHeaderRow}>
                              <View
                                style={[
                                  styles.paragraphNumberBadge,
                                  isCurrent && styles.paragraphNumberBadgeActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.paragraphNumberText,
                                    isCurrent && { color: '#F59E0B' },
                                  ]}
                                >
                                  ¶ {idx + 1}
                                </Text>
                              </View>
                              {isCurrent && (
                                <View style={styles.liveSpeechIndicator}>
                                  <Volume2 size={13} color="#F59E0B" style={{ marginRight: 4 }} />
                                  <Text style={styles.liveSpeechText}>
                                    {isPaused ? 'Paused' : 'Speaking'}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text
                              numberOfLines={isCurrent ? 5 : 2}
                              style={[
                                styles.paragraphTextPreview,
                                isCurrent && styles.paragraphTextPreviewActive,
                              ]}
                            >
                              {p}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Speed Controls */}
                <View style={styles.optionSection}>
                  <Text style={styles.optionLabel}>Narration Speed</Text>
                  <View style={styles.chipsRow}>
                    {SPEED_OPTIONS.map((rateVal) => {
                      const isSelected = speed === rateVal;
                      return (
                        <TouchableOpacity
                          key={rateVal}
                          onPress={() => {
                            setSpeed(rateVal);
                            if (isSpeaking) {
                              handleStopTTS();
                              setTimeout(() => speakParagraph(activeParagraphIndex), 100);
                            }
                          }}
                          style={[styles.chip, isSelected && styles.chipActive]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextActive,
                            ]}
                          >
                            {rateVal}x
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Pitch Controls */}
                <View style={styles.optionSection}>
                  <Text style={styles.optionLabel}>Voice Tone / Pitch</Text>
                  <View style={styles.chipsRow}>
                    {[
                      { label: 'Deep', val: 0.85 },
                      { label: 'Natural', val: 1.0 },
                      { label: 'Crisp', val: 1.15 },
                    ].map((p) => {
                      const isSelected = pitch === p.val;
                      return (
                        <TouchableOpacity
                          key={p.label}
                          onPress={() => setPitch(p.val)}
                          style={[styles.chip, isSelected && styles.chipActive]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextActive,
                            ]}
                          >
                            {p.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Auto-advance Page Option */}
                <TouchableOpacity
                  onPress={() => setAutoAdvance(!autoAdvance)}
                  style={styles.toggleRow}
                  activeOpacity={0.7}
                >
                  <View>
                    <Text style={styles.toggleTitle}>Continuous Auto-Advance Page</Text>
                    <Text style={styles.toggleDesc}>
                      Flips to next page and immediately continues narration
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.toggleTrack,
                      autoAdvance && styles.toggleTrackActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleThumb,
                        autoAdvance && styles.toggleThumbActive,
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              /* TAB 2: AMBIENT SOUNDSCAPES */
              <View style={styles.tabSection}>
                {/* Active Ambience Control Bar */}
                {activeSoundscape && (
                  <View style={styles.ambientStatusBanner}>
                    <View style={styles.ambientStatusLeft}>
                      <View style={styles.ambientStatusIconCircle}>
                        <Volume2 size={18} color="#D97706" />
                      </View>
                      <View>
                        <Text style={styles.ambientStatusTitle}>
                          {activeSoundscape && SOUNDSCAPES[activeSoundscape]?.title
                            ? SOUNDSCAPES[activeSoundscape].title
                            : 'Soundscape'}
                        </Text>
                        <Text style={styles.ambientStatusSubtitle}>
                          {remainingTimerSeconds
                            ? `Timer: ${formatTimerCountdown(remainingTimerSeconds)} remaining`
                            : isAmbientPlaying
                            ? 'Procedural organic soundscape'
                            : 'Paused'}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => {
                        if (isAmbientPlaying) {
                          AmbientService.stop();
                        } else if (activeSoundscape) {
                          AmbientService.playSoundscape(activeSoundscape, volume);
                        }
                      }}
                      style={styles.ambientPlayToggleBtn}
                      activeOpacity={0.8}
                    >
                      {isAmbientPlaying ? (
                        <Pause size={18} color="#FFFFFF" />
                      ) : (
                        <Play size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Volume Slider Section */}
                <View style={styles.optionSection}>
                  <View style={styles.volumeHeaderRow}>
                    <Text style={styles.optionLabel}>Atmosphere Volume</Text>
                    <Text style={styles.volumeValueText}>
                      {Math.round(volume * 100)}%
                    </Text>
                  </View>
                  <View style={styles.volumeLevelsRow}>
                    {VOLUME_LEVELS.map((vol) => (
                      <TouchableOpacity
                        key={vol}
                        onPress={() => handleVolumeChange(vol)}
                        style={[
                          styles.volumePill,
                          volume >= vol && styles.volumePillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.volumePillText,
                            volume >= vol && styles.volumePillTextActive,
                          ]}
                        >
                          {Math.round(vol * 100)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Sleep Timer Section */}
                <View style={styles.optionSection}>
                  <Text style={styles.optionLabel}>Sleep Timer</Text>
                  <View style={styles.chipsRow}>
                    {TIMER_OPTIONS.map((opt) => {
                      const isCurrent =
                        opt.minutes === null
                          ? remainingTimerSeconds === null
                          : remainingTimerSeconds !== null &&
                            Math.ceil(remainingTimerSeconds / 60) === opt.minutes;

                      return (
                        <TouchableOpacity
                          key={opt.label}
                          onPress={() => handleTimerSelect(opt.minutes)}
                          style={[styles.chip, isCurrent && styles.chipActive]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isCurrent && styles.chipTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Soundscapes Grid */}
                <View style={styles.optionSection}>
                  <Text style={styles.optionLabel}>Curated Soundscapes</Text>
                  <View style={styles.soundscapeGrid}>
                    {Object.values(SOUNDSCAPES).map((item) => {
                      const isSelected = activeSoundscape === item.id;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => handleSoundscapeSelect(item.id)}
                          style={[
                            styles.soundscapeCard,
                            isSelected && styles.soundscapeCardActive,
                          ]}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.soundscapeIconBox,
                              isSelected && styles.soundscapeIconBoxActive,
                            ]}
                          >
                            {renderSoundscapeIcon(
                              item.iconName,
                              isSelected ? '#D97706' : '#78716C'
                            )}
                          </View>
                          <Text
                            style={[
                              styles.soundscapeName,
                              isSelected && styles.soundscapeNameActive,
                            ]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <Text
                            style={styles.soundscapeDesc}
                            numberOfLines={2}
                          >
                            {item.subtitle}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1C1917',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '85%',
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Fonts.serif,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#78716C',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#292524',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsScroll: {
    flexGrow: 0,
    maxHeight: 56,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#292524',
    alignItems: 'center',
    minWidth: 140,
  },
  tabButtonActive: {
    backgroundColor: '#44403C',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78716C',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  tabSection: {
    paddingBottom: 24,
  },
  resumeBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  resumeBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  resumeBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FBBF24',
  },
  resumeBannerDesc: {
    fontSize: 12,
    color: '#E5E7EB',
    fontWeight: '600',
    marginBottom: 4,
  },
  resumeSnippet: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginBottom: 10,
    lineHeight: 15,
  },
  resumeActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  resumeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dismissResumeBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#292524',
  },
  dismissResumeBtnText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  ttsStatusBanner: {
    backgroundColor: '#292524',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  ttsStatusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ttsStatusSubtitle: {
    fontSize: 12,
    color: '#78716C',
    marginTop: 2,
  },
  ttsControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skipBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#383431',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ttsPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D97706',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ttsStopBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#383431',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paragraphsContainer: {
    marginBottom: 16,
  },
  paragraphsList: {
    gap: 8,
    marginTop: 8,
  },
  paragraphCard: {
    backgroundColor: '#24211E',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  paragraphCardActive: {
    borderColor: '#D97706',
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
  },
  paragraphHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  paragraphNumberBadge: {
    backgroundColor: '#292524',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  paragraphNumberBadgeActive: {
    backgroundColor: 'rgba(217, 119, 6, 0.25)',
  },
  paragraphNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78716C',
  },
  liveSpeechIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveSpeechText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  paragraphTextPreview: {
    fontSize: 12.5,
    color: '#A8A29E',
    lineHeight: 18,
  },
  paragraphTextPreviewActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  optionSection: {
    marginBottom: 16,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78716C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#292524',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#D97706',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78716C',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#292524',
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  toggleDesc: {
    fontSize: 11,
    color: '#78716C',
    marginTop: 2,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#44403C',
    padding: 2,
    justifyContent: 'center',
  },
  toggleTrackActive: {
    backgroundColor: '#D97706',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  ambientStatusBanner: {
    backgroundColor: '#292524',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  ambientStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ambientStatusIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ambientStatusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ambientStatusSubtitle: {
    fontSize: 12,
    color: '#78716C',
    marginTop: 2,
  },
  ambientPlayToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D97706',
    justifyContent: 'center',
    alignItems: 'center',
  },
  volumeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  volumeValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  volumeLevelsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  volumePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#292524',
    alignItems: 'center',
  },
  volumePillActive: {
    backgroundColor: '#D97706',
  },
  volumePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78716C',
  },
  volumePillTextActive: {
    color: '#FFFFFF',
  },
  soundscapeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  soundscapeCard: {
    width: '48%',
    backgroundColor: '#292524',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  soundscapeCardActive: {
    borderColor: '#D97706',
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
  },
  soundscapeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#383431',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  soundscapeIconBoxActive: {
    backgroundColor: 'rgba(217, 119, 6, 0.2)',
  },
  soundscapeName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  soundscapeNameActive: {
    color: '#D97706',
  },
  soundscapeDesc: {
    fontSize: 11,
    color: '#78716C',
    lineHeight: 14,
  },
});
