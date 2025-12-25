// Procedural Sound Synthesizer
// Generates game sounds using Web Audio API without needing external assets

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized = false;
  public muted = false;

  constructor() {
    // AudioContext must be initialized after a user interaction
    // We'll init it lazily or explicitly
  }

  public toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) {
        this.masterGain.gain.value = this.muted ? 0 : 0.5;
    }
  }

  public init() {
    if (this.initialized) return;
    
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5; // Master volume
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.error('Web Audio API not supported', e);
    }
  }

  // Resume context if suspended (browser policy)
  public async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // Play a silent note to unlock AudioContext on iOS/Chrome
  public warmup() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    gain.gain.value = 0.001; // Almost silent
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // 🎵 Slice Sound (High pitched noise + sine sweep)
  public playSlice() {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // White noise buffer for "tearing" sound
    const bufferSize = this.ctx.sampleRate * 0.1; // 0.1s
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    
    // Envelope
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    noiseGain.gain.setValueAtTime(0.3, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    // Filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1000, t);
    filter.frequency.exponentialRampToValueAtTime(5000, t + 0.1);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);

    osc.connect(gain);
    noise.connect(filter);
    filter.connect(noiseGain);
    
    gain.connect(this.masterGain);
    noiseGain.connect(this.masterGain);

    osc.start(t);
    noise.start(t);
    osc.stop(t + 0.1);
    noise.stop(t + 0.1);
  }

  // 🎵 Combo Sound (Musical chord based on combo count)
  public playCombo(count: number) {
    if (!this.ctx || !this.masterGain) return;
    
    const t = this.ctx.currentTime;
    
    // Pentatonic scale frequencies
    const baseFreq = 440; // A4
    const scale = [1, 1.125, 1.25, 1.5, 1.66]; // Approx ratios for Major Pentatonic
    const noteIndex = (count - 1) % scale.length;
    const octave = Math.floor((count - 1) / scale.length) + 1;
    
    const freq = baseFreq * scale[noteIndex] * (0.5 + (octave * 0.5));

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.5);
  }

  // 🎵 Bomb Explosion (Low noise + impact)
  public playBomb() {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    
    // Noise burst
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.4);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.5);
  }

  // 🎵 Swoosh (Filtered noise for movement)
  public playSwoosh() {
    if (!this.ctx || !this.masterGain) return;
    
    // Rate limit swooshes
    if (Math.random() > 0.3) return; 

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Use a low sine wave for "air" sound
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.linearRampToValueAtTime(200, t + 0.1);

    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }
  
  // 🎵 Game Over (Descending chime)
  public playGameOver() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    
    [440, 415, 392, 370].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = t + i * 0.2;
        
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.5);
        
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(start);
        osc.stop(start + 0.5);
    });
  }
}

export const soundManager = new SoundManager();
