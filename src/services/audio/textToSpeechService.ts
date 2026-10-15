/**
 * Text-to-Speech (TTS) Service
 * Universal narration engine supporting Expo Speech (native) and Web SpeechSynthesis (web).
 */

export interface TTSOptions {
  rate?: number; // 0.5 to 2.0 (default 1.0)
  pitch?: number; // 0.5 to 2.0 (default 1.0)
  voice?: string;
  language?: string; // e.g. 'en-US'
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: any) => void;
}

export interface VoiceOption {
  identifier: string;
  name: string;
  language: string;
}

class TextToSpeechService {
  private isSpeakingInternal = false;
  private isPausedInternal = false;
  private currentUtteranceText = '';
  private currentOptions: TTSOptions = {};
  private activeWebUtterance: any = null;

  /**
   * Strips markdown, HTML tags, page headers and artifacts for smooth audio narration.
   */
  cleanTextForSpeech(rawText: string): string {
    if (!rawText) return '';

    return rawText
      // Remove HTML tags
      .replace(/<[^>]*>/g, ' ')
      // Remove markdown headings, bold, italics, links
      .replace(/#+\s+/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove page boundary marks e.g. --- Page 1 ---
      .replace(/---+/g, ' ')
      // Normalize extra spaces and line breaks
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if speech is currently playing.
   */
  isSpeaking(): boolean {
    return this.isSpeakingInternal;
  }

  /**
   * Check if speech is paused.
   */
  isPaused(): boolean {
    return this.isPausedInternal;
  }

  /**
   * Speak the provided text aloud.
   */
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    const cleaned = this.cleanTextForSpeech(text);
    if (!cleaned) return;

    this.stop();
    this.currentUtteranceText = cleaned;
    this.currentOptions = options;
    this.isSpeakingInternal = true;
    this.isPausedInternal = false;

    options.onStart?.();

    // 1. Web SpeechSynthesis driver
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const utterance = new window.SpeechSynthesisUtterance(cleaned);
        this.activeWebUtterance = utterance;

        if (options.rate) utterance.rate = Math.max(0.5, Math.min(2.0, options.rate));
        if (options.pitch) utterance.pitch = Math.max(0.5, Math.min(2.0, options.pitch));
        if (options.language) utterance.lang = options.language;

        if (options.voice) {
          const voices = window.speechSynthesis.getVoices();
          const matched = voices.find((v) => v.name === options.voice || v.voiceURI === options.voice);
          if (matched) utterance.voice = matched;
        }

        utterance.onend = () => {
          this.isSpeakingInternal = false;
          this.isPausedInternal = false;
          this.activeWebUtterance = null;
          options.onDone?.();
        };

        utterance.onerror = (e) => {
          // If stopped manually, don't report as critical error
          if (e.error === 'interrupted' || e.error === 'canceled') {
            this.isSpeakingInternal = false;
            this.isPausedInternal = false;
            options.onStopped?.();
            return;
          }
          this.isSpeakingInternal = false;
          this.isPausedInternal = false;
          options.onError?.(e);
        };

        window.speechSynthesis.speak(utterance);
        return;
      } catch (err) {
        console.warn('Web SpeechSynthesis error, falling back:', err);
      }
    }

    // 2. Native Expo Speech driver
    try {
      // Dynamic import to handle environments where expo-speech is loading
      const ExpoSpeech = require('expo-speech');
      if (ExpoSpeech && ExpoSpeech.speak) {
        ExpoSpeech.speak(cleaned, {
          rate: options.rate ?? 1.0,
          pitch: options.pitch ?? 1.0,
          language: options.language ?? 'en',
          voice: options.voice,
          onDone: () => {
            this.isSpeakingInternal = false;
            this.isPausedInternal = false;
            options.onDone?.();
          },
          onStopped: () => {
            this.isSpeakingInternal = false;
            this.isPausedInternal = false;
            options.onStopped?.();
          },
          onError: (err: any) => {
            this.isSpeakingInternal = false;
            this.isPausedInternal = false;
            options.onError?.(err);
          },
        });
        return;
      }
    } catch {
      // expo-speech not available yet in current bundle
      console.warn('Native Speech module not ready, simulated playback complete.');
    }

    // Fallback completion
    setTimeout(() => {
      if (this.isSpeakingInternal) {
        this.isSpeakingInternal = false;
        options.onDone?.();
      }
    }, 2000);
  }

  /**
   * Stop current speech playback immediately.
   */
  stop(): void {
    this.isSpeakingInternal = false;
    this.isPausedInternal = false;

    // Web stop
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    // Native stop
    try {
      const ExpoSpeech = require('expo-speech');
      if (ExpoSpeech && ExpoSpeech.stop) {
        ExpoSpeech.stop();
      }
    } catch {}

    this.currentOptions.onStopped?.();
  }

  /**
   * Pause ongoing speech playback.
   */
  pause(): void {
    if (!this.isSpeakingInternal) return;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.pause();
        this.isPausedInternal = true;
        return;
      } catch {}
    }

    try {
      const ExpoSpeech = require('expo-speech');
      if (ExpoSpeech && ExpoSpeech.pause) {
        ExpoSpeech.pause();
        this.isPausedInternal = true;
      }
    } catch {}
  }

  /**
   * Resume paused speech playback.
   */
  resume(): void {
    if (!this.isPausedInternal) return;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
        this.isPausedInternal = false;
        return;
      } catch {}
    }

    try {
      const ExpoSpeech = require('expo-speech');
      if (ExpoSpeech && ExpoSpeech.resume) {
        ExpoSpeech.resume();
        this.isPausedInternal = false;
      }
    } catch {}
  }

  /**
   * Fetch available voices on the current device.
   */
  async getAvailableVoices(): Promise<VoiceOption[]> {
    // Web voices
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        return voices.map((v) => ({
          identifier: v.voiceURI || v.name,
          name: v.name,
          language: v.lang,
        }));
      }
    }

    // Native voices
    try {
      const ExpoSpeech = require('expo-speech');
      if (ExpoSpeech && ExpoSpeech.getAvailableVoicesAsync) {
        const nativeVoices = await ExpoSpeech.getAvailableVoicesAsync();
        return nativeVoices.map((v: any) => ({
          identifier: v.identifier,
          name: v.name,
          language: v.language,
        }));
      }
    } catch {}

    return [
      { identifier: 'default', name: 'Default Narrator', language: 'en-US' },
    ];
  }
}

export const TTSService = new TextToSpeechService();
