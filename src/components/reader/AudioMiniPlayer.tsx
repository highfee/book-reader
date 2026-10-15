import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import {
  Play,
  Pause,
  Headphones,
  CloudRain,
  Coffee,
  Trees,
  Waves,
  Flame,
  Wind,
  CloudLightning,
  Moon,
  Clock,
  Train,
  Snowflake,
  Bell,
  X,
} from 'lucide-react-native';
import { TTSService } from '@/services/audio/textToSpeechService';
import {
  AmbientService,
  SOUNDSCAPES,
  SoundscapeId,
} from '@/services/audio/ambientAudioService';

interface AudioMiniPlayerProps {
  currentPage: number;
  onOpenStudio: () => void;
}

export const AudioMiniPlayer: React.FC<AudioMiniPlayerProps> = ({
  currentPage,
  onOpenStudio,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(TTSService.isSpeaking());
  const [isSpeakingPaused, setIsSpeakingPaused] = useState(TTSService.isPaused());
  const [activeSoundscape, setActiveSoundscape] = useState<SoundscapeId | null>(
    AmbientService.getActiveSoundscape()
  );
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(AmbientService.isPlaying());

  // Listen to ambient service updates
  useEffect(() => {
    const unsub = AmbientService.subscribe((state) => {
      setActiveSoundscape(state.activeSoundscape);
      setIsAmbientPlaying(state.isPlaying);
    });
    return unsub;
  }, []);

  // Poll TTS status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setIsSpeaking(TTSService.isSpeaking());
      setIsSpeakingPaused(TTSService.isPaused());
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const hasActiveAudio = isSpeaking || (Boolean(activeSoundscape) && isAmbientPlaying);

  if (!hasActiveAudio) {
    return null;
  }

  const renderIcon = () => {
    if (isSpeaking) {
      return <Headphones size={15} color="#D97706" />;
    }
    if (activeSoundscape) {
      const info = SOUNDSCAPES[activeSoundscape];
      switch (info.iconName) {
        case 'CloudRain':
          return <CloudRain size={15} color={info.color} />;
        case 'Coffee':
          return <Coffee size={15} color={info.color} />;
        case 'Trees':
          return <Trees size={15} color={info.color} />;
        case 'Waves':
          return <Waves size={15} color={info.color} />;
        case 'Flame':
          return <Flame size={15} color={info.color} />;
        case 'Wind':
          return <Wind size={15} color={info.color} />;
        case 'CloudLightning':
          return <CloudLightning size={15} color={info.color} />;
        case 'Moon':
          return <Moon size={15} color={info.color} />;
        case 'Clock':
          return <Clock size={15} color={info.color} />;
        case 'Train':
          return <Train size={15} color={info.color} />;
        case 'Snowflake':
          return <Snowflake size={15} color={info.color} />;
        case 'Bell':
          return <Bell size={15} color={info.color} />;
        default:
          return <Headphones size={15} color="#D97706" />;
      }
    }
    return <Headphones size={15} color="#D97706" />;
  };

  const getLabel = () => {
    if (isSpeaking) {
      return isSpeakingPaused
        ? `TTS Paused (p. ${currentPage})`
        : `Narrating p. ${currentPage}`;
    }
    if (activeSoundscape) {
      return SOUNDSCAPES[activeSoundscape].title;
    }
    return 'Audio Active';
  };

  const handleTogglePlayback = () => {
    if (isSpeaking) {
      if (isSpeakingPaused) {
        TTSService.resume();
        setIsSpeakingPaused(false);
      } else {
        TTSService.pause();
        setIsSpeakingPaused(true);
      }
      return;
    }

    if (activeSoundscape) {
      if (isAmbientPlaying) {
        AmbientService.pause();
      } else {
        AmbientService.resume();
      }
    }
  };

  const handleStopAll = () => {
    if (isSpeaking) TTSService.stop();
    if (activeSoundscape) AmbientService.stop();
  };

  const isPaused = isSpeaking ? isSpeakingPaused : !isAmbientPlaying;

  return (
    <View style={styles.floatingContainer}>
      <Pressable onPress={onOpenStudio} style={styles.pillCard}>
        <View style={styles.iconCircle}>{renderIcon()}</View>

        <View style={styles.textWrap}>
          <Text style={styles.pillLabel} numberOfLines={1}>
            {getLabel()}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleTogglePlayback}
          style={styles.playbackBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isPaused ? (
            <Play size={13} color="#FFFFFF" style={{ marginLeft: 1 }} />
          ) : (
            <Pause size={13} color="#FFFFFF" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleStopAll}
          style={styles.dismissBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={13} color="#A8A29E" />
        </TouchableOpacity>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 84,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 99,
  },
  pillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1917',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    maxWidth: 340,
    width: '100%',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#292524',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textWrap: {
    flex: 1,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FAF8F5',
  },
  playbackBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  dismissBtn: {
    padding: 6,
    marginLeft: 6,
  },
});
