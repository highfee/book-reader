/**
 * Web Audio Ambient Synthesizer
 * Generates pure, offline, procedural soundscapes using the Web Audio API.
 * Zero network dependencies, zero 404s, zero CORS errors, seamless infinite looping.
 */

export class WebAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentStopFn: (() => void) | null = null;
  private volume: number = 0.6;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  stop(): void {
    if (this.currentStopFn) {
      try {
        this.currentStopFn();
      } catch {}
      this.currentStopFn = null;
    }
    this.masterGain = null;
  }

  /**
   * Play procedural soundscape by ID
   */
  play(soundscapeId: string, initialVolume: number = 0.6): boolean {
    const ctx = this.getAudioContext();
    if (!ctx) return false;

    this.stop();
    this.volume = initialVolume;

    // Create master gain
    const master = ctx.createGain();
    master.gain.setValueAtTime(this.volume, ctx.currentTime);
    master.connect(ctx.destination);
    this.masterGain = master;

    switch (soundscapeId) {
      case 'brown_noise':
        return this.playBrownNoise(ctx, master);
      case 'rain':
        return this.playRain(ctx, master);
      case 'waves':
        return this.playOceanWaves(ctx, master);
      case 'fireplace':
        return this.playFireplace(ctx, master);
      case 'forest':
        return this.playForest(ctx, master);
      case 'cafe':
        return this.playCafe(ctx, master);
      case 'thunderstorm':
        return this.playThunderstorm(ctx, master);
      case 'night_crickets':
        return this.playNightCrickets(ctx, master);
      case 'clock_tower':
        return this.playClock(ctx, master);
      case 'vintage_train':
        return this.playTrain(ctx, master);
      case 'blizzard':
        return this.playBlizzard(ctx, master);
      case 'zen_bowls':
        return this.playZenBowls(ctx, master);
      default:
        return this.playBrownNoise(ctx, master);
    }
  }

  /**
   * Brown Noise: Deep, warm, relaxing low frequency focus sound
   */
  private playBrownNoise(ctx: AudioContext, destination: AudioNode): boolean {
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      output[i] = lastOut * 3.2;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = buffer;
    whiteNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(destination);
    whiteNoise.start(0);

    this.currentStopFn = () => {
      try {
        whiteNoise.stop();
        whiteNoise.disconnect();
      } catch {}
    };
    return true;
  }

  /**
   * Gentle Rain: Filtered pink noise + randomized rain drops
   */
  private playRain(ctx: AudioContext, destination: AudioNode): boolean {
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const rainNoise = ctx.createBufferSource();
    rainNoise.buffer = buffer;
    rainNoise.loop = true;

    // Resonant bandpass filter to sound like rain on window
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, ctx.currentTime);

    rainNoise.connect(filter);
    filter.connect(destination);
    rainNoise.start(0);

    this.currentStopFn = () => {
      try {
        rainNoise.stop();
        rainNoise.disconnect();
      } catch {}
    };
    return true;
  }

  /**
   * Ocean Waves: Low-frequency undulating swells of surf
   */
  private playOceanWaves(ctx: AudioContext, destination: AudioNode): boolean {
    const bufferSize = ctx.sampleRate * 5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.03 * white) / 1.03;
      data[i] = lastOut * 3.5;
    }

    const surfSource = ctx.createBufferSource();
    surfSource.buffer = buffer;
    surfSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, ctx.currentTime);

    // LFO to create swelling wave rhythm (0.12 Hz ~ 8 seconds per wave cycle)
    const waveGain = ctx.createGain();
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, ctx.currentTime);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.45, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(waveGain.gain);

    surfSource.connect(filter);
    filter.connect(waveGain);
    waveGain.connect(destination);

    surfSource.start(0);
    lfo.start(0);

    this.currentStopFn = () => {
      try {
        surfSource.stop();
        lfo.stop();
        surfSource.disconnect();
        lfo.disconnect();
      } catch {}
    };
    return true;
  }

  /**
   * Library Hearth & Fireplace: Low warm rumble with crackling wood embers
   */
  private playFireplace(ctx: AudioContext, destination: AudioNode): boolean {
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Gentle rumble
      lastOut = (lastOut + 0.015 * white) / 1.015;
      let sample = lastOut * 2.8;

      // Random sharp wood crackle impulses
      if (Math.random() < 0.0006) {
        sample += (Math.random() * 2 - 1) * 2.2;
      }
      data[i] = sample;
    }

    const fireSource = ctx.createBufferSource();
    fireSource.buffer = buffer;
    fireSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(550, ctx.currentTime);

    fireSource.connect(filter);
    filter.connect(destination);
    fireSource.start(0);

    this.currentStopFn = () => {
      try {
        fireSource.stop();
        fireSource.disconnect();
      } catch {}
    };
    return true;
  }

  /**
   * Deep Forest: Gentle ambient wind with soft high-frequency rustle
   */
  private playForest(ctx: AudioContext, destination: AudioNode): boolean {
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 2.4;
    }

    const windSource = ctx.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(380, ctx.currentTime);
    filter.Q.setValueAtTime(1.8, ctx.currentTime);

    windSource.connect(filter);
    filter.connect(destination);
    windSource.start(0);

    this.currentStopFn = () => {
      try {
        windSource.stop();
        windSource.disconnect();
      } catch {}
    };
    return true;
  }

  /**
   * Parisian Café: Mellow background hum
   */
  private playCafe(ctx: AudioContext, destination: AudioNode): boolean {
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.025 * white) / 1.025;
      data[i] = lastOut * 2.5;
    }

    const cafeSource = ctx.createBufferSource();
    cafeSource.buffer = buffer;
    cafeSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, ctx.currentTime);

    cafeSource.connect(filter);
    filter.connect(destination);
    cafeSource.start(0);

    this.currentStopFn = () => {
      try {
        cafeSource.stop();
        cafeSource.disconnect();
      } catch {}
    };
    return true;
  }

  /**
   * Distant Thunder: Heavy rain with low rolling thunder swells
   */
  private playThunderstorm(ctx: AudioContext, destination: AudioNode): boolean {
    const bufferSize = ctx.sampleRate * 4;
    const rainBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const rainData = rainBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.03 * white) / 1.03;
      rainData[i] = lastOut * 2.8;
    }

    const rainSource = ctx.createBufferSource();
    rainSource.buffer = rainBuffer;
    rainSource.loop = true;

    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.setValueAtTime(800, ctx.currentTime);

    // Deep thunder rumble layer
    const thunderSize = ctx.sampleRate * 6;
    const thunderBuffer = ctx.createBuffer(1, thunderSize, ctx.sampleRate);
    const thunderData = thunderBuffer.getChannelData(0);
    let tLast = 0.0;
    for (let i = 0; i < thunderSize; i++) {
      const white = Math.random() * 2 - 1;
      tLast = (tLast + 0.008 * white) / 1.008;
      thunderData[i] = tLast * 4.5;
    }

    const thunderSource = ctx.createBufferSource();
    thunderSource.buffer = thunderBuffer;
    thunderSource.loop = true;

    const thunderFilter = ctx.createBiquadFilter();
    thunderFilter.type = 'lowpass';
    thunderFilter.frequency.setValueAtTime(85, ctx.currentTime);
    thunderFilter.Q.setValueAtTime(3.0, ctx.currentTime);

    const thunderGain = ctx.createGain();
    thunderGain.gain.setValueAtTime(0.5, ctx.currentTime);

    // LFO to create rolling swells
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.06, ctx.currentTime);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.35, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(thunderGain.gain);

    rainSource.connect(rainFilter);
    rainFilter.connect(destination);

    thunderSource.connect(thunderFilter);
    thunderFilter.connect(thunderGain);
    thunderGain.connect(destination);

    rainSource.start(0);
    thunderSource.start(0);
    lfo.start(0);

    this.currentStopFn = () => {
      try {
        rainSource.stop();
        thunderSource.stop();
        lfo.stop();
        rainSource.disconnect();
        thunderSource.disconnect();
        lfo.disconnect();
      } catch {}
    };
    return true;
  }

  /**
   * Summer Night: Soft evening air with gentle cricket chirps
   */
  private playNightCrickets(ctx: AudioContext, destination: AudioNode): boolean {
    // Soft night air background
    const bgSize = ctx.sampleRate * 3;
    const bgBuffer = ctx.createBuffer(1, bgSize, ctx.sampleRate);
    const bgData = bgBuffer.getChannelData(0);
    let last = 0.0;
    for (let i = 0; i < bgSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.015 * white) / 1.015;
      bgData[i] = last * 1.4;
    }

    const bgSource = ctx.createBufferSource();
    bgSource.buffer = bgBuffer;
    bgSource.loop = true;

    const bgFilter = ctx.createBiquadFilter();
    bgFilter.type = 'lowpass';
    bgFilter.frequency.setValueAtTime(220, ctx.currentTime);

    // Crickets synth (high-frequency oscillator with tremolo flutter)
    const cricketOsc = ctx.createOscillator();
    cricketOsc.type = 'sine';
    cricketOsc.frequency.setValueAtTime(4600, ctx.currentTime);

    const tremolo = ctx.createOscillator();
    tremolo.type = 'sawtooth';
    tremolo.frequency.setValueAtTime(14, ctx.currentTime);

    const tremoloGain = ctx.createGain();
    tremoloGain.gain.setValueAtTime(0.08, ctx.currentTime);

    const cricketMasterGain = ctx.createGain();
    cricketMasterGain.gain.setValueAtTime(0.06, ctx.currentTime);

    tremolo.connect(tremoloGain);
    tremoloGain.connect(cricketMasterGain.gain);

    cricketOsc.connect(cricketMasterGain);

    bgSource.connect(bgFilter);
    bgFilter.connect(destination);
    cricketMasterGain.connect(destination);

    bgSource.start(0);
    cricketOsc.start(0);
    tremolo.start(0);

    this.currentStopFn = () => {
      try {
        bgSource.stop();
        cricketOsc.stop();
        tremolo.stop();
        bgSource.disconnect();
        cricketOsc.disconnect();
        tremolo.disconnect();
      } catch {}
    };
    return true;
  }

  /**
   * Library Clock: Antique wooden pendulum ticking
   */
  private playClock(ctx: AudioContext, destination: AudioNode): boolean {
    // 2-second looped buffer: tick at 0.0s, tock at 1.0s
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Render "Tick" (820Hz impulse with 0.035s exponential decay) at t=0
    const tickLen = Math.floor(ctx.sampleRate * 0.035);
    for (let i = 0; i < tickLen; i++) {
      const t = i / ctx.sampleRate;
      const decay = Math.exp(-i / (ctx.sampleRate * 0.007));
      data[i] = Math.sin(2 * Math.PI * 820 * t) * decay * 0.7;
    }

    // Render "Tock" (660Hz impulse with 0.035s exponential decay) at t=1.0s
    const tockStart = ctx.sampleRate * 1;
    for (let i = 0; i < tickLen; i++) {
      const t = i / ctx.sampleRate;
      const decay = Math.exp(-i / (ctx.sampleRate * 0.007));
      data[tockStart + i] = Math.sin(2 * Math.PI * 660 * t) * decay * 0.6;
    }

    // Add very faint wood room warmth
    for (let i = 0; i < length; i++) {
      data[i] += (Math.random() * 2 - 1) * 0.006;
    }

    const clockSource = ctx.createBufferSource();
    clockSource.buffer = buffer;
    clockSource.loop = true;

    const clockFilter = ctx.createBiquadFilter();
    clockFilter.type = 'lowpass';
    clockFilter.frequency.setValueAtTime(1400, ctx.currentTime);

    clockSource.connect(clockFilter);
    clockFilter.connect(destination);
    clockSource.start(0);

    this.currentStopFn = () => {
      try {
        clockSource.stop();
        clockSource.disconnect();
      } catch {}
    };
    return true;
  }

  /**
   * Vintage Rail: Hypnotic iron rail rhythm and low mechanical roll
   */
  private playTrain(ctx: AudioContext, destination: AudioNode): boolean {
    // 2.4-second looped train cadence buffer (click-clack ... click-clack)
    const length = Math.floor(ctx.sampleRate * 2.4);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Continuous rail friction rumble
    let rLast = 0.0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      rLast = (rLast + 0.02 * white) / 1.02;
      data[i] = rLast * 0.6;
    }

    // Add click-clack pulses
    const addImpulse = (startSample: number, freq: number, amp: number) => {
      const impLen = Math.floor(ctx.sampleRate * 0.04);
      for (let i = 0; i < impLen && startSample + i < length; i++) {
        const t = i / ctx.sampleRate;
        const decay = Math.exp(-i / (ctx.sampleRate * 0.009));
        data[startSample + i] += Math.sin(2 * Math.PI * freq * t) * decay * amp;
      }
    };

    // Cycle: 0.0s "ta", 0.18s "tum", 1.2s "ta", 1.38s "tum"
    addImpulse(0, 520, 0.45);
    addImpulse(Math.floor(ctx.sampleRate * 0.18), 440, 0.4);
    addImpulse(Math.floor(ctx.sampleRate * 1.2), 520, 0.42);
    addImpulse(Math.floor(ctx.sampleRate * 1.38), 440, 0.38);

    const trainSource = ctx.createBufferSource();
    trainSource.buffer = buffer;
    trainSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, ctx.currentTime);

    trainSource.connect(filter);
    filter.connect(destination);
    trainSource.start(0);

    this.currentStopFn = () => {
      try {
        trainSource.stop();
        trainSource.disconnect();
      } catch {}
    };
    return true;
  }

  /**
   * Winter Blizzard: Howling mountain snowstorm wind against window
   */
  private playBlizzard(ctx: AudioContext, destination: AudioNode): boolean {
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.8;
    }

    const windSource = ctx.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;

    // Resonant bandpass filter that sweeps like howling wind
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, ctx.currentTime);
    filter.Q.setValueAtTime(2.8, ctx.currentTime);

    // LFO to sweep wind howling frequency
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.08, ctx.currentTime);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(180, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    windSource.connect(filter);
    filter.connect(destination);

    windSource.start(0);
    lfo.start(0);

    this.currentStopFn = () => {
      try {
        windSource.stop();
        lfo.stop();
        windSource.disconnect();
        lfo.disconnect();
      } catch {}
    };
    return true;
  }

  /**
   * Zen Bowls: Meditative singing bowls with soothing acoustic binaural drone
   */
  private playZenBowls(ctx: AudioContext, destination: AudioNode): boolean {
    // 432 Hz fundamental + 434.2 Hz binaural pair (creates gentle 2.2 Hz relaxation beat)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(432.0, ctx.currentTime);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(434.2, ctx.currentTime);

    // Soft overtone
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(864.0, ctx.currentTime);

    // Slow breath modulation (14-second cycle)
    const breathLfo = ctx.createOscillator();
    breathLfo.type = 'sine';
    breathLfo.frequency.setValueAtTime(0.07, ctx.currentTime);

    const breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(0.08, ctx.currentTime);
    breathLfo.connect(breathGain);

    const bowlMaster = ctx.createGain();
    bowlMaster.gain.setValueAtTime(0.12, ctx.currentTime);
    breathGain.connect(bowlMaster.gain);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.03, ctx.currentTime);
    osc3.connect(overtoneGain);

    osc1.connect(bowlMaster);
    osc2.connect(bowlMaster);
    overtoneGain.connect(bowlMaster);
    bowlMaster.connect(destination);

    osc1.start(0);
    osc2.start(0);
    osc3.start(0);
    breathLfo.start(0);

    this.currentStopFn = () => {
      try {
        osc1.stop();
        osc2.stop();
        osc3.stop();
        breathLfo.stop();
        osc1.disconnect();
        osc2.disconnect();
        osc3.disconnect();
        breathLfo.disconnect();
      } catch {}
    };
    return true;
  }
}

export const WebAudioEngine = new WebAudioSynthesizer();
