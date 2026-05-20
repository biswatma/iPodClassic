/* ==========================================================================
   iPod Audio Engine (Tick Synth, Chiptune Sequencer, & MP3 Player)
   ========================================================================== */

class IpodAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.clickerSoundEnabled = true;

    // Music playback state
    this.currentTrack = null;
    this.isPlaying = false;
    this.volume = 0.5; // 0.0 to 1.0

    // Local library songs
    this.library = [];
    this.builtInTracks = [];

    // Chiptune synthesizer playback state
    this.seqTimer = null;
    this.seqNotes = [];
    this.seqNextNoteIndex = 0;
    this.seqTempo = 120;
    this.seqStartTime = 0;
    this.seqIsLooping = true;
    this.activeSynthNodes = [];

    // HTML5 Audio element for MP3 files
    this.audioElement = new Audio();
    this.audioSourceNode = null;

    // Progress tracking callback
    this.onProgressCallback = null;
    this.onTrackEndedCallback = null;

    this.initBuiltInTracks();
    this.setupAudioElement();
  }

  // Lazy-load AudioContext on user interaction to comply with browser autoplay policies
  initContext() {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);

      // Connect HTML5 Audio element to Web Audio graph for shared volume and analysis
      this.audioSourceNode = this.ctx.createMediaElementSource(this.audioElement);
      this.audioSourceNode.connect(this.masterGain);
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  setupAudioElement() {
    this.audioElement.addEventListener('timeupdate', () => {
      if (this.onProgressCallback && this.currentTrack && !this.currentTrack.isSynth) {
        this.onProgressCallback(this.audioElement.currentTime, this.audioElement.duration || 0);
      }
    });

    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
      if (this.onTrackEndedCallback) {
        this.onTrackEndedCallback();
      }
    });
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    this.audioElement.volume = 1.0; // keep element at full volume since masterGain handles it
  }

  getVolume() {
    return this.volume;
  }

  toggleClicker(enable) {
    this.clickerSoundEnabled = enable;
  }

  // Synthesize low-latency click/tick using Web Audio
  playTick() {
    if (!this.clickerSoundEnabled) return;
    this.initContext();
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const t = this.ctx.currentTime;
    
    // Create dual-component click (mechanical snap)
    // 1. High-passed short noise burst for the snap texture
    const bufferSize = this.ctx.sampleRate * 0.005; // 5ms
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource(buffer);
    noiseNode.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 6000;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.04, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.004);

    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    // 2. High-pitch transient sine sweep for the clicker impact
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(3200, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.003);

    oscGain.gain.setValueAtTime(0.06, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.003);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    // Play both components instantly
    noiseNode.start(t);
    noiseNode.stop(t + 0.006);
    osc.start(t);
    osc.stop(t + 0.004);
  }

  // Synthesize dynamic button feedback click
  playBtnClick() {
    if (!this.clickerSoundEnabled) return;
    this.initContext();
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.015);

    oscGain.gain.setValueAtTime(0.08, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.02);
  }

  // Set up three dynamic retro chiptune synth covers (represented as note arrays)
  initBuiltInTracks() {
    const C = (octave) => 440 * Math.pow(2, (12 * (octave - 4) - 9) / 12);
    const Csharp = (oct) => 440 * Math.pow(2, (12 * (oct - 4) - 8) / 12);
    const D = (oct) => 440 * Math.pow(2, (12 * (oct - 4) - 7) / 12);
    const Dsharp = (oct) => 440 * Math.pow(2, (12 * (oct - 4) - 6) / 12);
    const E = (oct) => 440 * Math.pow(2, (12 * (oct - 4) - 5) / 12);
    const F = (oct) => 440 * Math.pow(2, (12 * (oct - 4) - 4) / 12);
    const Fsharp = (oct) => 440 * Math.pow(2, (12 * (oct - 4) - 3) / 12);
    const G = (oct) => 440 * Math.pow(2, (12 * (oct - 4) - 2) / 12);
    const Gsharp = (oct) => 440 * Math.pow(2, (12 * (oct - 4) - 1) / 12);
    const A = (oct) => 440 * Math.pow(2, (12 * (oct - 4)) / 12);
    const Asharp = (oct) => 440 * Math.pow(2, (12 * (oct - 4) + 1) / 12);
    const B = (oct) => 440 * Math.pow(2, (12 * (oct - 4) + 2) / 12);
    const R = 0; // Rest note

    // 1. Daft Punk - One More Time
    const daftMelody = [
      { f: G(4), d: 0.5 }, { f: G(4), d: 0.5 }, { f: B(4), d: 0.5 }, { f: D(5), d: 0.5 },
      { f: C(5), d: 0.5 }, { f: C(5), d: 0.5 }, { f: E(4), d: 0.5 }, { f: G(4), d: 0.5 },
      { f: Fsharp(4), d: 0.5 }, { f: Fsharp(4), d: 0.5 }, { f: A(4), d: 0.5 }, { f: C(5), d: 0.5 },
      { f: B(4), d: 0.5 }, { f: B(4), d: 0.5 }, { f: D(4), d: 0.5 }, { f: Fsharp(4), d: 0.5 },
      
      { f: G(4), d: 0.25 }, { f: B(4), d: 0.25 }, { f: D(5), d: 0.25 }, { f: G(5), d: 0.25 },
      { f: Fsharp(5), d: 0.5 }, { f: D(5), d: 0.5 },
      { f: E(5), d: 0.5 }, { f: C(5), d: 0.5 }, { f: G(4), d: 0.5 }, { f: R, d: 0.5 }
    ];

    // 2. Coldplay - Clocks (The iconic piano arpeggio)
    const clocksArp = [
      // Eb Major (Eb - G - Bb)
      { f: Dsharp(4), d: 0.25 }, { f: G(4), d: 0.25 }, { f: Asharp(4), d: 0.25 },
      { f: Dsharp(4), d: 0.25 }, { f: G(4), d: 0.25 }, { f: Asharp(4), d: 0.25 },
      { f: Dsharp(4), d: 0.25 }, { f: G(4), d: 0.25 },
      
      // Fm7 (F - Ab - C) -> 2 rounds
      { f: F(4), d: 0.25 }, { f: Gsharp(4), d: 0.25 }, { f: C(5), d: 0.25 },
      { f: F(4), d: 0.25 }, { f: Gsharp(4), d: 0.25 }, { f: C(5), d: 0.25 },
      { f: F(4), d: 0.25 }, { f: Gsharp(4), d: 0.25 },
      
      { f: F(4), d: 0.25 }, { f: Gsharp(4), d: 0.25 }, { f: C(5), d: 0.25 },
      { f: F(4), d: 0.25 }, { f: Gsharp(4), d: 0.25 }, { f: C(5), d: 0.25 },
      { f: F(4), d: 0.25 }, { f: Gsharp(4), d: 0.25 },

      // Bb Major (Bb - D - F)
      { f: D(4), d: 0.25 }, { f: F(4), d: 0.25 }, { f: Asharp(4), d: 0.25 },
      { f: D(4), d: 0.25 }, { f: F(4), d: 0.25 }, { f: Asharp(4), d: 0.25 },
      { f: D(4), d: 0.25 }, { f: F(4), d: 0.25 }
    ];

    // 3. Gorillaz - Feel Good Inc. (Bassline and Synth chime)
    const feelGoodBass = [
      { f: Fsharp(2), d: 0.5 }, { f: Fsharp(2), d: 0.5 }, { f: R, d: 0.5 }, { f: Fsharp(2), d: 0.5 },
      { f: Asharp(2), d: 0.5 }, { f: B(2), d: 1.0 }, { f: R, d: 0.5 },
      { f: Csharp(3), d: 0.5 }, { f: Dsharp(3), d: 0.5 }, { f: R, d: 0.5 }, { f: Dsharp(3), d: 0.5 },
      { f: Csharp(3), d: 0.5 }, { f: B(2), d: 1.0 }, { f: R, d: 0.5 }
    ];

    this.builtInTracks = [
      {
        id: 'built-in-daft',
        title: 'One More Time (Synth Retro Cover)',
        artist: 'Daft Punk',
        album: 'Discovery (Synth Edition)',
        duration: daftMelody.reduce((acc, curr) => acc + curr.d, 0) * 0.45,
        isSynth: true,
        notes: daftMelody,
        tempo: 128,
        artLabel: ' Discovery'
      },
      {
        id: 'built-in-clocks',
        title: 'Clocks (Nostalgic 8-Bit Chime)',
        artist: 'Coldplay',
        album: 'A Rush of Blood to the Head',
        duration: clocksArp.reduce((acc, curr) => acc + curr.d, 0) * 0.55 * 8, // loop factor
        isSynth: true,
        notes: clocksArp,
        tempo: 132,
        artLabel: ' Clocks'
      },
      {
        id: 'built-in-gorillaz',
        title: 'Feel Good Inc. (Retro Bassline)',
        artist: 'Gorillaz',
        album: 'Demon Days (8-Bit Remix)',
        duration: feelGoodBass.reduce((acc, curr) => acc + curr.d, 0) * 0.5 * 10,
        isSynth: true,
        notes: feelGoodBass,
        tempo: 139,
        artLabel: ' Demon Days'
      }
    ];

    this.library = [...this.builtInTracks];
  }

  // Load a track from the library into the active player
  loadTrack(track) {
    this.stop();
    this.currentTrack = track;
    this.isPlaying = false;

    if (!track.isSynth) {
      this.audioElement.src = track.src;
      this.audioElement.load();
    }
  }

  play() {
    if (!this.currentTrack) return;
    this.initContext();
    this.isPlaying = true;

    if (this.currentTrack.isSynth) {
      this.playSynthTrack();
    } else {
      this.audioElement.play().catch(err => {
        console.error("Audio playback error", err);
        this.isPlaying = false;
      });
    }
  }

  pause() {
    this.isPlaying = false;
    if (this.currentTrack?.isSynth) {
      this.stopSynthScheduler();
    } else {
      this.audioElement.pause();
    }
  }

  stop() {
    this.isPlaying = false;
    this.stopSynthScheduler();
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
  }

  // Sequencer playback loop for chiptunes
  playSynthTrack() {
    if (!this.ctx) return;
    this.stopSynthScheduler();
    
    this.seqNotes = this.currentTrack.notes;
    this.seqNextNoteIndex = 0;
    this.seqTempo = this.currentTrack.tempo;
    this.seqStartTime = this.ctx.currentTime;
    
    this.scheduler();
  }

  stopSynthScheduler() {
    if (this.seqTimer) {
      clearTimeout(this.seqTimer);
      this.seqTimer = null;
    }
    // Stop any ringing notes
    this.activeSynthNodes.forEach(node => {
      try { node.stop(); } catch (e) {}
    });
    this.activeSynthNodes = [];
  }

  // Precise Web Audio scheduling
  scheduler() {
    if (!this.isPlaying || !this.ctx) return;

    const scheduleAheadTime = 0.15; // Schedule 150ms of notes in advance
    let currentTime = this.ctx.currentTime;

    // Calculate time of notes relative to start
    let accumTime = 0;
    for (let i = 0; i < this.seqNextNoteIndex; i++) {
      // beat duration in seconds = beats * (60 / tempo)
      accumTime += this.seqNotes[i].d * (60 / this.seqTempo);
    }

    let nextNoteTime = this.seqStartTime + accumTime;

    while (nextNoteTime < currentTime + scheduleAheadTime) {
      const note = this.seqNotes[this.seqNextNoteIndex];
      this.scheduleNote(this.seqNextNoteIndex, nextNoteTime, note);
      
      // Advance to next note
      this.seqNextNoteIndex++;
      if (this.seqNextNoteIndex >= this.seqNotes.length) {
        if (this.seqIsLooping) {
          this.seqNextNoteIndex = 0;
          // recalculate start time for the next loop block
          let totalLoopBeats = this.seqNotes.reduce((sum, n) => sum + n.d, 0);
          this.seqStartTime += totalLoopBeats * (60 / this.seqTempo);
        } else {
          this.isPlaying = false;
          if (this.onTrackEndedCallback) {
            setTimeout(() => this.onTrackEndedCallback(), 1000);
          }
          return;
        }
      }

      accumTime = 0;
      for (let i = 0; i < this.seqNextNoteIndex; i++) {
        accumTime += this.seqNotes[i].d * (60 / this.seqTempo);
      }
      nextNoteTime = this.seqStartTime + accumTime;
    }

    // Call dynamic progress updates
    const elapsed = this.ctx.currentTime - this.seqStartTime;
    if (this.onProgressCallback && this.currentTrack) {
      // Loop the duration visually
      const cycle = this.currentTrack.duration;
      this.onProgressCallback(elapsed % cycle, cycle);
    }

    // Run scheduler loop every 50ms
    this.seqTimer = setTimeout(() => this.scheduler(), 50);
  }

  scheduleNote(index, time, note) {
    if (!this.ctx || note.f === 0) return; // Rest note

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Alternate synthesis shapes based on current track for timbre variety
    if (this.currentTrack.id === 'built-in-daft') {
      // Sawtooth lead with filtered brightness
      osc.type = 'sawtooth';
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, time);
      filter.frequency.exponentialRampToValueAtTime(400, time + note.d * (60 / this.seqTempo));
      
      osc.connect(filter);
      filter.connect(gain);
    } else if (this.currentTrack.id === 'built-in-clocks') {
      // Beautiful chime-like triangle wave
      osc.type = 'triangle';
      osc.connect(gain);
    } else {
      // Deep robust square bass
      osc.type = 'square';
      osc.connect(gain);
    }

    osc.frequency.setValueAtTime(note.f, time);

    const duration = note.d * (60 / this.seqTempo);
    gain.gain.setValueAtTime(0.0, time);
    // Envelope (Attack, Decay, Sustain, Release)
    gain.gain.linearRampToValueAtTime(0.12, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration - 0.02);

    gain.connect(this.masterGain);
    
    this.activeSynthNodes.push(osc);

    osc.start(time);
    osc.stop(time + duration);
  }

  // Parse a user dragged audio file into the music library
  async addCustomTrack(file) {
    this.initContext();
    return new Promise((resolve, reject) => {
      try {
        const objectURL = URL.createObjectURL(file);
        
        // Extract basic attributes. Custom tag reading can be slow, 
        // so we parse titles gracefully from file names
        const fileName = file.name.replace(/\.[^/.]+$/, ""); // Strip file extension
        let title = fileName;
        let artist = "Local Sync";
        let album = "Synced Library";

        // Try to split artist and title if structured like "Artist - Title"
        if (fileName.includes(" - ")) {
          const parts = fileName.split(" - ");
          artist = parts[0].trim();
          title = parts[1].trim();
        }

        // Create a temporary Audio element to extract exact audio duration
        const tempAudio = new Audio();
        tempAudio.src = objectURL;
        tempAudio.addEventListener('loadedmetadata', () => {
          const track = {
            id: 'custom-' + Date.now() + Math.random().toString(36).substr(2, 5),
            title: title,
            artist: artist,
            album: album,
            duration: tempAudio.duration,
            isSynth: false,
            src: objectURL,
            artLabel: title.slice(0, 10)
          };

          this.library.push(track);
          resolve(track);
        });

        tempAudio.addEventListener('error', (e) => {
          reject(e);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  // Get current list of tracks
  getTracks() {
    return this.library;
  }
}

export const audioEngine = new IpodAudioEngine();
export default audioEngine;
