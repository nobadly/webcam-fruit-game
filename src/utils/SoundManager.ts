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

  // 🎵 BGM (Taiko Style Procedural Drum Loop)
  private bgmNodes: AudioScheduledSourceNode[] = [];
  private nextNoteTime: number = 0;
  private isPlayingBgm = false;
  private tempo = 120;
  private lookahead = 25.0; // ms
  private scheduleAheadTime = 0.1; // s
  private timerID: number | null = null;

  public playBGM() {
    if (this.isPlayingBgm || !this.ctx) return;
    this.isPlayingBgm = true;
    this.nextNoteTime = this.ctx.currentTime;
    this.scheduler();
  }

  public stopBGM() {
    this.isPlayingBgm = false;
    if (this.timerID) {
      window.clearTimeout(this.timerID);
      this.timerID = null;
    }
    this.bgmNodes.forEach(node => {
        try { node.stop(); } catch(e) {}
    });
    this.bgmNodes = [];
  }

  private scheduler() {
    if (!this.isPlayingBgm || !this.ctx) return;
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.nextNoteTime);
      this.nextNoteTime += (60.0 / this.tempo) * 0.5; // 8th notes
    }
    this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
  }

  private beatCount = 0;
  private scheduleNote(time: number) {
     if (!this.ctx || !this.masterGain) return;
     
     // Simple Taiko Pattern: Don Don Ka Don
     // 0: Don
     // 1: -
     // 2: Don
     // 3: -
     // 4: Ka
     // 5: -
     // 6: Don
     // 7: Ka
     
     const beat = this.beatCount % 8;
     this.beatCount++;

     if (beat === 0 || beat === 2 || beat === 6) {
         this.playDrum(time, 'don');
     } else if (beat === 4 || beat === 7) {
         this.playDrum(time, 'ka');
     }
  }

  private playDrum(time: number, type: 'don' | 'ka') {
      if (!this.ctx || !this.masterGain) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      if (type === 'don') {
          // Low thud
          osc.frequency.setValueAtTime(150, time);
          osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
          gain.gain.setValueAtTime(0.8, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
      } else {
          // High rim shot
          osc.type = 'square';
          osc.frequency.setValueAtTime(800, time);
          osc.frequency.exponentialRampToValueAtTime(100, time + 0.1);
          gain.gain.setValueAtTime(0.3, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
      }

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + 0.5);
      
      this.bgmNodes.push(osc);
      // Cleanup old nodes occasionally or let GC handle simple ones? 
      // Web Audio nodes are GC'd when finished and disconnected.
      // We keep ref to stop them if needed, but we should clear list.
      if (this.bgmNodes.length > 20) this.bgmNodes.shift();
  }

  // 🎵 Slice Sound (High pitched noise + sine sweep)
  public playSlice(fruitType: string = 'default') {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Customize based on fruit
    let baseFreq = 800;
    let endFreq = 100;
    let noiseDur = 0.1;
    let pitchDecay = 0.1;

    if (fruitType === 'watermelon') {
        baseFreq = 400;
        endFreq = 50;
        noiseDur = 0.15;
    } else if (fruitType === 'grape') {
        baseFreq = 1200;
        endFreq = 300;
        noiseDur = 0.05;
    } else if (fruitType === 'banana') {
        // Squishy
        baseFreq = 600;
        endFreq = 200;
        osc.type = 'triangle';
    }

    // White noise buffer for "tearing" sound
    const bufferSize = this.ctx.sampleRate * noiseDur;
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
    gain.gain.exponentialRampToValueAtTime(0.01, t + pitchDecay);

    noiseGain.gain.setValueAtTime(0.3, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + noiseDur);

    // Filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1000, t);
    filter.frequency.exponentialRampToValueAtTime(5000, t + noiseDur);

    if (osc.type !== 'triangle') osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + pitchDecay);

    osc.connect(gain);
    noise.connect(filter);
    filter.connect(noiseGain);
    
    gain.connect(this.masterGain);
    noiseGain.connect(this.masterGain);

    osc.start(t);
    noise.start(t);
    osc.stop(t + Math.max(pitchDecay, noiseDur));
    noise.stop(t + Math.max(pitchDecay, noiseDur));
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
  public playSwoosh(speed: number = 1.0) {
    if (!this.ctx || !this.masterGain) return;
    
    // Rate limit swooshes based on speed? Higher speed = more likely?
    // Let caller handle probability or just keep it here
    if (Math.random() > 0.5) return; 

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Use a low sine wave for "air" sound
    osc.type = 'triangle';
    
    // Pitch depends on speed (clamped)
    // Base 100Hz, add up to 300Hz based on speed
    const basePitch = 100 + Math.min(speed * 10, 300);
    
    osc.frequency.setValueAtTime(basePitch, t);
    osc.frequency.linearRampToValueAtTime(basePitch + 100, t + 0.1);

    gain.gain.setValueAtTime(0.1 + Math.min(speed * 0.05, 0.2), t);
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
