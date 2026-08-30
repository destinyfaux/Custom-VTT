// client/src/utils/SoundSynthesizer.js
class SoundSynthesizer {
    constructor() {
        this.ctx = null;
        this.unlocked = false;
        this.enabled = true; // will read from localStorage
        this.queue = [];     // queued sounds when not unlocked
        this.cachedReverbBuffer = null; // Stores the physical outdoor reverb IR
        this.initAudioFlag();
    }

    initAudioFlag() {
        const stored = localStorage.getItem('vtt_procedural_audio');
        this.enabled = stored !== 'false'; // default true
        // Listen for changes to the flag (if user toggles while VTT is open)
        window.addEventListener('storage', (e) => {
            if (e.key === 'vtt_procedural_audio') {
                this.enabled = e.newValue !== 'false';
            }
        });
    }

    // Call this after a user gesture (reuse existing audio unlock from AudioPlayer)
    unlock() {
        if (this.unlocked) {
            // Already unlocked, just ensure context is running
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            return;
        }
        if (!window.AudioContext && !window.webkitAudioContext) {
            console.warn('Web Audio API not supported');
            return;
        }
        try {
            if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            // Create and play a silent buffer to unlock
            const buffer = this.ctx.createBuffer(1, 1, 22050);
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.ctx.destination);
            source.start();
            // Resume context if suspended
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            this.unlocked = true;
            console.log('[SoundSynthesizer] Unlocked');
            // Play any queued sounds
            this.playQueued();
        } catch (err) {
            console.warn('[SoundSynthesizer] Failed to unlock:', err);
        }
    }

    playQueued() {
        while (this.queue.length) {
            const fn = this.queue.shift();
            try { fn(); } catch (e) { console.warn(e); }
        }
    }

    // Ensure context is active (resume if suspended)
    ensureContext() {
        if (!this.ctx) return false;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx.state === 'running';
    }

    // Modernized: Visceral, tactile combat impact. 
    // Features a low "thump", a high-passed weapon "slice", and a quick metallic resonance.
    playDamage() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playDamage());
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // 1. Heavy Low Impact (Sub-bass thud)
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(120, now);
        subOsc.frequency.exponentialRampToValueAtTime(20, now + 0.18);
        subGain.gain.setValueAtTime(0.6, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        subOsc.connect(subGain);
        subGain.connect(this.ctx.destination);
        subOsc.start(now);
        subOsc.stop(now + 0.18);

        // 2. High Weapon Slice (High-pass filtered white noise)
        const bufferSize = this.ctx.sampleRate * 0.12;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(1800, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(800, now + 0.1);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.35, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.12);

        // 3. Resonant Ring/Chirp (Simulates weapon-to-armor transient)
        const ringOsc = this.ctx.createOscillator();
        const ringGain = this.ctx.createGain();
        ringOsc.type = 'sine';
        ringOsc.frequency.setValueAtTime(1500, now);
        ringOsc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
        ringGain.gain.setValueAtTime(0.08, now);
        ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        ringOsc.connect(ringGain);
        ringGain.connect(this.ctx.destination);
        ringOsc.start(now);
        ringOsc.stop(now + 0.06);
    }

    // Modernized: Sparkling, ambient magic swell.
    // Uses a sweeping bandpass filter over noise combined with a detuned, lush major-9th chord.
    playHeal() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playHeal());
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // 1. Magical Wind/Shimmer (Noise sweep)
        const bufferSize = this.ctx.sampleRate * 0.8;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 4.0;
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.exponentialRampToValueAtTime(3200, now + 0.5);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.001, now);
        noiseGain.gain.linearRampToValueAtTime(0.12, now + 0.2);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.8);

        // 2. Lush, Detuned Pentatonic Cascade (Notes swell gently instead of retro beeps)
        const chord = [261.63, 329.63, 392.00, 493.88, 587.33]; // C, E, G, B, D (Cmaj9)
        chord.forEach((freq, idx) => {
            const timeOffset = idx * 0.06;
            
            // Primary tone
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator(); // detuned pair for lush chorus effect
            const gain = this.ctx.createGain();

            osc1.type = 'sine';
            osc2.type = 'triangle';

            osc1.frequency.setValueAtTime(freq, now + timeOffset);
            osc2.frequency.setValueAtTime(freq + 3, now + timeOffset); // subtle detune

            gain.gain.setValueAtTime(0.001, now + timeOffset);
            gain.gain.linearRampToValueAtTime(0.07, now + timeOffset + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.6);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.ctx.destination);

            osc1.start(now + timeOffset);
            osc2.start(now + timeOffset);
            osc1.stop(now + timeOffset + 0.6);
            osc2.stop(now + timeOffset + 0.6);
        });
    }

    // Modernized: Natural dice roll using a bouncing-ball physics timing curve.
    // The clatter spacing slows down exponentially to simulate a physical die settling.
    playDiceRoll() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playDiceRoll());
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // Bouncing pattern delays (seconds from starting point). 
        // Notice how the gaps between bounces grow larger (deceleration).
        const bounces = [0.0, 0.08, 0.18, 0.30, 0.44, 0.60, 0.78];
        const numBounces = bounces.length;

        bounces.forEach((delay, idx) => {
            const bounceTime = now + delay;
            // Naturally decrease bounce velocity/volume over time
            const volumeScale = Math.pow(0.7, idx); 

            // 1. Tactile Clatter (Bandpassed noise mimicking plastic hitting a surface)
            const bufferSize = this.ctx.sampleRate * 0.04;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            
            const bandpass = this.ctx.createBiquadFilter();
            bandpass.type = 'bandpass';
            bandpass.Q.value = 3.0;
            // High frequencies for plastic texture, sweeping slightly lower as energy dissipates
            bandpass.frequency.setValueAtTime(1400 - (idx * 100), bounceTime);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.08 * volumeScale, bounceTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, bounceTime + 0.03);

            noise.connect(bandpass);
            bandpass.connect(noiseGain);
            noiseGain.connect(this.ctx.destination);
            noise.start(bounceTime);
            noise.stop(bounceTime + 0.03);

            // 2. Heavy Die Body Resonance (Low-mid wood/felt thud)
            const thud = this.ctx.createOscillator();
            const thudGain = this.ctx.createGain();
            thud.type = 'triangle';
            thud.frequency.setValueAtTime(140 - (idx * 5), bounceTime);
            
            thudGain.gain.setValueAtTime(0.18 * volumeScale, bounceTime);
            thudGain.gain.exponentialRampToValueAtTime(0.001, bounceTime + 0.035);

            thud.connect(thudGain);
            thudGain.connect(this.ctx.destination);
            thud.start(bounceTime);
            thud.stop(bounceTime + 0.035);
        });
    }

    // Modernized: Warm, non-obtrusive, high-fidelity UI chimes.
    playChatMessage(type) {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playChatMessage(type));
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;

        if (type === 'whisper') {
            // Whisper: A soft, airy rustle and high, delicate glassy chime
            const bufferSize = this.ctx.sampleRate * 0.15;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(4000, now);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.03, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.ctx.destination);
            noise.start(now);
            noise.stop(now + 0.15);

            const chime = this.ctx.createOscillator();
            const chimeGain = this.ctx.createGain();
            chime.type = 'sine';
            chime.frequency.setValueAtTime(1600, now);
            chimeGain.gain.setValueAtTime(0.04, now);
            chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            chime.connect(chimeGain);
            chimeGain.connect(this.ctx.destination);
            chime.start(now);
            chime.stop(now + 0.2);

        } else if (type === 'party') {
            // Party: A warm, acoustic-sounding marimba chord
            const notes = [329.63, 392.00, 523.25]; // E5, G5, C6 (Bright C major triad)
            notes.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                // Sine + very soft triangle harmonics for organic resonance
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + (idx * 0.03));
                gain.gain.setValueAtTime(0.05, now + (idx * 0.03));
                gain.gain.exponentialRampToValueAtTime(0.001, now + (idx * 0.03) + 0.22);
                
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + (idx * 0.03));
                osc.stop(now + (idx * 0.03) + 0.22);
            });
        } else {
            // Default: A clean, warm double-tone chime (perfect fifth interval)
            const freqs = [523.25, 783.99]; // C5, G5
            freqs.forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
                gain.gain.setValueAtTime(0.04, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
                osc.stop(now + 0.25);
            });
        }
    }

    // Modernized: Majestic, brilliant achievement sound.
    // Layers shimmering, detuned synthesizers with a magical sweeping high-pass filter.
    playCriticalSuccess() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playCriticalSuccess());
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // 1. Shimmering Wind/Glitter Whoosh
        const bufferSize = this.ctx.sampleRate * 0.7;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const hpFilter = this.ctx.createBiquadFilter();
        hpFilter.type = 'highpass';
        hpFilter.frequency.setValueAtTime(1500, now);
        hpFilter.frequency.exponentialRampToValueAtTime(8000, now + 0.5);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.07, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        noise.connect(hpFilter);
        hpFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.7);

        // 2. Rich Detuned Synth Brass/Bell Chords (Major 9th progression)
        const notes = [261.63, 329.63, 392.00, 493.88, 523.25, 659.25]; 
        notes.forEach((freq, idx) => {
            const delay = idx * 0.04;
            const osc = this.ctx.createOscillator();
            const oscDetune = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            oscDetune.type = 'triangle'; // triangle gives it a brassy/bell texture

            osc.frequency.setValueAtTime(freq, now + delay);
            oscDetune.frequency.setValueAtTime(freq + 4, now + delay);

            gain.gain.setValueAtTime(0.001, now + delay);
            gain.gain.linearRampToValueAtTime(0.08, now + delay + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.45);

            osc.connect(gain);
            oscDetune.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + delay);
            oscDetune.start(now + delay);
            osc.stop(now + delay + 0.45);
            oscDetune.stop(now + delay + 0.45);
        });
    }

    // Modernized: An ominous, dramatic defeat sound.
    // Dissonant, low-frequency hums resolving downwards with a heavy, crumbling dust noise.
    playCriticalFail() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playCriticalFail());
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // 1. Ominous, Detuned Low Dissonance
        const lowFreqs = [98.0, 103.8]; // Low G and G# (harsh minor second interval)
        lowFreqs.forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now);
            // Sliding downward into despair
            osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + 0.6);

            // Create a low pass filter so the sawtooth doesn't sound buzzy or retro
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(250, now);

            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

            osc.connect(filter);
            filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
            osc.stop(now + 0.65);
        });
        
        // 2. Heavy Dust/Crumble (Simulating collapse or shattering)
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const lpFilter = this.ctx.createBiquadFilter();
        lpFilter.type = 'bandpass';
        lpFilter.Q.value = 1.0;
        lpFilter.frequency.setValueAtTime(300, now);
        lpFilter.frequency.exponentialRampToValueAtTime(60, now + 0.5);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.12, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        noise.connect(lpFilter);
        lpFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.5);
    }

    // Modernized: Epic fanfare progression.
    // Rich detuned pad + a sparkling, rapid pentatonic ascent that lands on a lush major chord.
    playLevelUp() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playLevelUp());
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // 1. Shimmering Whoosh/Swell
        const bufferSize = this.ctx.sampleRate * 1.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const bpFilter = this.ctx.createBiquadFilter();
        bpFilter.type = 'bandpass';
        bpFilter.Q.value = 2.0;
        bpFilter.frequency.setValueAtTime(150, now);
        bpFilter.frequency.exponentialRampToValueAtTime(3000, now + 0.7);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.001, now);
        noiseGain.gain.linearRampToValueAtTime(0.08, now + 0.3);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        noise.connect(bpFilter);
        bpFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 1.2);

        // 2. Soaring Pentatonic Ascent (C major scale climbing to triumphant resolution)
        const fanfare = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 1046.50];
        fanfare.forEach((freq, idx) => {
            const delay = idx * 0.055;
            const osc = this.ctx.createOscillator();
            const oscChorus = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            oscChorus.type = 'sine';
            
            osc.frequency.setValueAtTime(freq, now + delay);
            oscChorus.frequency.setValueAtTime(freq + (freq * 0.005), now + delay);

            gain.gain.setValueAtTime(0.001, now + delay);
            gain.gain.linearRampToValueAtTime(0.07, now + delay + 0.05);
            // Let the final soaring note decay slower than the climbing notes
            const decay = idx === fanfare.length - 1 ? 0.9 : 0.35;
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + decay);

            osc.connect(gain);
            oscChorus.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + delay);
            oscChorus.start(now + delay);
            osc.stop(now + delay + decay);
            oscChorus.stop(now + delay + decay);
        });
    }

    // Modernized: Clean, modern tactile tap.
    // Avoids the synthetic beep with a very short high-passed transient + subtle low "pop" (resembles physical plastic or wood switches).
    playUIClick() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playUIClick());
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // High frequency transient pop
        const noiseBufferSize = this.ctx.sampleRate * 0.015;
        const noiseBuffer = this.ctx.createBuffer(1, noiseBufferSize, this.ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBufferSize; i++) noiseData[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2500, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.04, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.012);

        // Low body thump to give the button click some weight
        const bodyOsc = this.ctx.createOscillator();
        const bodyGain = this.ctx.createGain();
        bodyOsc.type = 'sine';
        bodyOsc.frequency.setValueAtTime(140, now);
        
        bodyGain.gain.setValueAtTime(0.12, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

        bodyOsc.connect(bodyGain);
        bodyGain.connect(this.ctx.destination);
        bodyOsc.start(now);
        bodyOsc.stop(now + 0.015);
    }

    /* ==========================================
       CREATIVE ADDITIONAL SOUNDS
       ========================================== */

    // Play a realistic cascading gold coin clink.
    // Layers metallic inharmonic sine clusters decaying quickly with rapid, natural delays.
    playGoldClink() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playGoldClink());
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // High, metallic, inharmonic frequencies (which characterize metal)
        const metallicFreqs = [1840, 2432, 3120, 4800];
        
        // Trigger 3 quick micro-clinks to simulate a small pile/clatter of coins
        const coins = [0.0, 0.06, 0.14];
        coins.forEach((delay, coinIdx) => {
            const coinTime = now + delay;
            const volumeScale = Math.pow(0.8, coinIdx);

            metallicFreqs.forEach((freq) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sine';
                // Add a small shift in pitch per coin to simulate unique geometries
                osc.frequency.setValueAtTime(freq + (coinIdx * 45), coinTime);

                gain.gain.setValueAtTime(0.012 * volumeScale, coinTime);
                gain.gain.exponentialRampToValueAtTime(0.001, coinTime + 0.1);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(coinTime);
                osc.stop(coinTime + 0.1);
            });
        });
    }

    // Play a mystical spellcast whoosh.
    // Sweeps a resonant bandpass filter downwards over noise while a pitch-bending tone rises.
    playSpellCast() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playSpellCast());
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // 1. Magical swoosh
        const bufferSize = this.ctx.sampleRate * 0.6;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 6.0;
        filter.frequency.setValueAtTime(1500, now);
        filter.frequency.exponentialRampToValueAtTime(300, now + 0.55);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.001, now);
        noiseGain.gain.linearRampToValueAtTime(0.14, now + 0.15);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.6);

        // 2. Rising arcane laser glide
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.45);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
    }

    // A rich, beautiful chime to alert players that it's their turn.
    // Layers a deep hum with shimmering overtone harmonics for an elegant orchestral bell quality.
    playYourTurn() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playYourTurn());
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;

        const harmonics = [440.0, 880.0, 1320.0, 1760.0, 2200.0];
        harmonics.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = idx === 0 ? 'triangle' : 'sine';
            osc.frequency.setValueAtTime(freq, now);

            const decay = 0.8 / (idx + 1);

            gain.gain.setValueAtTime(0.04 / (idx + 1), now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + decay);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + decay);
        });
    }

    // Procedural reverb impulse response generator representing a large outdoor space
    getReverbBuffer() {
        if (!this.ctx) return null;
        if (!this.cachedReverbBuffer) {
            const duration = 3.0;
            const decay = 4.5;
            const sampleRate = this.ctx.sampleRate;
            const length = sampleRate * duration;
            const impulse = this.ctx.createBuffer(2, length, sampleRate);
            const left = impulse.getChannelData(0);
            const right = impulse.getChannelData(1);
            
            for (let i = 0; i < length; i++) {
                const percent = i / length;
                const decayValue = Math.exp(-percent * decay);
                left[i] = (Math.random() * 2 - 1) * decayValue;
                right[i] = (Math.random() * 2 - 1) * decayValue;
            }
            this.cachedReverbBuffer = impulse;
        }
        return this.cachedReverbBuffer;
    }

    // Deep, rolling, natural thunder.
    // Recreates the organic balance of perfect.html (compressor, convolution reverb, muffled hits,
    // near and distant rolling rumbles) while adding our specific timing offsets, dynamic strike counts,
    // dynamic filter-volume sweeps, and detuned sub-bass acoustic beating.
    playThunder() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playThunder());
            return;
        }
        if (!this.ensureContext()) return;

        const now = this.ctx.currentTime;
        const rand = (min, max) => Math.random() * (max - min) + min;

        // --- GLOBAL RANDOMIZED DURATION ---
        const duration = rand(8.0, 12.0); // Dynamic length between 8 and 12 seconds
        
        // Generate a shared brown noise buffer of duration + 1
        const sampleRate = this.ctx.sampleRate;
        const brownNoiseBuffer = this.ctx.createBuffer(1, sampleRate * (duration + 1), sampleRate);
        const data = brownNoiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < data.length; i++) {
            let white = Math.random() * 2 - 1;
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5; 
        }

        // 1. MASTER COMPRESSOR - Binds all layers and keeps peak volume safe
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-20, now);
        compressor.knee.setValueAtTime(30, now);
        compressor.ratio.setValueAtTime(10, now);
        compressor.connect(this.ctx.destination);

        // 2. REVERB PATH - Handles outdoor environment dispersion and blurring
        const convolver = this.ctx.createConvolver();
        const reverbBuffer = this.getReverbBuffer();
        if (reverbBuffer) {
            convolver.buffer = reverbBuffer;
        }

        const reverbGain = this.ctx.createGain();
        reverbGain.gain.setValueAtTime(0.75, now); 
        convolver.connect(reverbGain).connect(compressor);

        // 3. THE CRACK (Softened low-mid bandpass pulses with wet reverb routing)
        // Uses the shared brown noise buffer directly without adding artificial synth oscillators
        const numStrikes = Math.floor(rand(2, 5)); // Randomized return strokes (2, 3, or 4)
        const crackDelays = [0];
        let currentDelay = rand(0.03, 0.06);
        for (let i = 1; i < numStrikes; i++) {
            crackDelays.push(currentDelay);
            currentDelay += rand(0.04, 0.08);
        }

        crackDelays.forEach((delay, index) => {
            const strikeTime = now + delay;
            
            const crack = this.ctx.createBufferSource();
            const crackGain = this.ctx.createGain();
            const crackFilter = this.ctx.createBiquadFilter();

            const randomFreq = rand(50, 100); // Randomized offset frequency between 50Hz and 100Hz
            // Slightly varies volume per strike to break up static envelopes
            const peakVolume = rand(0.75, 1.25) * Math.pow(0.85, index);

            crack.buffer = brownNoiseBuffer;
            crackFilter.type = "bandpass";
            crackFilter.frequency.setValueAtTime(randomFreq, strikeTime);
            // Glides the filter pitch downward as the shockwave decays
            crackFilter.frequency.exponentialRampToValueAtTime(randomFreq * rand(0.75, 0.95), strikeTime + 0.2);
            crackFilter.Q.setValueAtTime(1.5, strikeTime);

            crackGain.gain.setValueAtTime(0, strikeTime);
            // Softened attack time (0.04s) prevents high-frequency pops
            crackGain.gain.linearRampToValueAtTime(peakVolume, strikeTime + 0.04);
            crackGain.gain.exponentialRampToValueAtTime(0.001, strikeTime + 0.2); 
            crackGain.gain.linearRampToValueAtTime(0, strikeTime + 0.25);          

            crack.connect(crackFilter).connect(crackGain);
            
            crackGain.connect(compressor);
            crackGain.connect(convolver);
            
            crack.start(strikeTime);
            crack.stop(strikeTime + 0.25);
        });

        // 4. THE SUB-THUMP (Detuned dual sine oscillators for acoustic beating)
        const sub1 = this.ctx.createOscillator();
        const sub2 = this.ctx.createOscillator(); // Detuned helper to create a rolling low-end wave
        const subGain = this.ctx.createGain();
        
        sub1.type = "sine";
        sub2.type = "sine";

        const subStartFreq = rand(55, 65); 
        const subEndFreq = rand(25, 35);   
        
        sub1.frequency.setValueAtTime(subStartFreq, now);
        sub1.frequency.exponentialRampToValueAtTime(subEndFreq, now + 0.5);
        
        // Micro-detuned slightly lower to trigger organic low-frequency beating
        sub2.frequency.setValueAtTime(subStartFreq - rand(1.5, 3.5), now);
        sub2.frequency.exponentialRampToValueAtTime(subEndFreq - 1, now + 0.5);
        
        subGain.gain.setValueAtTime(0, now);
        // Softened attack prevents low-frequency popping
        subGain.gain.linearRampToValueAtTime(rand(0.7, 0.95), now + 0.05);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

        sub1.connect(subGain);
        sub2.connect(subGain);
        subGain.connect(compressor);
        
        sub1.start(now);
        sub2.start(now);
        sub1.stop(now + 0.8);
        sub2.stop(now + 0.8);

        // 5. NEAR RUMBLE (Immediate low-frequency acoustic swell)
        const nearRumble = this.ctx.createBufferSource();
        const nearRumbleGain = this.ctx.createGain();
        const nearRumbleFilter = this.ctx.createBiquadFilter();
        
        const nearFilterStart = rand(500, 700); 
        const nearFilterEnd = rand(10, 50);    

        nearRumble.buffer = brownNoiseBuffer;
        nearRumbleFilter.type = "lowpass";
        nearRumbleFilter.frequency.setValueAtTime(nearFilterStart, now);
        nearRumbleFilter.frequency.exponentialRampToValueAtTime(nearFilterEnd, now + 4.0);

        nearRumbleGain.gain.setValueAtTime(0, now + 0.05);
        nearRumbleGain.gain.linearRampToValueAtTime(1.5, now + 0.3); 

        // Volume reflection envelopes
        for(let i = 0; i < 10; i++) {
            const time = now + 0.3 + (i * 0.4);
            const val = 0.5 + Math.random() * 0.5;
            nearRumbleGain.gain.exponentialRampToValueAtTime(val, time);
        }
        nearRumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 4.0); 
        nearRumbleGain.gain.linearRampToValueAtTime(0, now + 4.1);           
            
        nearRumble.connect(nearRumbleFilter).connect(nearRumbleGain).connect(compressor);
        nearRumble.start(now + 0.05);
        nearRumble.stop(now + 4.1);

        // 6. DISTANT ROLLING RUMBLE (Dynamic randomized trailing waves)
        const distantRumble = this.ctx.createBufferSource();
        const distantRumbleGain = this.ctx.createGain();
        const distantRumbleFilter = this.ctx.createBiquadFilter();

        const distantFilterStart = rand(150, 300); 
        const distantFilterEnd = rand(40, 100);     

        distantRumble.buffer = brownNoiseBuffer;
        distantRumbleFilter.type = "lowpass";
        distantRumbleFilter.frequency.setValueAtTime(distantFilterStart, now);

        distantRumbleGain.gain.setValueAtTime(0, now);
        distantRumbleGain.gain.linearRampToValueAtTime(1.0, now + 0.1); 
        
        // Rolling volume sweeps and dynamic lowpass tracking
        const iterations = 15;
        for(let i = 1; i <= iterations; i++) {
            // Applies a randomized offset to break up the metronome-like grid
            const gridTime = now + (i * (duration / iterations));
            const randomOffset = rand(-0.15, 0.15);
            const peakTime = Math.max(now + 0.2, gridTime + randomOffset);

            const trendDown = (1.1 - (i / iterations)); 
            const randomVol = (Math.random() * 0.45 + 0.15) * trendDown;
            
            // Sync filter cutoff to volume: louder peaks let more mid-range open up,
            // while quieter decays muffle into deep sub-bass
            const dynamicCutoff = distantFilterEnd + (randomVol * (distantFilterStart - distantFilterEnd) * 1.25);
            
            distantRumbleGain.gain.linearRampToValueAtTime(randomVol, peakTime);
            distantRumbleFilter.frequency.linearRampToValueAtTime(Math.max(30, dynamicCutoff), peakTime);
        }
        distantRumbleGain.gain.linearRampToValueAtTime(0, now + duration);
        distantRumbleFilter.frequency.linearRampToValueAtTime(30, now + duration);

        distantRumble.connect(distantRumbleFilter).connect(distantRumbleGain).connect(compressor);
        distantRumble.start(now);
        distantRumble.stop(now + duration + 0.1);
    }

    // ============================================================
    // NEW: Element-specific sounds and the router
    // ============================================================

    playFire() {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // 1. Solid continuous burning flame roar (Brownian Noise filter sweep)
        const size = this.ctx.sampleRate * 0.6;
        const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < size; i++) {
            let white = Math.random() * 2 - 1;
            d[i] = (lastOut + (0.05 * white)) / 1.05;
            lastOut = d[i];
            d[i] *= 3.5;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, now);
        filter.frequency.linearRampToValueAtTime(80, now + 0.6);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        noise.connect(filter).connect(gain).connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.6);

        // 2. High-pass random micro sparks crackling
        for (let i = 0; i < 8; i++) {
            const delay = Math.random() * 0.5;
            const popTime = now + delay;
            const pOsc = this.ctx.createOscillator();
            const pGain = this.ctx.createGain();
            pOsc.type = 'triangle';
            pOsc.frequency.setValueAtTime(400 + Math.random() * 800, popTime);
            pGain.gain.setValueAtTime(0.06, popTime);
            pGain.gain.exponentialRampToValueAtTime(0.001, popTime + 0.015);
            pOsc.connect(pGain).connect(this.ctx.destination);
            pOsc.start(popTime);
            pOsc.stop(popTime + 0.02);
        }
    }

    playWater() {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // Fluid splash - Sweeping high resonance bandpass
        const size = this.ctx.sampleRate * 0.35;
        const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(4.0, now);
        filter.frequency.setValueAtTime(350, now);
        filter.frequency.exponentialRampToValueAtTime(1600, now + 0.22);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        noise.connect(filter).connect(gain).connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.3);

        // 3 micro-bubbles popping up rapidly
        for (let i = 0; i < 3; i++) {
            const delay = 0.05 + i * 0.05;
            const osc = this.ctx.createOscillator();
            const bubbleGain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(180 + i * 110, now + delay);
            osc.frequency.exponentialRampToValueAtTime(750 + i * 150, now + delay + 0.06);

            bubbleGain.gain.setValueAtTime(0.06, now + delay);
            bubbleGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);

            osc.connect(bubbleGain).connect(this.ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.06);
        }
    }

    playBlood() {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // Viscous Squelch / Thick Slosh splat
        const size = this.ctx.sampleRate * 0.25;
        const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(400, now);
        lp.frequency.exponentialRampToValueAtTime(80, now + 0.2);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        noise.connect(lp).connect(gain).connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.25);

        // Viscous fluid plop transients
        for (let i = 0; i < 3; i++) {
            const delay = i * 0.03;
            const pOsc = this.ctx.createOscillator();
            const pGain = this.ctx.createGain();
            pOsc.type = 'sine';
            pOsc.frequency.setValueAtTime(150 - (i * 30), now + delay);
            pOsc.frequency.exponentialRampToValueAtTime(45, now + delay + 0.08);
            pGain.gain.setValueAtTime(0.15, now + delay);
            pGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);
            pOsc.connect(pGain).connect(this.ctx.destination);
            pOsc.start(now + delay);
            pOsc.stop(now + delay + 0.08);
        }
    }

    playHoly() {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // Wide, shimmering crystalline rise
        const chords = [329.63, 415.30, 493.88, 659.25, 830.61]; 
        chords.forEach((freq, idx) => {
            const delay = idx * 0.035;
            const osc = this.ctx.createOscillator();
            const pGain = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);
            
            pGain.gain.setValueAtTime(0.001, now + delay);
            pGain.gain.linearRampToValueAtTime(0.05, now + delay + 0.1);
            pGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.5);

            osc.connect(pGain).connect(this.ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.5);
        });

        // Angelic noise swept rise
        const size = this.ctx.sampleRate * 0.45;
        const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;

        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(1200, now);
        hp.frequency.exponentialRampToValueAtTime(3500, now + 0.4);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        noise.connect(hp).connect(gain).connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.45);
    }

    playDark() {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // Swelling, ominous shifting void sweep
        const size = this.ctx.sampleRate * 0.7;
        const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        
        const notch = this.ctx.createBiquadFilter();
        notch.type = 'notch';
        notch.frequency.setValueAtTime(800, now);
        notch.frequency.exponentialRampToValueAtTime(200, now + 0.6);
        
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(350, now);
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        noise.connect(notch).connect(lp).connect(gain).connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.7);

        // Sinister detuned low sub-bass growl
        const sub1 = this.ctx.createOscillator();
        const sub2 = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        
        sub1.type = 'sawtooth';
        sub1.frequency.setValueAtTime(55, now);
        sub1.frequency.linearRampToValueAtTime(35, now + 0.6);
        
        sub2.type = 'sawtooth';
        sub2.frequency.setValueAtTime(56.5, now);
        sub2.frequency.linearRampToValueAtTime(35.5, now + 0.6);
        
        const subLp = this.ctx.createBiquadFilter();
        subLp.type = 'lowpass';
        subLp.frequency.setValueAtTime(100, now);
        
        subGain.gain.setValueAtTime(0.001, now);
        subGain.gain.linearRampToValueAtTime(0.25, now + 0.2);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        
        sub1.connect(subLp);
        sub2.connect(subLp);
        subLp.connect(subGain).connect(this.ctx.destination);
        
        sub1.start(now);
        sub2.start(now);
        sub1.stop(now + 0.6);
        sub2.stop(now + 0.6);
    }

    playFrost() {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // Icy wind
        const size = this.ctx.sampleRate * 0.5;
        const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(1.5, now);
        filter.frequency.setValueAtTime(1100, now);
        filter.frequency.exponentialRampToValueAtTime(400, now + 0.45);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        noise.connect(filter).connect(gain).connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.5);

        // Brittle glass cracklings
        const frozenChirps = [1400, 1850, 2400];
        frozenChirps.forEach((freq, idx) => {
            const delay = idx * 0.05 + Math.random() * 0.02;
            const osc = this.ctx.createOscillator();
            const cGain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);
            
            cGain.gain.setValueAtTime(0.015, now + delay);
            cGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);

            osc.connect(cGain).connect(this.ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.08);
        });
    }

    playAcid() {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // Sizzling corrosion - Pure static highpass hiss
        const size = this.ctx.sampleRate * 0.65;
        const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;

        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(2500, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        noise.connect(hp).connect(gain).connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.65);

        // Sizzling micro-bubble bursts (highly granular)
        for (let i = 0; i < 15; i++) {
            const delay = Math.random() * 0.5;
            const popTime = now + delay;
            const osc = this.ctx.createOscillator();
            const pGain = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(2000 + Math.random() * 3000, popTime);
            
            pGain.gain.setValueAtTime(0.015, popTime);
            pGain.gain.exponentialRampToValueAtTime(0.001, popTime + 0.015);
            
            osc.connect(pGain).connect(this.ctx.destination);
            osc.start(popTime);
            osc.stop(popTime + 0.02);
        }
    }

    playLightning() {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // Sudden electrical snapshot (Broadband discharge snap)
        const size = this.ctx.sampleRate * 0.12;
        const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;

        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(2500, now);

        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(6000, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        noise.connect(hp).connect(lp).connect(gain).connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.12);

        // Sudden high-frequency ionization sweep
        const zap = this.ctx.createOscillator();
        const zGain = this.ctx.createGain();
        zap.type = 'sawtooth';
        zap.frequency.setValueAtTime(4500, now);
        zap.frequency.exponentialRampToValueAtTime(900, now + 0.08);

        zGain.gain.setValueAtTime(0.12, now);
        zGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        zap.connect(zGain).connect(this.ctx.destination);
        zap.start(now);
        zap.stop(now + 0.08);
    }

    playForce() {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // Cinematic kinetic implosion: solid sub thump
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(140, now);
        sub.frequency.exponentialRampToValueAtTime(25, now + 0.18);

        subGain.gain.setValueAtTime(0.5, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        sub.connect(subGain).connect(this.ctx.destination);
        sub.start(now);
        sub.stop(now + 0.18);

        // Atmospheric low-passed displacement burst
        const size = this.ctx.sampleRate * 0.22;
        const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;

        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(180, now);
        lp.frequency.exponentialRampToValueAtTime(45, now + 0.2);

        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.4, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        noise.connect(lp).connect(nGain).connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.2);
    }

    playSmoke() {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // Soft, airy whoosh
        const size = this.ctx.sampleRate * 0.45;
        const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.linearRampToValueAtTime(120, now + 0.4);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        noise.connect(filter).connect(gain).connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.45);
    }

    playSlash() {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // Stage 1: High velocity swoosh (Whoosh-hit sequence)
        const size = this.ctx.sampleRate * 0.15;
        const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(2000, now);
        hp.frequency.exponentialRampToValueAtTime(600, now + 0.12);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        noise.connect(hp).connect(gain).connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.15);

        // Stage 2: Instant physical impact at 0.08s
        const hitTime = now + 0.08;

        const thump = this.ctx.createOscillator();
        const thumpGain = this.ctx.createGain();
        thump.type = 'triangle';
        thump.frequency.setValueAtTime(150, hitTime);
        thump.frequency.exponentialRampToValueAtTime(45, hitTime + 0.1);
        
        thumpGain.gain.setValueAtTime(0.4, hitTime);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.1);
        thump.connect(thumpGain).connect(this.ctx.destination);
        thump.start(hitTime);
        thump.stop(hitTime + 0.1);

        // Blade transient edge ring
        const ring = this.ctx.createOscillator();
        const ringGain = this.ctx.createGain();
        ring.type = 'sine';
        ring.frequency.setValueAtTime(1450, hitTime);
        
        ringGain.gain.setValueAtTime(0.06, hitTime);
        ringGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.12);
        ring.connect(ringGain).connect(this.ctx.destination);
        ring.start(hitTime);
        ring.stop(hitTime + 0.12);
    }

    playImpact() {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;

        // Deep physical thump
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(140, now);
        sub.frequency.linearRampToValueAtTime(30, now + 0.2);

        subGain.gain.setValueAtTime(0.5, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        sub.connect(subGain).connect(this.ctx.destination);
        sub.start(now);
        sub.stop(now + 0.22);

        // Crushing debris debris
        const size = this.ctx.sampleRate * 0.25;
        const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(350, now);

        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.15, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        noise.connect(bp).connect(nGain).connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.25);
    }

    // Specialized element-specific missile projection audio
    playMissileLaunch(styleKey) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;

        switch (styleKey) {
            case 'fire': {
                // Igniting fire bellows fwoomp
                const size = this.ctx.sampleRate * 0.35;
                const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
                const d = buf.getChannelData(0);
                for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
                
                const noise = this.ctx.createBufferSource();
                noise.buffer = buf;
                
                const lp = this.ctx.createBiquadFilter();
                lp.type = 'lowpass';
                lp.frequency.setValueAtTime(450, now);
                lp.frequency.exponentialRampToValueAtTime(120, now + 0.3);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

                noise.connect(lp).connect(gain).connect(this.ctx.destination);
                noise.start(now);
                noise.stop(now + 0.35);
                break;
            }
            case 'frost': {
                // Cold whispering crystalline whistling wind
                const wind = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                wind.type = 'sine';
                wind.frequency.setValueAtTime(800, now);
                wind.frequency.exponentialRampToValueAtTime(1400, now + 0.25);

                gain.gain.setValueAtTime(0.001, now);
                gain.gain.linearRampToValueAtTime(0.04, now + 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

                wind.connect(gain).connect(this.ctx.destination);
                wind.start(now);
                wind.stop(now + 0.25);
                break;
            }
            case 'lightning': {
                // High voltage static charging snap
                const size = this.ctx.sampleRate * 0.08;
                const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
                const d = buf.getChannelData(0);
                for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
                
                const noise = this.ctx.createBufferSource();
                noise.buffer = buf;
                
                const hp = this.ctx.createBiquadFilter();
                hp.type = 'highpass';
                hp.frequency.setValueAtTime(3000, now);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

                noise.connect(hp).connect(gain).connect(this.ctx.destination);
                noise.start(now);
                noise.stop(now + 0.08);
                break;
            }
            case 'water': {
                // Splash squirt projection
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(350, now);
                osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);

                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

                osc.connect(gain).connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.15);
                break;
            }
            case 'dark': {
                // Hollow low sweep black-hole pull
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.linearRampToValueAtTime(70, now + 0.4);

                gain.gain.setValueAtTime(0.001, now);
                gain.gain.linearRampToValueAtTime(0.15, now + 0.15);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

                osc.connect(gain).connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.4);
                break;
            }
            case 'acid': {
                // Fluid acid hissing spray
                const size = this.ctx.sampleRate * 0.2;
                const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
                const d = buf.getChannelData(0);
                for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
                
                const noise = this.ctx.createBufferSource();
                noise.buffer = buf;
                
                const bp = this.ctx.createBiquadFilter();
                bp.type = 'bandpass';
                bp.frequency.setValueAtTime(3000, now);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

                noise.connect(bp).connect(gain).connect(this.ctx.destination);
                noise.start(now);
                noise.stop(now + 0.2);
                break;
            }
            case 'holy': {
                // Glassy glistening chime sweep
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(1500, now + 0.3);

                gain.gain.setValueAtTime(0.001, now);
                gain.gain.linearRampToValueAtTime(0.06, now + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

                osc.connect(gain).connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            }
            case 'force': {
                // Heavy kinetic compression projection
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.25);

                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

                osc.connect(gain).connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.25);
                break;
            }
            default: {
                // Generic focus sweep
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(450, now);
                osc.frequency.exponentialRampToValueAtTime(250, now + 0.2);

                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

                osc.connect(gain).connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            }
        }
    }

    // Legacy fallback mapping (kept for compatibility)
    // Router: map styleKey to the appropriate sound
    playElementSound(styleKey) {
        switch (styleKey) {
            case 'fire':      this.playFire(); break;
            case 'water':     this.playWater(); break;
            case 'blood':     this.playBlood(); break;
            case 'holy':      this.playHoly(); break;
            case 'dark':      this.playDark(); break;
            case 'frost':     this.playFrost(); break;
            case 'acid':      this.playAcid(); break;
            case 'smoke':     this.playSmoke(); break;
            case 'slash':     this.playSlash(); break;
            case 'impact':    this.playImpact(); break;
            case 'lightning': this.playLightning(); break;
            case 'force':     this.playForce(); break;
            case 'healing':   this.playHeal(); break;
            case 'damage':    this.playDamage(); break;
            default:          this.playDamage(); break;
        }
    }
}

// Export singleton
export default new SoundSynthesizer();