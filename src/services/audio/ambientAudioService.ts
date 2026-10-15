/**
 * Ambient Soundscapes Engine
 * Generates immersive ambient reading environments with offline support, volume control, and sleep timer.
 */

export type SoundscapeId =
  | 'rain'
  | 'cafe'
  | 'forest'
  | 'waves'
  | 'fireplace'
  | 'brown_noise'
  | 'thunderstorm'
  | 'night_crickets'
  | 'clock_tower'
  | 'vintage_train'
  | 'blizzard'
  | 'zen_bowls';

export interface SoundscapeInfo {
  id: SoundscapeId;
  title: string;
  subtitle: string;
  iconName: string;
  color: string;
  sourceUrl: string;
}

export const SOUNDSCAPES: Record<SoundscapeId, SoundscapeInfo> = {
  rain: {
    id: 'rain',
    title: 'Gentle Rain',
    subtitle: 'Rhythmic raindrops on windowpane',
    iconName: 'CloudRain',
    color: '#0284C7',
    sourceUrl: 'https://actions.google.com/sounds/v1/weather/rain_heavy.ogg',
  },
  cafe: {
    id: 'cafe',
    title: 'Parisian Café',
    subtitle: 'Subtle murmur & porcelain clinking',
    iconName: 'Coffee',
    color: '#B45309',
    sourceUrl: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg',
  },
  forest: {
    id: 'forest',
    title: 'Deep Forest',
    subtitle: 'Rustling leaves & distant birdsong',
    iconName: 'Trees',
    color: '#15803D',
    sourceUrl: 'https://actions.google.com/sounds/v1/ambiences/forest_birds.ogg',
  },
  waves: {
    id: 'waves',
    title: 'Ocean Surf',
    subtitle: 'Calming tides against the shore',
    iconName: 'Waves',
    color: '#0891B2',
    sourceUrl: 'https://actions.google.com/sounds/v1/water/ocean_waves_crashing.ogg',
  },
  fireplace: {
    id: 'fireplace',
    title: 'Library Hearth',
    subtitle: 'Warm crackling fireplace embers',
    iconName: 'Flame',
    color: '#EA580C',
    sourceUrl: 'https://actions.google.com/sounds/v1/household/fireplace_crackling.ogg',
  },
  brown_noise: {
    id: 'brown_noise',
    title: 'Deep Focus Noise',
    subtitle: 'Low-frequency continuous calm hum',
    iconName: 'Wind',
    color: '#6D28D9',
    sourceUrl: 'https://actions.google.com/sounds/v1/weather/wind_steady.ogg',
  },
  thunderstorm: {
    id: 'thunderstorm',
    title: 'Distant Thunder',
    subtitle: 'Rolling thunder & heavy rainfall',
    iconName: 'CloudLightning',
    color: '#6366F1',
    sourceUrl: 'https://actions.google.com/sounds/v1/weather/thunderstorm.ogg',
  },
  night_crickets: {
    id: 'night_crickets',
    title: 'Summer Night',
    subtitle: 'Crickets chirping under starlight',
    iconName: 'Moon',
    color: '#4338CA',
    sourceUrl: 'https://actions.google.com/sounds/v1/ambiences/outdoor_summer_night.ogg',
  },
  clock_tower: {
    id: 'clock_tower',
    title: 'Library Clock',
    subtitle: 'Antique pendulum wooden ticks',
    iconName: 'Clock',
    color: '#78350F',
    sourceUrl: 'https://actions.google.com/sounds/v1/household/clock_ticking.ogg',
  },
  vintage_train: {
    id: 'vintage_train',
    title: 'Vintage Rail',
    subtitle: 'Hypnotic rail rhythm on iron tracks',
    iconName: 'Train',
    color: '#64748B',
    sourceUrl: 'https://actions.google.com/sounds/v1/transportation/train_interior.ogg',
  },
  blizzard: {
    id: 'blizzard',
    title: 'Winter Blizzard',
    subtitle: 'Howling snowstorm outside cabin',
    iconName: 'Snowflake',
    color: '#0284C7',
    sourceUrl: 'https://actions.google.com/sounds/v1/weather/winter_wind.ogg',
  },
  zen_bowls: {
    id: 'zen_bowls',
    title: 'Zen Bowls',
    subtitle: 'Harmonic singing bowls & meditation',
    iconName: 'Bell',
    color: '#D97706',
    sourceUrl: 'https://actions.google.com/sounds/v1/household/bell_chime.ogg',
  },
};

import { WebAudioEngine } from './webAudioSynthesizer';

type StateListener = (state: {
  activeSoundscape: SoundscapeId | null;
  isPlaying: boolean;
  volume: number;
  remainingTimerSeconds: number | null;
}) => void;

class AmbientAudioService {
  private activeSoundscape: SoundscapeId | null = null;
  private isPlayingInternal = false;
  private volumeInternal = 0.6; // 0.0 to 1.0
  private webAudioEl: any = null;
  private nativePlayer: any = null;
  private sleepTimerId: any = null;
  private remainingTimerSeconds: number | null = null;
  private countdownIntervalId: any = null;
  private listeners: Set<StateListener> = new Set();

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = {
      activeSoundscape: this.activeSoundscape,
      isPlaying: this.isPlayingInternal,
      volume: this.volumeInternal,
      remainingTimerSeconds: this.remainingTimerSeconds,
    };
    this.listeners.forEach((l) => l(state));
  }

  getActiveSoundscape(): SoundscapeId | null {
    return this.activeSoundscape;
  }

  isPlaying(): boolean {
    return this.isPlayingInternal;
  }

  getVolume(): number {
    return this.volumeInternal;
  }

  getRemainingTimerSeconds(): number | null {
    return this.remainingTimerSeconds;
  }

  /**
   * Play or toggle the selected soundscape.
   */
  async playSoundscape(id: SoundscapeId, targetVolume?: number): Promise<void> {
    if (targetVolume !== undefined) {
      this.volumeInternal = Math.max(0, Math.min(1, targetVolume));
    }

    // If same soundscape is clicked while playing, toggle pause
    if (this.activeSoundscape === id && this.isPlayingInternal) {
      this.pause();
      return;
    }

    // Stop prior playback
    this.stopPlaybackInternal();

    this.activeSoundscape = id;
    this.isPlayingInternal = true;
    const info = SOUNDSCAPES[id];

    // 1. Web driver: use WebAudioEngine for zero-network, zero-error procedural soundscapes
    if (typeof window !== 'undefined') {
      try {
        const played = WebAudioEngine.play(id, this.volumeInternal);
        if (played) {
          this.notify();
          return;
        }
      } catch (err) {
        console.warn('WebAudioEngine failed, trying fallback:', err);
      }
    }

    // 2. Native driver (expo-audio / expo-av dynamic require)
    try {
      const ExpoAudio = require('expo-audio');
      if (ExpoAudio && ExpoAudio.createAudioPlayer) {
        const player = ExpoAudio.createAudioPlayer({ uri: info.sourceUrl });
        player.loop = true;
        player.volume = this.volumeInternal;
        player.play();
        this.nativePlayer = player;
        this.notify();
        return;
      }
    } catch {
      // Fallback: check expo-av if present
      try {
        const { Audio } = require('expo-av');
        if (Audio) {
          const { sound } = await Audio.Sound.createAsync(
            { uri: info.sourceUrl },
            { shouldPlay: true, isLooping: true, volume: this.volumeInternal }
          );
          this.nativePlayer = sound;
          this.notify();
          return;
        }
      } catch {}
    }

    this.notify();
  }

  /**
   * Pause ambient audio.
   */
  pause(): void {
    this.isPlayingInternal = false;

    if (typeof window !== 'undefined') {
      WebAudioEngine.stop();
    }

    if (this.webAudioEl) {
      try {
        this.webAudioEl.pause();
      } catch {}
    }

    if (this.nativePlayer) {
      try {
        if (typeof this.nativePlayer.pause === 'function') {
          this.nativePlayer.pause();
        } else if (typeof this.nativePlayer.pauseAsync === 'function') {
          this.nativePlayer.pauseAsync();
        }
      } catch {}
    }

    this.notify();
  }

  /**
   * Resume paused ambient audio.
   */
  resume(): void {
    if (!this.activeSoundscape) return;
    this.isPlayingInternal = true;

    if (typeof window !== 'undefined') {
      WebAudioEngine.play(this.activeSoundscape, this.volumeInternal);
    }

    if (this.webAudioEl) {
      try {
        this.webAudioEl.play();
      } catch {}
    }

    if (this.nativePlayer) {
      try {
        if (typeof this.nativePlayer.play === 'function') {
          this.nativePlayer.play();
        } else if (typeof this.nativePlayer.playAsync === 'function') {
          this.nativePlayer.playAsync();
        }
      } catch {}
    }

    this.notify();
  }

  /**
   * Stop ambient soundscape completely.
   */
  stop(): void {
    this.stopPlaybackInternal();
    this.activeSoundscape = null;
    this.clearSleepTimer();
    this.notify();
  }

  private stopPlaybackInternal(): void {
    this.isPlayingInternal = false;

    if (typeof window !== 'undefined') {
      WebAudioEngine.stop();
    }

    if (this.webAudioEl) {
      try {
        this.webAudioEl.pause();
        this.webAudioEl.src = '';
      } catch {}
      this.webAudioEl = null;
    }

    if (this.nativePlayer) {
      try {
        if (typeof this.nativePlayer.stop === 'function') {
          this.nativePlayer.stop();
        } else if (typeof this.nativePlayer.stopAsync === 'function') {
          this.nativePlayer.stopAsync();
        }
      } catch {}
      this.nativePlayer = null;
    }
  }

  /**
   * Set ambient audio volume (0.0 to 1.0).
   */
  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.volumeInternal = clamped;

    if (typeof window !== 'undefined') {
      WebAudioEngine.setVolume(clamped);
    }

    if (this.webAudioEl) {
      this.webAudioEl.volume = clamped;
    }

    if (this.nativePlayer) {
      try {
        if (typeof this.nativePlayer.setVolume === 'function') {
          this.nativePlayer.setVolume(clamped);
        } else if (typeof this.nativePlayer.setVolumeAsync === 'function') {
          this.nativePlayer.setVolumeAsync(clamped);
        }
      } catch {}
    }

    this.notify();
  }

  /**
   * Set a sleep timer in minutes (e.g. 15, 30, 45, 60, or null to cancel).
   */
  setSleepTimer(minutes: number | null): void {
    this.clearSleepTimer();

    if (!minutes || minutes <= 0) {
      this.remainingTimerSeconds = null;
      this.notify();
      return;
    }

    this.remainingTimerSeconds = minutes * 60;
    this.notify();

    this.countdownIntervalId = setInterval(() => {
      if (this.remainingTimerSeconds !== null && this.remainingTimerSeconds > 0) {
        this.remainingTimerSeconds -= 1;
        this.notify();
      } else {
        this.stop();
      }
    }, 1000);

    this.sleepTimerId = setTimeout(() => {
      this.stop();
    }, minutes * 60 * 1000);
  }

  clearSleepTimer(): void {
    if (this.sleepTimerId) {
      clearTimeout(this.sleepTimerId);
      this.sleepTimerId = null;
    }
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
    this.remainingTimerSeconds = null;
  }
}

export const AmbientService = new AmbientAudioService();
