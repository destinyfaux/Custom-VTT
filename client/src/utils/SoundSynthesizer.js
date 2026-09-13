// client/src/utils/SoundSynthesizer.js

class SoundSynthesizer {
    constructor() {
        this.ctx = null;
        this.unlocked = false;
        this.enabled = true;
        this.queue = [];
        this.cachedDungeonBuffer = null;
        this.cachedCathedralBuffer = null;
        this.cachedOutdoorBuffer = null;
        this.masterCompressor = null;
        this.masterSaturation = null;
        this.reverbNode = null;
        this.reverbGainNode = null;
        this.activeRoutes = new Set();
        this.activeStackTimers = new Set();
        this.initAudioFlag();
    }

    initAudioFlag() {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('vtt_procedural_audio') : null;
        this.enabled = stored !== 'false';
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', (e) => {
                if (e.key === 'vtt_procedural_audio') {
                    this.enabled = e.newValue !== 'false';
                }
            });
        }
    }

    /* ============================================================
       AUDIO CONTEXT & LIFECYCLE MANAGEMENT
       ============================================================ */

    unlock() {
        if (this.unlocked) {
            // Already unlocked, just ensure context is running
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
            return;
        }
        if (typeof window === 'undefined' || (!window.AudioContext && !window.webkitAudioContext)) {
            console.warn('[SoundSynthesizer] Web Audio API not supported');
            return;
        }
        try {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            this.initMasterDSP();

            // Unlock audio on iOS / Chrome policy via short silent buffer
            const buffer = this.ctx.createBuffer(1, 1, 22050);
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.masterSaturation || this.ctx.destination);
            source.start(0);

            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
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
        if (!this.ctx) {
            this.unlock();
        }
        if (!this.ctx) return false;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        if (!this.masterCompressor) {
            this.initMasterDSP();
        }
        return this.ctx.state === 'running';
    }

    /* ============================================================
       MASTER DSP PIPELINE: SATURATION, COMPRESSION & REVERB BUS
       ============================================================ */

    initMasterDSP() {
        if (!this.ctx || this.masterCompressor) return;

        // 1. Master Dynamics Compressor & Peak Limiter
        this.masterCompressor = this.ctx.createDynamicsCompressor();
        this.masterCompressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
        this.masterCompressor.knee.setValueAtTime(16, this.ctx.currentTime);
        this.masterCompressor.ratio.setValueAtTime(6, this.ctx.currentTime);
        this.masterCompressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.masterCompressor.release.setValueAtTime(0.18, this.ctx.currentTime);
        this.masterCompressor.connect(this.ctx.destination);

        // 2. Analog Warmth WaveShaper (Soft-clip saturation to tame digital harshness)
        this.masterSaturation = this.ctx.createWaveShaper();
        this.masterSaturation.curve = this.makeWarmthCurve(512);
        this.masterSaturation.oversample = '2x';
        this.masterSaturation.connect(this.masterCompressor);

        // 3. Shared Convolver Reverb Bus
        this.reverbNode = this.ctx.createConvolver();
        const revBuf = this.getDungeonReverbBuffer();
        if (revBuf) this.reverbNode.buffer = revBuf;

        this.reverbGainNode = this.ctx.createGain();
        // Keep the shared room tail subtle; individual effects still control
        // how much signal they send into this bus.
        this.reverbGainNode.gain.setValueAtTime(0.2, this.ctx.currentTime);
        this.reverbNode.connect(this.reverbGainNode);
        this.reverbGainNode.connect(this.masterCompressor);
    }

    makeWarmthCurve(samples = 512) {
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        const k = 1.8;
        for (let i = 0; i < samples; ++i) {
            let x = (i * 2) / samples - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    // Helper: Create a spatial output routing node (Stereo Panner + Distance LP Occlusion)
    createSpatialRoute({ pan = 0, distance = 0, sendReverb = 0.25, volume = 1 } = {}) {
        if (!this.ctx) return null;
        const inputGain = this.ctx.createGain();
        inputGain.gain.setValueAtTime(Math.max(0, Math.min(1, Number(volume) || 0)), this.ctx.currentTime);
        this.activeRoutes.add(inputGain);
        let currentOut = inputGain;

        // High-frequency air absorption over distance
        if (distance > 0) {
            const distanceFilter = this.ctx.createBiquadFilter();
            distanceFilter.type = 'lowpass';
            const cutoff = Math.max(800, 18000 / (1 + distance * 0.0022));
            distanceFilter.frequency.setValueAtTime(cutoff, this.ctx.currentTime);
            currentOut.connect(distanceFilter);
            currentOut = distanceFilter;
        }

        // Stereo Panning
        if (this.ctx.createStereoPanner && typeof pan === 'number') {
            const panner = this.ctx.createStereoPanner();
            panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), this.ctx.currentTime);
            currentOut.connect(panner);
            currentOut = panner;
        }

        // Dry Path to Master Saturation
        currentOut.connect(this.masterSaturation || this.ctx.destination);

        // Wet Path to Convolution Reverb Bus
        if (sendReverb > 0 && this.reverbNode) {
            const wetGain = this.ctx.createGain();
            const wetMult = 1 + Math.min(1.5, distance * 0.001);
            wetGain.gain.setValueAtTime(sendReverb * wetMult, this.ctx.currentTime);
            currentOut.connect(wetGain);
            wetGain.connect(this.reverbNode);
        }

        return inputGain;
    }

    // Direct destination target (falls back to saturation / destination)
    getMasterInput() {
        return this.masterSaturation || this.ctx?.destination;
    }

    // Dungeon & Stone Interior Impulse Generator with Early Reflections
    getDungeonReverbBuffer() {
        if (!this.ctx) return null;
        if (!this.cachedDungeonBuffer) {
            const duration = 2.2;
            const decay = 3.8;
            const sampleRate = this.ctx.sampleRate;
            const length = Math.floor(sampleRate * duration);
            const impulse = this.ctx.createBuffer(2, length, sampleRate);
            const left = impulse.getChannelData(0);
            const right = impulse.getChannelData(1);

            // Synthesize discrete early reflection taps + diffuse stochastic tail
            const earlyTaps = [
                { time: 0.012, gain: 0.7, pan: -0.4 },
                { time: 0.024, gain: 0.55, pan: 0.35 },
                { time: 0.039, gain: 0.42, pan: -0.6 },
                { time: 0.055, gain: 0.35, pan: 0.5 }
            ];

            for (let i = 0; i < length; i++) {
                const t = i / sampleRate;
                const env = Math.exp(-t * decay);
                const damping = Math.exp(-t * 7.0); // High-frequency room absorption
                const noiseL = (Math.random() * 2 - 1) * env * (1 + damping);
                const noiseR = (Math.random() * 2 - 1) * env * (1 + damping);
                left[i] = noiseL * 0.35;
                right[i] = noiseR * 0.35;
            }

            // Inject early reflections
            earlyTaps.forEach(tap => {
                const idx = Math.floor(tap.time * sampleRate);
                if (idx < length) {
                    left[idx] += tap.gain * (1 - tap.pan);
                    right[idx] += tap.gain * (1 + tap.pan);
                }
            });

            this.cachedDungeonBuffer = impulse;
        }
        return this.cachedDungeonBuffer;
    }

    // Cathedral / High Magic Hall Reverb Impulse (Long diffuse tail)
    getCathedralReverbBuffer() {
        if (!this.ctx) return null;
        if (!this.cachedCathedralBuffer) {
            const duration = 4.2;
            const decay = 2.4;
            const sampleRate = this.ctx.sampleRate;
            const length = Math.floor(sampleRate * duration);
            const impulse = this.ctx.createBuffer(2, length, sampleRate);
            const left = impulse.getChannelData(0);
            const right = impulse.getChannelData(1);

            for (let i = 0; i < length; i++) {
                const t = i / sampleRate;
                const env = Math.exp(-t * decay);
                left[i] = (Math.random() * 2 - 1) * env * 0.38;
                right[i] = (Math.random() * 2 - 1) * env * 0.38;
            }
            this.cachedCathedralBuffer = impulse;
        }
        return this.cachedCathedralBuffer;
    }

    // Large Outdoor Ambient Reverb Impulse
    getOutdoorReverbBuffer() {
        if (!this.ctx) return null;
        if (!this.cachedOutdoorBuffer) {
            const duration = 6.0;
            const decay = 1.8;
            const sampleRate = this.ctx.sampleRate;
            const length = Math.floor(sampleRate * duration);
            const impulse = this.ctx.createBuffer(2, length, sampleRate);
            const left = impulse.getChannelData(0);
            const right = impulse.getChannelData(1);
            
            for (let i = 0; i < length; i++) {
                const t = i / sampleRate;
                const env = Math.exp(-t * decay);
                const airAbsorb = Math.exp(-t * 3.5);
                left[i] = (Math.random() * 2 - 1) * env * airAbsorb * 0.32;
                right[i] = (Math.random() * 2 - 1) * env * airAbsorb * 0.32;
            }
            this.cachedReverbBuffer = impulse;
        }
        return this.cachedReverbBuffer;
    }

    /* ============================================================
       PHYSICAL MODELING CORE: MODAL RESONATORS, PARTICLES & BUBBLES
       ============================================================ */

    // Generate physical excitation impulse (Color options: white, pink, brown)
    createImpulseSource(duration = 0.006, color = 'white') {
        const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
        const buf = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        let last = 0;

        for (let i = 0; i < length; i++) {
            const decay = Math.exp((-i / length) * 6.5);
            const white = Math.random() * 2 - 1;
            if (color === 'pink' || color === 'brown') {
                last = (last + 0.07 * white) / 1.07;
                data[i] = last * 4.2 * decay;
            } else {
                data[i] = white * decay;
            }
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        return src;
    }

    // Modal Filter Bank: Excites natural material physical frequencies
    triggerModalBank(modes, impulseSrc, startTime, outputNode, masterGain = 1.0) {
        const merger = this.ctx.createGain();
        merger.gain.setValueAtTime(masterGain, startTime);

        modes.forEach(mode => {
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(mode.freq, startTime);
            filter.Q.setValueAtTime(mode.q, startTime);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(mode.gain, startTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + mode.decay);

            impulseSrc.connect(filter);
            filter.connect(gain);
            gain.connect(merger);
        });

        merger.connect(outputNode);
        impulseSrc.start(startTime);
    }

    // Material Presets: Wood, Iron/Steel, Stone, Glass, Bone
    getMaterialModes(material, fundamental = 220) {
        switch (material) {
            case 'wood':
                // Clustered low-Q modes with rapid internal damping
                return [
                    { freq: fundamental * 1.0, q: 8, gain: 0.5, decay: 0.22 },
                    { freq: fundamental * 1.48, q: 10, gain: 0.35, decay: 0.18 },
                    { freq: fundamental * 2.14, q: 12, gain: 0.22, decay: 0.12 },
                    { freq: fundamental * 3.20, q: 14, gain: 0.12, decay: 0.08 }
                ];
            case 'iron':
            case 'steel':
                // Highly inharmonic high-Q ringing modes
                return [
                    { freq: fundamental * 1.0, q: 45, gain: 0.45, decay: 0.45 },
                    { freq: fundamental * 2.76, q: 65, gain: 0.3, decay: 0.35 },
                    { freq: fundamental * 5.40, q: 85, gain: 0.2, decay: 0.25 },
                    { freq: fundamental * 8.93, q: 110, gain: 0.12, decay: 0.15 }
                ];
            case 'stone':
                // Densely packed, heavily dampened sub-bass/low-mid modes
                return [
                    { freq: fundamental * 1.0, q: 5, gain: 0.6, decay: 0.28 },
                    { freq: fundamental * 1.22, q: 6, gain: 0.4, decay: 0.22 },
                    { freq: fundamental * 1.67, q: 7, gain: 0.25, decay: 0.15 },
                    { freq: fundamental * 2.05, q: 8, gain: 0.15, decay: 0.1 }
                ];
            case 'glass':
                // Crystalline, ultra-high-Q inharmonic modes
                return [
                    { freq: fundamental * 1.0, q: 80, gain: 0.4, decay: 0.28 },
                    { freq: fundamental * 2.32, q: 100, gain: 0.28, decay: 0.22 },
                    { freq: fundamental * 4.15, q: 120, gain: 0.18, decay: 0.15 },
                    { freq: fundamental * 6.47, q: 140, gain: 0.1, decay: 0.1 }
                ];
            default:
                return [
                    { freq: fundamental, q: 10, gain: 0.5, decay: 0.2 }
                ];
        }
    }

    // Minnaert Acoustic Fluid Bubble Oscillator (f = 1/(2*pi*r) * sqrt(3*gamma*P0/rho))
    createMinnaertBubble(startTime, freqStart, outputNode, { volume = 0.08, duration = 0.06 } = {}) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freqStart, startTime);
        // Upward pitch-chirp characteristic of fluid bubble separation
        osc.frequency.exponentialRampToValueAtTime(freqStart * 1.28, startTime + duration);

        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain).connect(outputNode);
        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    /* ============================================================
       PHYSICAL DOORS, GATES, WINDOWS & PORTALS
       ============================================================ */

    // Heavy Oak Door Creak: Stick-slip friction + physical oak cavity resonance + rusty hinge
    playDoorOpen(options = {}) {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playDoorOpen(options));
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: 0.38 });

        // Layer 1: Stick-Slip Friction Noise (Sawtooth FM with low-frequency jitter)
        const carrier = this.ctx.createOscillator();
        const mod = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const creakGain = this.ctx.createGain();
        const creakFilter = this.ctx.createBiquadFilter();

        carrier.type = 'sawtooth';
        carrier.frequency.setValueAtTime(130, now);
        carrier.frequency.exponentialRampToValueAtTime(240, now + 0.35);
        carrier.frequency.linearRampToValueAtTime(95, now + 0.7);

        mod.type = 'sine';
        mod.frequency.setValueAtTime(32, now);
        mod.frequency.linearRampToValueAtTime(14, now + 0.7);
        modGain.gain.setValueAtTime(120, now);

        mod.connect(modGain);
        modGain.connect(carrier.frequency);

        creakFilter.type = 'lowpass';
        creakFilter.frequency.setValueAtTime(420, now);
        creakFilter.frequency.linearRampToValueAtTime(750, now + 0.3);
        creakFilter.frequency.exponentialRampToValueAtTime(160, now + 0.7);

        creakGain.gain.setValueAtTime(0.0001, now);
        creakGain.gain.linearRampToValueAtTime(0.32, now + 0.18);
        creakGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

        carrier.connect(creakFilter).connect(creakGain).connect(dest);
        mod.start(now);
        carrier.start(now);
        mod.stop(now + 0.7);
        carrier.stop(now + 0.7);

        // Layer 2: High-Pitched Rusty Iron Hinge Squeal
        const hingeOsc = this.ctx.createOscillator();
        const hingeGain = this.ctx.createGain();
        const hingeFilter = this.ctx.createBiquadFilter();

        hingeOsc.type = 'triangle';
        hingeOsc.frequency.setValueAtTime(1750, now + 0.1);
        hingeOsc.frequency.exponentialRampToValueAtTime(2600, now + 0.32);
        hingeOsc.frequency.exponentialRampToValueAtTime(1100, now + 0.6);

        hingeFilter.type = 'bandpass';
        hingeFilter.Q.setValueAtTime(16.0, now);
        hingeFilter.frequency.setValueAtTime(1900, now + 0.1);

        hingeGain.gain.setValueAtTime(0.0001, now + 0.1);
        hingeGain.gain.linearRampToValueAtTime(0.065, now + 0.28);
        hingeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

        hingeOsc.connect(hingeFilter).connect(hingeGain).connect(dest);
        hingeOsc.start(now + 0.1);
        hingeOsc.stop(now + 0.6);

        // Layer 3: Sub-Bass Room Air Displacement (Low 45Hz thump)
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(60, now);
        sub.frequency.exponentialRampToValueAtTime(30, now + 0.45);

        subGain.gain.setValueAtTime(0.25, now);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

        sub.connect(subGain).connect(dest);
        sub.start(now);
        sub.stop(now + 0.4);
    }

    // Heavy Wooden Door Slam / Shut: Iron Latch Snap + Wood Modal Bank + Sub Shockwave
    playDoorClose(options = {}) {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playDoorClose(options));
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: 0.45 });

        // 1. Iron Latch Mechanical Snap Transient (12kHz impulse)
        const snapSize = this.ctx.sampleRate * 0.03;
        const snapBuf = this.ctx.createBuffer(1, snapSize, this.ctx.sampleRate);
        const snapData = snapBuf.getChannelData(0);
        for (let i = 0; i < snapSize; i++) snapData[i] = Math.random() * 2 - 1;

        const snapSrc = this.ctx.createBufferSource();
        snapSrc.buffer = snapBuf;
        const snapFilt = this.ctx.createBiquadFilter();
        snapFilt.type = 'highpass';
        snapFilt.frequency.setValueAtTime(4500, now);

        const snapGain = this.ctx.createGain();
        snapGain.gain.setValueAtTime(0.3, now);
        snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        snapSrc.connect(snapFilt).connect(snapGain).connect(dest);
        snapSrc.start(now);
        snapSrc.stop(now + 0.03);

        // 2. Oak Frame Impact Resonance (3-pole modal cluster: 110Hz, 230Hz, 460Hz)
        const modes = [110, 230, 460];
        modes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = idx === 0 ? 'triangle' : 'sine';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.8, now + 0.22);

            const vol = 0.35 / (idx + 1);
            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            osc.connect(gain).connect(dest);
            osc.start(now);
            osc.stop(now + 0.22);
        });

        // 3. Sub-Bass Frame Punch (42Hz kinetic drop)
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(95, now);
        sub.frequency.exponentialRampToValueAtTime(28, now + 0.28);

        subGain.gain.setValueAtTime(0.6, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        sub.connect(subGain).connect(dest);
        sub.start(now);
        sub.stop(now + 0.28);
    }

    // Locked Door Jiggle / Metal Chain Rattle
    playDoorLocked(options = {}) {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playDoorLocked(options));
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: 0.2 });

        // 1. Two Staggered Key Tumbler Clicks (High-Q metal pings)
        const tumblerDelays = [0.0, 0.08];
        tumblerDelays.forEach((delay) => {
            const hitTime = now + delay;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(2800, hitTime);
            osc.frequency.exponentialRampToValueAtTime(1400, hitTime + 0.04);

            gain.gain.setValueAtTime(0.18, hitTime);
            gain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.04);

            osc.connect(gain).connect(dest);
            osc.start(hitTime);
            osc.stop(hitTime + 0.04);
        });

        // 2. Iron Handle Rattle (Rapid burst of micro-strikes)
        for (let i = 0; i < 4; i++) {
            const rattleTime = now + 0.04 + (i * 0.035);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(620 + Math.random() * 300, rattleTime);

            gain.gain.setValueAtTime(0.12 * Math.pow(0.75, i), rattleTime);
            gain.gain.exponentialRampToValueAtTime(0.001, rattleTime + 0.03);

            osc.connect(gain).connect(dest);
            osc.start(rattleTime);
            osc.stop(rattleTime + 0.03);
        }

        // Layer 3: Wood Strain Thud
        const thud = this.ctx.createOscillator();
        const thudGain = this.ctx.createGain();
        thud.type = 'triangle';
        thud.frequency.setValueAtTime(135, now);
        thud.frequency.linearRampToValueAtTime(55, now + 0.18);

        thudGain.gain.setValueAtTime(0.25, now);
        thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

        thud.connect(thudGain).connect(dest);
        thud.start(now);
        thud.stop(now + 0.18);
    }

    // Heavy Iron Portcullis / Gate Slam & Chain Rattle
    playGatePortcullis(options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: 0.55 });

        // Layer 1: High-Q Steel Bar Cluster Strikes
        const ironImpulse = this.createImpulseSource(0.01, 'white');
        const ironModes = this.getMaterialModes('steel', 280);
        this.triggerModalBank(ironModes, ironImpulse, now, dest, 0.85);

        // Layer 2: Heavy Chain Jingle (Staggered inharmonic micro-rings)
        for (let i = 0; i < 5; i++) {
            const chainTime = now + 0.04 + (i * 0.045);
            const chainImpulse = this.createImpulseSource(0.004, 'white');
            const chainModes = this.getMaterialModes('steel', 750 + Math.random() * 400);
            this.triggerModalBank(chainModes, chainImpulse, chainTime, dest, 0.2 * Math.pow(0.8, i));
        }

        // Layer 3: Heavy Stone/Iron Base Crash Sub
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(110, now);
        sub.frequency.exponentialRampToValueAtTime(25, now + 0.45);

        subGain.gain.setValueAtTime(0.7, now);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

        sub.connect(subGain).connect(dest);
        sub.start(now);
        sub.stop(now + 0.45);
    }

    // Secret Stone Wall / Heavy Dungeon Slab Sliding
    playStoneSlide(options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: 0.45 });

        // Layer 1: Continuous Grinding Gravel Friction (Brownian noise through bandpass sweep)
        const size = Math.floor(this.ctx.sampleRate * 0.9);
        const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < size; i++) {
            last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04;
            d[i] = last * 4.5;
        }

        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(2.5, now);
        filter.frequency.setValueAtTime(240, now);
        filter.frequency.linearRampToValueAtTime(160, now + 0.9);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.4, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

        src.connect(filter).connect(gain).connect(dest);
        src.start(now);
        src.stop(now + 0.9);

        // Layer 2: Masonry Sub-bass Resonant Vibration (Stone mode bank)
        const stoneImpulse = this.createImpulseSource(0.012, 'brown');
        const stoneModes = this.getMaterialModes('stone', 75);
        this.triggerModalBank(stoneModes, stoneImpulse, now, dest, 0.7);
    }

    // Glass Window / Resonant Tap
    playWindowTap(options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: 0.28 });

        // Layer 1: Fingertip Soft Impulse
        const tapSrc = this.createImpulseSource(0.004, 'pink');

        // Layer 2: High-Q Glass Physical Modal Bank (1.85kHz, 3.42kHz, 6.18kHz)
        const glassModes = this.getMaterialModes('glass', 1850);
        this.triggerModalBank(glassModes, tapSrc, now, dest, 0.55);
    }

    /* ============================================================
       ENRICHED CORE COMBAT & UI SOUND DESIGN
       ============================================================ */

    playDamage(options = {}) {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playDamage(options));
            return;
        }
        if (!this.ensureContext()) return;
        const rand = (min, max) => Math.random() * (max - min) + min;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: rand(0.16, 0.24) });

        const contact = this.createImpulseSource(rand(0.003, 0.007), 'white');
        const contactFilter = this.ctx.createBiquadFilter();
        const contactGain = this.ctx.createGain();
        contactFilter.type = 'highpass';
        contactFilter.frequency.setValueAtTime(rand(3000, 4200), now);
        contactGain.gain.setValueAtTime(rand(0.22, 0.34), now);
        contactGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
        contact.connect(contactFilter).connect(contactGain).connect(dest);
        contact.start(now);
        contact.stop(now + 0.02);

        const steel = this.createImpulseSource(rand(0.004, 0.009), 'white');
        this.triggerModalBank([
            { freq: rand(1250, 1600), q: rand(32, 48), gain: 0.24, decay: 0.2 },
            { freq: rand(2600, 3200), q: rand(48, 72), gain: 0.16, decay: 0.15 },
            { freq: rand(5200, 6400), q: rand(65, 90), gain: 0.08, decay: 0.1 }
        ], steel, now + 0.004, dest, rand(0.45, 0.65));

        const body = this.createImpulseSource(rand(0.009, 0.016), 'brown');
        this.triggerModalBank([
            { freq: rand(95, 135), q: rand(3.5, 5), gain: 0.42, decay: 0.22 },
            { freq: rand(190, 270), q: rand(4.5, 7), gain: 0.24, decay: 0.16 },
            { freq: rand(360, 520), q: rand(7, 11), gain: 0.12, decay: 0.11 }
        ], body, now + rand(0.012, 0.025), dest, 0.65);

        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(rand(105, 140), now);
        sub.frequency.exponentialRampToValueAtTime(rand(28, 38), now + 0.22);
        subGain.gain.setValueAtTime(0.0001, now);
        subGain.gain.linearRampToValueAtTime(rand(0.2, 0.32), now + 0.012);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
        sub.connect(subGain).connect(dest);
        sub.start(now);
        sub.stop(now + 0.25);
    }

    // Sparkling, ambient magic swell: sweeping bandpass + detuned Cmaj9 cascade
    playHeal() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playHeal());
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ sendReverb: 0.45 });

        // 1. Magical Wind/Shimmer (Noise sweep)
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.85);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 4.5;
        filter.frequency.setValueAtTime(180, now);
        filter.frequency.exponentialRampToValueAtTime(3600, now + 0.55);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.001, now);
        noiseGain.gain.linearRampToValueAtTime(0.14, now + 0.2);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        noise.connect(filter).connect(noiseGain).connect(dest);
        noise.start(now);
        noise.stop(now + 0.85);

        // 2. Lush, Detuned Pentatonic Cascade
        const chord = [261.63, 329.63, 392.00, 493.88, 587.33]; // Cmaj9
        chord.forEach((freq, idx) => {
            const timeOffset = idx * 0.06;
            
            // Primary tone
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator(); // detuned pair for lush chorus effect
            const gain = this.ctx.createGain();

            osc1.type = 'sine';
            osc2.type = 'triangle';

            osc1.frequency.setValueAtTime(freq, now + timeOffset);
            osc2.frequency.setValueAtTime(freq + 3.5, now + timeOffset);

            gain.gain.setValueAtTime(0.001, now + timeOffset);
            gain.gain.linearRampToValueAtTime(0.075, now + timeOffset + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.65);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(dest);

            osc1.start(now + timeOffset);
            osc2.start(now + timeOffset);
            osc1.stop(now + timeOffset + 0.65);
            osc2.stop(now + timeOffset + 0.65);
        });
    }

    // Table strike followed by an irregular, progressively settling die roll.
    playDiceRoll(options = {}) {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playDiceRoll(options));
            return;
        }
        if (!this.ensureContext()) return;
        const rand = (min, max) => Math.random() * (max - min) + min;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: 0.28, volume: (options.volume || 1) * 0.7 });
        const diceCount = 3;

        // Each die has a separate trajectory: staggered table impacts create
        // the handful-of-dice impression before their clatter overlaps.
        for (let die = 0; die < diceCount; die++) {
            const dieStart = now + die * rand(0.018, 0.045);
            const dieGain = rand(0.42, 0.58);
            const tableImpulse = this.createImpulseSource(rand(0.009, 0.015), 'brown');
            this.triggerModalBank([
                { freq: rand(105, 135), q: rand(4, 6), gain: 0.58, decay: 0.22 },
                { freq: rand(210, 275), q: rand(5, 8), gain: 0.32, decay: 0.17 },
                { freq: rand(390, 520), q: rand(7, 11), gain: 0.14, decay: 0.11 }
            ], tableImpulse, dieStart, dest, dieGain);

            // Acrylic/resin edge contacts: gaps widen as energy is lost.
            let delay = rand(0.065, 0.105);
            const contacts = Math.floor(rand(8, 12));
            for (let idx = 0; idx < contacts; idx++) {
                const rollTime = dieStart + delay;
                const energy = Math.pow(rand(0.74, 0.81), idx);
                const impulse = this.createImpulseSource(rand(0.002, 0.006), 'pink');
                this.triggerModalBank([
                    { freq: rand(1700, 2350) - idx * 25, q: rand(16, 25), gain: 0.42, decay: 0.045 },
                    { freq: rand(2850, 3900) - idx * 35, q: rand(22, 34), gain: 0.24, decay: 0.032 },
                    { freq: rand(4700, 6100) - idx * 45, q: rand(26, 40), gain: 0.11, decay: 0.022 }
                ], impulse, rollTime, dest, energy * dieGain);

                const contact = this.ctx.createGain();
                contact.gain.setValueAtTime(0.16 * energy * dieGain, rollTime);
                contact.gain.exponentialRampToValueAtTime(0.0001, rollTime + 0.055);
                const contactNoise = this.createImpulseSource(0.008, 'white');
                const contactFilter = this.ctx.createBiquadFilter();
                contactFilter.type = 'bandpass';
                contactFilter.frequency.setValueAtTime(rand(900, 1700), rollTime);
                contactFilter.Q.setValueAtTime(rand(2.5, 4.5), rollTime);
                contactNoise.connect(contactFilter).connect(contact).connect(dest);
                contactNoise.start(rollTime);
                contactNoise.stop(rollTime + 0.06);

                delay += rand(0.055, 0.085) * (1 + idx * 0.08);
            }
        }
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
        const dest = this.getMasterInput();

        if (type === 'whisper') {
            const bufferSize = Math.floor(this.ctx.sampleRate * 0.15);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(4200, now);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.035, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            noise.connect(filter).connect(noiseGain).connect(dest);
            noise.start(now);
            noise.stop(now + 0.15);

            const chime = this.ctx.createOscillator();
            const chimeGain = this.ctx.createGain();
            chime.type = 'sine';
            chime.frequency.setValueAtTime(1760, now);
            chimeGain.gain.setValueAtTime(0.045, now);
            chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            chime.connect(chimeGain).connect(dest);
            chime.start(now);
            chime.stop(now + 0.22);
        } else if (type === 'party') {
            const notes = [329.63, 392.00, 523.25]; // E5, G5, C6
            notes.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                // Sine + very soft triangle harmonics for organic resonance
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + (idx * 0.03));
                gain.gain.setValueAtTime(0.055, now + (idx * 0.03));
                gain.gain.exponentialRampToValueAtTime(0.001, now + (idx * 0.03) + 0.24);
                
                osc.connect(gain).connect(dest);
                osc.start(now + (idx * 0.03));
                osc.stop(now + (idx * 0.03) + 0.24);
            });
        } else {
            // Default: A clean, warm double-tone chime (perfect fifth interval)
            const freqs = [523.25, 783.99]; // C5, G5
            freqs.forEach((freq) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);
                gain.gain.setValueAtTime(0.045, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
                osc.connect(gain).connect(dest);
                osc.start(now);
                osc.stop(now + 0.26);
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
        const dest = this.createSpatialRoute({ sendReverb: 0.4 });

        // 1. Shimmering Wind/Glitter Whoosh
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.75);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const hpFilter = this.ctx.createBiquadFilter();
        hpFilter.type = 'highpass';
        hpFilter.frequency.setValueAtTime(1400, now);
        hpFilter.frequency.exponentialRampToValueAtTime(8500, now + 0.55);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.08, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

        noise.connect(hpFilter).connect(noiseGain).connect(dest);
        noise.start(now);
        noise.stop(now + 0.75);

        // 2. Rich Detuned Synth Brass/Bell Chords (Major 9th progression)
        const notes = [261.63, 329.63, 392.00, 493.88, 523.25, 659.25]; 
        notes.forEach((freq, idx) => {
            const delay = idx * 0.04;
            const osc = this.ctx.createOscillator();
            const oscDetune = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            oscDetune.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + delay);
            oscDetune.frequency.setValueAtTime(freq + 4, now + delay);

            gain.gain.setValueAtTime(0.001, now + delay);
            gain.gain.linearRampToValueAtTime(0.085, now + delay + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.5);

            osc.connect(gain);
            oscDetune.connect(gain);
            gain.connect(dest);

            osc.start(now + delay);
            oscDetune.start(now + delay);
            osc.stop(now + delay + 0.5);
            oscDetune.stop(now + delay + 0.5);
        });
    }

    // Ominous defeat sound with heavy dust/crumbles
    playCriticalFail() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playCriticalFail());
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ sendReverb: 0.45 });

        // 1. Ominous, Detuned Low Dissonance
        const lowFreqs = [98.0, 103.8];
        lowFreqs.forEach((freq) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + 0.65);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(260, now);

            gain.gain.setValueAtTime(0.28, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

            osc.connect(filter).connect(gain).connect(dest);
            osc.start(now);
            osc.stop(now + 0.7);
        });
        
        // 2. Heavy Dust/Crumble
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.55);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const lpFilter = this.ctx.createBiquadFilter();
        lpFilter.type = 'bandpass';
        lpFilter.Q.value = 1.2;
        lpFilter.frequency.setValueAtTime(320, now);
        lpFilter.frequency.exponentialRampToValueAtTime(55, now + 0.55);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.14, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        noise.connect(lpFilter).connect(noiseGain).connect(dest);
        noise.start(now);
        noise.stop(now + 0.55);
    }

    // Epic fanfare progression
    playLevelUp() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playLevelUp());
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ sendReverb: 0.4 });

        // 1. Shimmering Whoosh/Swell
        const bufferSize = Math.floor(this.ctx.sampleRate * 1.25);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const bpFilter = this.ctx.createBiquadFilter();
        bpFilter.type = 'bandpass';
        bpFilter.Q.value = 2.2;
        bpFilter.frequency.setValueAtTime(150, now);
        bpFilter.frequency.exponentialRampToValueAtTime(3200, now + 0.75);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.001, now);
        noiseGain.gain.linearRampToValueAtTime(0.09, now + 0.3);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

        noise.connect(bpFilter).connect(noiseGain).connect(dest);
        noise.start(now);
        noise.stop(now + 1.25);

        // 2. Soaring Pentatonic Fanfare Ascent
        const fanfare = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 1046.50];
        fanfare.forEach((freq, idx) => {
            const delay = idx * 0.055;
            const osc = this.ctx.createOscillator();
            const oscChorus = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            oscChorus.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);
            oscChorus.frequency.setValueAtTime(freq * 1.006, now + delay);

            gain.gain.setValueAtTime(0.001, now + delay);
            gain.gain.linearRampToValueAtTime(0.075, now + delay + 0.05);
            const decay = idx === fanfare.length - 1 ? 0.95 : 0.35;
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + decay);

            osc.connect(gain);
            oscChorus.connect(gain);
            gain.connect(dest);

            osc.start(now + delay);
            oscChorus.start(now + delay);
            osc.stop(now + delay + decay);
            oscChorus.stop(now + delay + decay);
        });
    }

    // Modern tactile tap (High transient + subtle low body thump)
    playUIClick() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playUIClick());
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.getMasterInput();

        // High frequency transient pop
        const noiseBufferSize = Math.floor(this.ctx.sampleRate * 0.015);
        const noiseBuffer = this.ctx.createBuffer(1, noiseBufferSize, this.ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBufferSize; i++) noiseData[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2600, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.045, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

        noise.connect(filter).connect(noiseGain).connect(dest);
        noise.start(now);
        noise.stop(now + 0.012);

        // Low body thump for tactile feedback
        const bodyOsc = this.ctx.createOscillator();
        const bodyGain = this.ctx.createGain();
        bodyOsc.type = 'sine';
        bodyOsc.frequency.setValueAtTime(145, now);
        
        bodyGain.gain.setValueAtTime(0.12, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

        bodyOsc.connect(bodyGain).connect(dest);
        bodyOsc.start(now);
        bodyOsc.stop(now + 0.015);
    }

    // Cascading gold coin clink with metallic inharmonic partials
    playGoldClink() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playGoldClink());
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ sendReverb: 0.25 });

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

                gain.gain.setValueAtTime(0.014 * volumeScale, coinTime);
                gain.gain.exponentialRampToValueAtTime(0.001, coinTime + 0.11);

                osc.connect(gain).connect(dest);
                osc.start(coinTime);
                osc.stop(coinTime + 0.11);
            });
        });
    }

    // Mystical spellcast whoosh & rising arcane laser glide
    playSpellCast(options = {}) {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playSpellCast(options));
            return;
        }
        if (!this.ensureContext()) return;
        const rand = (min, max) => Math.random() * (max - min) + min;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: rand(0.38, 0.5) });

        // Mana in-rush: a filtered pink/brown noise siphon pulling down into focus.
        const siphonDuration = rand(0.38, 0.55);
        const siphon = this.createImpulseSource(siphonDuration, 'pink');
        const siphonFilter = this.ctx.createBiquadFilter();
        const siphonGain = this.ctx.createGain();
        siphonFilter.type = 'bandpass';
        siphonFilter.Q.setValueAtTime(rand(3.5, 5.5), now);
        siphonFilter.frequency.setValueAtTime(rand(2500, 3400), now);
        siphonFilter.frequency.exponentialRampToValueAtTime(rand(300, 500), now + siphonDuration);
        siphonGain.gain.setValueAtTime(0.0001, now);
        siphonGain.gain.linearRampToValueAtTime(rand(0.14, 0.22), now + 0.12);
        siphonGain.gain.exponentialRampToValueAtTime(0.0001, now + siphonDuration);
        siphon.connect(siphonFilter).connect(siphonGain).connect(dest);
        siphon.start(now);
        siphon.stop(now + siphonDuration);

        // Suspended arcane chord with detuned voices and a gentle tremolo.
        const chord = [293.66, 440, 587.33];
        chord.forEach((frequency, index) => {
            const offset = 0.04 + index * 0.025;
            const voice = this.ctx.createOscillator();
            const detuned = this.ctx.createOscillator();
            const voiceGain = this.ctx.createGain();
            const tremolo = this.ctx.createOscillator();
            const tremoloGain = this.ctx.createGain();
            voice.type = 'triangle';
            detuned.type = 'sine';
            voice.frequency.setValueAtTime(frequency, now + offset);
            detuned.frequency.setValueAtTime(frequency * rand(1.003, 1.009), now + offset);
            voice.frequency.exponentialRampToValueAtTime(frequency * rand(1.25, 1.45), now + 0.46);
            detuned.frequency.exponentialRampToValueAtTime(frequency * rand(1.25, 1.45), now + 0.46);
            voiceGain.gain.setValueAtTime(0.0001, now + offset);
            voiceGain.gain.linearRampToValueAtTime(rand(0.035, 0.055) / (index + 1), now + 0.25);
            voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
            tremolo.type = 'sine';
            tremolo.frequency.setValueAtTime(rand(3.5, 5), now + offset);
            tremoloGain.gain.setValueAtTime(rand(0.008, 0.018), now + offset);
            tremolo.connect(tremoloGain).connect(voiceGain.gain);
            voice.connect(voiceGain);
            detuned.connect(voiceGain);
            voiceGain.connect(dest);
            voice.start(now + offset);
            detuned.start(now + offset);
            tremolo.start(now + offset);
            voice.stop(now + 0.6);
            detuned.stop(now + 0.6);
            tremolo.stop(now + 0.6);
        });

        // Release beam: FM chirp instead of a clean laser beep.
        const releaseTime = now + rand(0.27, 0.36);
        const carrier = this.ctx.createOscillator();
        const modulator = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const releaseGain = this.ctx.createGain();
        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(rand(1250, 1550), releaseTime);
        carrier.frequency.exponentialRampToValueAtTime(rand(280, 380), releaseTime + 0.18);
        modulator.type = 'sawtooth';
        modulator.frequency.setValueAtTime(rand(320, 420), releaseTime);
        modGain.gain.setValueAtTime(rand(300, 480), releaseTime);
        modGain.gain.exponentialRampToValueAtTime(12, releaseTime + 0.18);
        modulator.connect(modGain).connect(carrier.frequency);
        releaseGain.gain.setValueAtTime(0.0001, releaseTime);
        releaseGain.gain.linearRampToValueAtTime(rand(0.12, 0.2), releaseTime + 0.01);
        releaseGain.gain.exponentialRampToValueAtTime(0.0001, releaseTime + 0.2);
        carrier.connect(releaseGain).connect(dest);
        modulator.start(releaseTime);
        carrier.start(releaseTime);
        modulator.stop(releaseTime + 0.21);
        carrier.stop(releaseTime + 0.21);
    }

    // Orchestral turn notification bell
    playYourTurn() {
        if (!this.enabled) return;
        if (!this.unlocked) {
            this.queue.push(() => this.playYourTurn());
            return;
        }
        if (!this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ sendReverb: 0.35 });

        const harmonics = [440.0, 880.0, 1320.0, 1760.0, 2200.0];
        harmonics.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = idx === 0 ? 'triangle' : 'sine';
            osc.frequency.setValueAtTime(freq, now);

            const decay = 0.85 / (idx + 1);
            gain.gain.setValueAtTime(0.045 / (idx + 1), now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + decay);

            osc.connect(gain).connect(dest);
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

    /* ============================================================
       ELEMENTAL SFX WITH SPATIAL ROUTING & PRESERVED DETAILS
       ============================================================ */

    playFire(options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;

        const rand = (min, max) => Math.random() * (max - min) + min;
        const now = this.ctx.currentTime;
        const continuous = !!options.continuous;
        const cycleCount = continuous ? 3 : 1;
        const cycleGap = continuous ? rand(0.7, 1.0) : 0.0;
        const burnDuration = continuous ? rand(1.35, 1.85) : rand(0.65, 0.95);
        const dest = this.createSpatialRoute({
            ...options,
            // Keep fire's layered transient and burn bed comfortably below the
            // other elemental effects; callers can still apply their own volume.
            volume: (typeof options.volume === 'number' ? options.volume : 1) * 0.5,
            sendReverb: continuous ? rand(0.22, 0.34) : rand(0.18, 0.28)
        });

        for (let cycle = 0; cycle < cycleCount; cycle++) {
            const cycleStart = now + (cycle * cycleGap);
            const ignitionLength = rand(0.26, 0.38);
            const roarDuration = burnDuration * rand(0.9, 1.12);
            const hissDuration = roarDuration * rand(0.55, 0.8);

            // =========================================================================
            // LAYER 1: THERMAL IGNITION / AIR DISPLACEMENT ("THE FWOOM")
            // =========================================================================
            const sub1 = this.ctx.createOscillator();
            const sub2 = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            const subFilter = this.ctx.createBiquadFilter();

            sub1.type = 'sine';
            sub2.type = 'triangle';

            sub1.frequency.setValueAtTime(rand(88, 98) - (cycle * 4), cycleStart);
            sub1.frequency.exponentialRampToValueAtTime(rand(28, 36), cycleStart + ignitionLength);

            sub2.frequency.setValueAtTime(rand(82, 92) - (cycle * 3), cycleStart);
            sub2.frequency.exponentialRampToValueAtTime(rand(24, 32), cycleStart + ignitionLength);

            subFilter.type = 'lowpass';
            subFilter.Q.setValueAtTime(rand(2.2, 3.1), cycleStart);
            subFilter.frequency.setValueAtTime(rand(180, 240), cycleStart);
            subFilter.frequency.exponentialRampToValueAtTime(rand(36, 60), cycleStart + ignitionLength);

            const ignitionGain = continuous ? rand(0.18, 0.28) : rand(0.14, 0.22);
            subGain.gain.setValueAtTime(ignitionGain, cycleStart);
            subGain.gain.exponentialRampToValueAtTime(0.001, cycleStart + ignitionLength + 0.03);

            sub1.connect(subFilter);
            sub2.connect(subFilter);
            subFilter.connect(subGain).connect(dest);

            sub1.start(cycleStart);
            sub2.start(cycleStart);
            sub1.stop(cycleStart + ignitionLength + 0.03);
            sub2.stop(cycleStart + ignitionLength + 0.03);

            // =========================================================================
            // LAYER 2: TURBULENT CONVECTION BODY ("THE ROAR")
            // =========================================================================
            const sampleRate = this.ctx.sampleRate;
            const frameCount = Math.floor(sampleRate * roarDuration);
            const brownBuffer = this.ctx.createBuffer(1, frameCount, sampleRate);
            const data = brownBuffer.getChannelData(0);

            let lastOut = 0.0;
            for (let i = 0; i < frameCount; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = (lastOut + (0.04 * white)) / 1.04;
                lastOut = data[i];
                data[i] *= rand(3.2, 4.4) + (cycle * 0.18);
            }

            const roarSrc = this.ctx.createBufferSource();
            roarSrc.buffer = brownBuffer;

            const roarFilter = this.ctx.createBiquadFilter();
            roarFilter.type = 'lowpass';
            roarFilter.Q.setValueAtTime(rand(1.6, 2.8), cycleStart);
            roarFilter.frequency.setValueAtTime(rand(300, 420), cycleStart);
            roarFilter.frequency.exponentialRampToValueAtTime(rand(90, 150), cycleStart + roarDuration);

            const lfo = this.ctx.createOscillator();
            const lfoGain = this.ctx.createGain();
            lfo.type = 'sine';
            lfo.frequency.setValueAtTime(rand(7.5, 11.5) + (cycle * 0.5), cycleStart + rand(0.0, 0.18));
            lfoGain.gain.setValueAtTime(rand(32, 58) + (cycle * 4), cycleStart);

            lfo.connect(lfoGain);
            lfoGain.connect(roarFilter.frequency);

            const roarGain = this.ctx.createGain();
            const roarAttack = rand(0.04, 0.1);
            const roarPeak = continuous ? rand(0.18, 0.28) : rand(0.22, 0.32);
            const roarSustain = continuous ? rand(0.14, 0.22) : rand(0.18, 0.26);

            roarGain.gain.setValueAtTime(0.001, cycleStart);
            roarGain.gain.linearRampToValueAtTime(roarPeak, cycleStart + roarAttack);
            roarGain.gain.linearRampToValueAtTime(roarSustain, cycleStart + roarDuration * 0.28);
            roarGain.gain.exponentialRampToValueAtTime(0.001, cycleStart + roarDuration);

            roarSrc.connect(roarFilter).connect(roarGain).connect(dest);
            lfo.start(cycleStart + rand(0.0, 0.2));
            roarSrc.start(cycleStart);
            lfo.stop(cycleStart + roarDuration + 0.15);
            roarSrc.stop(cycleStart + roarDuration);

            // =========================================================================
            // LAYER 3: EXPLOSIVE RESIN POCKETS & EMBERS ("THE CRACKLE & SNAPS")
            // =========================================================================
            const numPops = continuous ? rand(12, 18) : rand(10, 14);
            const popModes = [1800, 2600, 3600, 4800, 6200, 7600];

            for (let i = 0; i < numPops; i++) {
                const popWindow = continuous ? roarDuration * rand(0.7, 0.9) : roarDuration;
                const popOffset = 0.04 + Math.pow(Math.random(), 1.4) * (popWindow - 0.08);
                const popTime = cycleStart + popOffset;
                const popFreq = popModes[Math.floor(Math.random() * popModes.length)] + rand(-300, 300);

                const impulse = this.createImpulseSource(rand(0.001, 0.0025), 'brown');
                const popFilter = this.ctx.createBiquadFilter();
                popFilter.type = 'bandpass';
                popFilter.frequency.setValueAtTime(popFreq, popTime);
                popFilter.Q.setValueAtTime(rand(22, 36), popTime);

                const popGain = this.ctx.createGain();
                const pVol = rand(0.06, 0.18) * (1 - popOffset / popWindow);
                popGain.gain.setValueAtTime(pVol, popTime);
                popGain.gain.exponentialRampToValueAtTime(0.0001, popTime + rand(0.012, 0.025));

                impulse.connect(popFilter).connect(popGain).connect(dest);
                impulse.start(popTime);
                impulse.stop(popTime + 0.025);
            }

            // =========================================================================
            // DEDICATED EMBER CRACKLE LAYER: SHARP, SHORT POPS THAT CUT THROUGH
            // THIS MAKES THE flame sound feel like tiny coal bursts instead of a boom
            // =========================================================================
            const emberCrackleCount = continuous ? rand(18, 24) : rand(14, 20);
            for (let i = 0; i < emberCrackleCount; i++) {
                const emberTime = cycleStart + rand(0.04, Math.max(0.2, roarDuration * 0.8));
                const emberFreq = [1400, 2200, 3200, 4600, 6200, 7800][Math.floor(Math.random() * 6)] + rand(-250, 250);
                const emberImpulse = this.createImpulseSource(rand(0.0008, 0.0018), 'white');
                const emberFilter = this.ctx.createBiquadFilter();
                emberFilter.type = 'bandpass';
                emberFilter.frequency.setValueAtTime(emberFreq, emberTime);
                emberFilter.Q.setValueAtTime(rand(32, 58), emberTime);

                const emberGain = this.ctx.createGain();
                const emberVol = rand(0.07, 0.16);
                emberGain.gain.setValueAtTime(emberVol, emberTime);
                emberGain.gain.exponentialRampToValueAtTime(0.0001, emberTime + rand(0.008, 0.02));

                emberImpulse.connect(emberFilter).connect(emberGain).connect(dest);
                emberImpulse.start(emberTime);
                emberImpulse.stop(emberTime + 0.024);
            }

            // =========================================================================
            // ADDITIONAL EMBER RUMBLE: FILTERED BROWN NOISE ONLY, VERY LOW LEVEL
            // THIS SHOULD SUPPORT THE flame body without overpowering the snaps
            // =========================================================================
            const crackleLength = Math.max(0.7, roarDuration * rand(0.9, 1.1));
            const crackleBuffer = this.ctx.createBuffer(1, Math.floor(sampleRate * crackleLength), sampleRate);
            const crackleData = crackleBuffer.getChannelData(0);
            let crackleLast = 0.0;
            for (let i = 0; i < crackleData.length; i++) {
                const white = Math.random() * 2 - 1;
                crackleLast = (crackleLast + (0.06 * white)) / 1.06;
                crackleData[i] = crackleLast * rand(3.2, 4.8);
            }

            const crackleSrc = this.ctx.createBufferSource();
            crackleSrc.buffer = crackleBuffer;

            const crackleHighpass = this.ctx.createBiquadFilter();
            crackleHighpass.type = 'highpass';
            crackleHighpass.frequency.setValueAtTime(rand(220, 340), cycleStart);

            const crackleLowpass = this.ctx.createBiquadFilter();
            crackleLowpass.type = 'lowpass';
            crackleLowpass.Q.setValueAtTime(0.0, cycleStart);
            crackleLowpass.frequency.setValueAtTime(4200, cycleStart);

            const crackleGain = this.ctx.createGain();
            const crackleLfo = this.ctx.createOscillator();
            const crackleLfoGain = this.ctx.createGain();

            crackleGain.gain.setValueAtTime(0.0001, cycleStart);
            crackleGain.gain.linearRampToValueAtTime(continuous ? rand(0.04, 0.07) : rand(0.05, 0.09), cycleStart + rand(0.12, 0.22));
            crackleGain.gain.linearRampToValueAtTime(continuous ? rand(0.03, 0.05) : rand(0.04, 0.07), cycleStart + crackleLength * 0.55);
            crackleGain.gain.exponentialRampToValueAtTime(0.0001, cycleStart + crackleLength);

            crackleLfo.type = 'sine';
            crackleLfo.frequency.setValueAtTime(rand(0.25, 0.6), cycleStart);
            crackleLfoGain.gain.setValueAtTime(rand(0.008, 0.018), cycleStart);

            crackleSrc.connect(crackleHighpass);
            crackleSrc.connect(crackleLowpass);
            crackleHighpass.connect(crackleGain);
            crackleLowpass.connect(crackleGain);
            crackleGain.connect(dest);

            crackleLfo.connect(crackleLfoGain);
            crackleLfoGain.connect(crackleGain.gain);
            crackleLfo.start(cycleStart + Math.random() * 0.9);
            crackleLfo.stop(cycleStart + crackleLength + 0.2);

            crackleSrc.start(cycleStart);
            crackleSrc.stop(cycleStart + crackleLength);

            // =========================================================================
            // LAYER 4: HIGH-FREQUENCY OXYGEN IN-DRAFT ("THE SIZZLE & HISS")
            // =========================================================================
            const hissSrc = this.createImpulseSource(hissDuration * 0.75, 'white');
            const hissFilter = this.ctx.createBiquadFilter();
            hissFilter.type = 'highpass';
            hissFilter.frequency.setValueAtTime(rand(2800, 3600), cycleStart);

            const hissGain = this.ctx.createGain();
            const hissPeak = rand(0.04, 0.08);
            hissGain.gain.setValueAtTime(0.001, cycleStart);
            hissGain.gain.linearRampToValueAtTime(hissPeak, cycleStart + rand(0.06, 0.12));
            hissGain.gain.linearRampToValueAtTime(rand(0.03, 0.06), cycleStart + hissDuration * 0.28);
            hissGain.gain.exponentialRampToValueAtTime(0.001, cycleStart + hissDuration);

            hissSrc.connect(hissFilter).connect(hissGain).connect(dest);
            hissSrc.start(cycleStart);
            hissSrc.stop(cycleStart + hissDuration);
        }
    }

    playWater(options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: 0.3 });

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

        noise.connect(filter).connect(gain).connect(dest);
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

            osc.connect(bubbleGain).connect(dest);
            osc.start(now + delay);
            osc.stop(now + delay + 0.06);
        }
    }

    playBlood(options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const rand = (min, max) => Math.random() * (max - min) + min;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: rand(0.18, 0.28) });
        const duration = rand(0.34, 0.52);
        const sampleRate = this.ctx.sampleRate;
        const buffer = this.ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < data.length; i++) {
            const white = Math.random() * 2 - 1;
            lastOut = (lastOut + 0.065 * white) / 1.065;
            data[i] = lastOut * 4.5;
        }

        // Tissue rupture: a brief, bright wet tear before the gush.
        const tear = this.createImpulseSource(rand(0.009, 0.018), 'pink');
        const tearFilter = this.ctx.createBiquadFilter();
        const tearGain = this.ctx.createGain();
        tearFilter.type = 'bandpass';
        tearFilter.frequency.setValueAtTime(rand(850, 1450), now);
        tearFilter.Q.setValueAtTime(rand(2.5, 4.5), now);
        tearGain.gain.setValueAtTime(rand(0.16, 0.24), now);
        tearGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        tear.connect(tearFilter).connect(tearGain).connect(dest);
        tear.start(now);
        tear.stop(now + 0.045);

        // Parallel organic formants: thick low cavity plus moist tissue shear.
        const gushSource = this.ctx.createBufferSource();
        const formantLow = this.ctx.createBiquadFilter();
        const formantHigh = this.ctx.createBiquadFilter();
        const gushGain = this.ctx.createGain();
        gushSource.buffer = buffer;
        formantLow.type = 'bandpass';
        formantLow.frequency.setValueAtTime(rand(320, 390), now);
        formantLow.frequency.exponentialRampToValueAtTime(rand(185, 230), now + duration);
        formantLow.Q.setValueAtTime(rand(3.8, 5.2), now);
        formantHigh.type = 'bandpass';
        formantHigh.frequency.setValueAtTime(rand(900, 1100), now);
        formantHigh.frequency.exponentialRampToValueAtTime(rand(580, 720), now + duration);
        formantHigh.Q.setValueAtTime(rand(4.5, 6.5), now);
        gushGain.gain.setValueAtTime(0.0001, now);
        gushGain.gain.linearRampToValueAtTime(rand(0.24, 0.34), now + rand(0.012, 0.025));
        gushGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        gushSource.connect(formantLow).connect(gushGain);
        gushSource.connect(formantHigh).connect(gushGain);
        gushGain.connect(dest);
        gushSource.start(now);
        gushSource.stop(now + duration);

        // Low-Q viscous bubble resonances ("gloop" and "shluck").
        const bubbleCount = Math.floor(rand(3, 5));
        for (let i = 0; i < bubbleCount; i++) {
            const bubbleTime = now + rand(0.025, Math.min(0.3, duration * 0.75));
            const bubbleDuration = rand(0.045, 0.085);
            const bubble = this.ctx.createOscillator();
            const bubbleFilter = this.ctx.createBiquadFilter();
            const bubbleGain = this.ctx.createGain();
            const startFreq = rand(130, 280);
            bubble.type = Math.random() > 0.35 ? 'sine' : 'triangle';
            bubble.frequency.setValueAtTime(startFreq, bubbleTime);
            bubble.frequency.exponentialRampToValueAtTime(rand(280, 500), bubbleTime + bubbleDuration);
            bubbleFilter.type = 'lowpass';
            bubbleFilter.frequency.setValueAtTime(rand(500, 750), bubbleTime);
            bubbleFilter.Q.setValueAtTime(rand(1.2, 2.5), bubbleTime);
            bubbleGain.gain.setValueAtTime(rand(0.07, 0.13), bubbleTime);
            bubbleGain.gain.exponentialRampToValueAtTime(0.0001, bubbleTime + bubbleDuration);
            bubble.connect(bubbleFilter).connect(bubbleGain).connect(dest);
            bubble.start(bubbleTime);
            bubble.stop(bubbleTime + bubbleDuration);
        }

        // Hydrostatic pressure release gives the wet impact grounded weight.
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(rand(82, 115), now);
        sub.frequency.exponentialRampToValueAtTime(rand(30, 42), now + 0.2);
        subGain.gain.setValueAtTime(0.0001, now);
        subGain.gain.linearRampToValueAtTime(rand(0.18, 0.28), now + 0.012);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.23);
        sub.connect(subGain).connect(dest);
        sub.start(now);
        sub.stop(now + 0.24);

        // Irregular droplets add small, viscous splats behind the main gush.
        const dropletCount = Math.floor(rand(3, 6));
        for (let i = 0; i < dropletCount; i++) {
            const dropletTime = now + rand(0.07, duration * 0.95);
            const droplet = this.createImpulseSource(rand(0.008, 0.018), 'white');
            const dropletFilter = this.ctx.createBiquadFilter();
            const dropletGain = this.ctx.createGain();
            dropletFilter.type = 'lowpass';
            dropletFilter.frequency.setValueAtTime(rand(550, 850), dropletTime);
            dropletGain.gain.setValueAtTime(rand(0.035, 0.075), dropletTime);
            dropletGain.gain.exponentialRampToValueAtTime(0.0001, dropletTime + 0.035);
            droplet.connect(dropletFilter).connect(dropletGain).connect(dest);
            droplet.start(dropletTime);
            droplet.stop(dropletTime + 0.04);
        }
    }

    playHoly(options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const rand = (min, max) => Math.random() * (max - min) + min;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: rand(0.45, 0.58) });

        // Glass chime strike: inharmonic high-Q modes create a luminous attack.
        const chimeImpulse = this.createImpulseSource(0.004, 'white');
        this.triggerModalBank([
            { freq: rand(1700, 1950), q: rand(38, 52), gain: 0.28, decay: 0.38 },
            { freq: rand(2550, 2900), q: rand(52, 70), gain: 0.2, decay: 0.3 },
            { freq: rand(3900, 4400), q: rand(68, 90), gain: 0.13, decay: 0.24 }
        ], chimeImpulse, now, dest, rand(0.5, 0.7));

        // Wide, shimmering crystalline rise
        const chords = [329.63, 415.30, 493.88, 659.25, 830.61]; 
        chords.forEach((freq, idx) => {
            const delay = idx * 0.035;
            const osc = this.ctx.createOscillator();
            const pGain = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);
            
            pGain.gain.setValueAtTime(0.001, now + delay);
            pGain.gain.linearRampToValueAtTime(0.055, now + delay + 0.1);
            pGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.5);

            osc.connect(pGain).connect(dest);
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
        hp.frequency.exponentialRampToValueAtTime(3600, now + 0.4);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        noise.connect(hp).connect(gain).connect(dest);
        noise.start(now);
        noise.stop(now + 0.45);
    }

    playDark(options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const rand = (min, max) => Math.random() * (max - min) + min;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: rand(0.4, 0.52) });

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

        noise.connect(notch).connect(lp).connect(gain).connect(dest);
        noise.start(now);
        noise.stop(now + 0.7);

        // Sinister detuned low sub-bass growl
        const sub1 = this.ctx.createOscillator();
        const sub2 = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        
        sub1.type = 'sawtooth';
        sub1.frequency.setValueAtTime(rand(34, 37), now);
        sub1.frequency.linearRampToValueAtTime(rand(25, 29), now + 0.6);
        
        sub2.type = 'sawtooth';
        sub2.frequency.setValueAtTime(rand(38, 41), now);
        sub2.frequency.linearRampToValueAtTime(rand(28, 32), now + 0.6);
        
        const subLp = this.ctx.createBiquadFilter();
        subLp.type = 'lowpass';
        subLp.frequency.setValueAtTime(100, now);
        
        subGain.gain.setValueAtTime(0.001, now);
        subGain.gain.linearRampToValueAtTime(rand(0.16, 0.24), now + 0.2);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        
        sub1.connect(subLp);
        sub2.connect(subLp);
        subLp.connect(subGain).connect(dest);
        
        sub1.start(now);
        sub2.start(now);
        sub1.stop(now + 0.6);
        sub2.stop(now + 0.6);

        // Tritone formant drone adds unstable harmonic tension above the void.
        const duration = 0.75;
        const tritone1 = this.ctx.createOscillator();
        const tritone2 = this.ctx.createOscillator();
        const tritoneFilter = this.ctx.createBiquadFilter();
        const tritoneGain = this.ctx.createGain();
        tritone1.type = 'triangle';
        tritone2.type = 'sawtooth';
        tritone1.frequency.setValueAtTime(rand(70, 77), now);
        tritone1.frequency.exponentialRampToValueAtTime(rand(52, 60), now + duration);
        tritone2.frequency.setValueAtTime(rand(98, 108), now);
        tritone2.frequency.exponentialRampToValueAtTime(rand(72, 84), now + duration);
        tritoneFilter.type = 'bandpass';
        tritoneFilter.frequency.setValueAtTime(rand(220, 330), now);
        tritoneFilter.frequency.exponentialRampToValueAtTime(rand(85, 125), now + duration);
        tritoneFilter.Q.setValueAtTime(rand(2.5, 4), now);
        tritoneGain.gain.setValueAtTime(0.0001, now);
        tritoneGain.gain.linearRampToValueAtTime(rand(0.12, 0.2), now + 0.12);
        tritoneGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        tritone1.connect(tritoneFilter);
        tritone2.connect(tritoneFilter);
        tritoneFilter.connect(tritoneGain).connect(dest);
        tritone1.start(now);
        tritone2.start(now);
        tritone1.stop(now + duration);
        tritone2.stop(now + duration);
    }

    playFrost(options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const rand = (min, max) => Math.random() * (max - min) + min;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: rand(0.34, 0.48) });

        // Brittle lattice fracture: one impulse excites several inharmonic,
        // high-Q crystal modes for a sharp ice-sheet snap.
        const snapImpulse = this.createImpulseSource(rand(0.0025, 0.005), 'white');
        const iceModes = [
            { freq: rand(1750, 1950), q: rand(28, 40), gain: 0.42, decay: 0.09 },
            { freq: rand(4050, 4450), q: rand(45, 62), gain: 0.28, decay: 0.07 },
            { freq: rand(7200, 8100), q: rand(65, 82), gain: 0.17, decay: 0.05 },
            { freq: rand(10800, 12100), q: rand(78, 96), gain: 0.1, decay: 0.035 }
        ];
        this.triggerModalBank(iceModes, snapImpulse, now, dest, rand(0.55, 0.75));

        // Thermal strain: detuned oscillators create an eerie, beating creak.
        const creakDuration = rand(0.22, 0.34);
        const creak1 = this.ctx.createOscillator();
        const creak2 = this.ctx.createOscillator();
        const creakMod = this.ctx.createOscillator();
        const creakModGain = this.ctx.createGain();
        const creakFilter = this.ctx.createBiquadFilter();
        const creakGain = this.ctx.createGain();
        creak1.type = 'sine';
        creak2.type = 'triangle';
        creak1.frequency.setValueAtTime(rand(1180, 1450), now);
        creak1.frequency.exponentialRampToValueAtTime(rand(2550, 3000), now + creakDuration);
        creak2.frequency.setValueAtTime(rand(1200, 1480), now);
        creak2.frequency.exponentialRampToValueAtTime(rand(2600, 3070), now + creakDuration);
        creakMod.type = 'sine';
        creakMod.frequency.setValueAtTime(rand(5, 9), now);
        creakModGain.gain.setValueAtTime(rand(8, 18), now);
        creakMod.connect(creakModGain).connect(creak1.frequency);
        creakFilter.type = 'bandpass';
        creakFilter.frequency.setValueAtTime(rand(1650, 1950), now);
        creakFilter.frequency.exponentialRampToValueAtTime(rand(2800, 3400), now + creakDuration);
        creakFilter.Q.setValueAtTime(rand(4, 6), now);
        creakGain.gain.setValueAtTime(0.0001, now);
        creakGain.gain.linearRampToValueAtTime(rand(0.11, 0.18), now + 0.035);
        creakGain.gain.exponentialRampToValueAtTime(0.0001, now + creakDuration);
        creak1.connect(creakFilter);
        creak2.connect(creakFilter);
        creakFilter.connect(creakGain).connect(dest);
        creak1.start(now);
        creak2.start(now);
        creakMod.start(now);
        creak1.stop(now + creakDuration);
        creak2.stop(now + creakDuration);
        creakMod.stop(now + creakDuration);

        // Aeolian frost wind: pink noise through two moving resonant vortexes.
        const windDuration = rand(0.52, 0.72);
        const windBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * windDuration), this.ctx.sampleRate);
        const windData = windBuffer.getChannelData(0);
        let windB0 = 0;
        let windB1 = 0;
        for (let i = 0; i < windData.length; i++) {
            const white = Math.random() * 2 - 1;
            windB0 = 0.985 * windB0 + 0.055 * white;
            windB1 = 0.92 * windB1 + 0.16 * white;
            windData[i] = (windB0 + windB1) * 2.1;
        }
        const windSource = this.ctx.createBufferSource();
        const windLow = this.ctx.createBiquadFilter();
        const windHigh = this.ctx.createBiquadFilter();
        const windGain = this.ctx.createGain();
        const shiver = this.ctx.createOscillator();
        const shiverGain = this.ctx.createGain();
        windSource.buffer = windBuffer;
        windLow.type = 'bandpass';
        windLow.Q.setValueAtTime(rand(5, 7), now);
        windLow.frequency.setValueAtTime(rand(800, 1050), now);
        windLow.frequency.exponentialRampToValueAtTime(rand(1900, 2500), now + windDuration * 0.4);
        windLow.frequency.exponentialRampToValueAtTime(rand(560, 760), now + windDuration);
        windHigh.type = 'bandpass';
        windHigh.Q.setValueAtTime(rand(7, 10), now);
        windHigh.frequency.setValueAtTime(rand(1400, 1800), now);
        windHigh.frequency.exponentialRampToValueAtTime(rand(800, 1100), now + windDuration);
        shiver.type = 'sine';
        shiver.frequency.setValueAtTime(rand(9, 13), now);
        shiverGain.gain.setValueAtTime(rand(45, 95), now);
        shiver.connect(shiverGain).connect(windLow.frequency);
        windGain.gain.setValueAtTime(0.0001, now);
        windGain.gain.linearRampToValueAtTime(rand(0.12, 0.2), now + 0.07);
        windGain.gain.exponentialRampToValueAtTime(0.0001, now + windDuration);
        windSource.connect(windLow).connect(windGain);
        windSource.connect(windHigh).connect(windGain);
        windGain.connect(dest);
        windSource.start(now);
        windSource.stop(now + windDuration);
        shiver.start(now);
        shiver.stop(now + windDuration);

        // Shard cascade: small resonant rings scatter behind the main fracture.
        const shardPitches = [3200, 4300, 5600, 6900, 7800];
        for (let i = 0; i < Math.floor(rand(5, 8)); i++) {
            const shardTime = now + rand(0.08, windDuration * 0.8);
            const shardFreq = shardPitches[Math.floor(Math.random() * shardPitches.length)] + rand(-180, 180);
            const shard = this.ctx.createOscillator();
            const shardGain = this.ctx.createGain();
            shard.type = Math.random() > 0.2 ? 'sine' : 'triangle';
            shard.frequency.setValueAtTime(shardFreq, shardTime);
            shard.frequency.exponentialRampToValueAtTime(shardFreq * rand(1.04, 1.16), shardTime + 0.05);
            shardGain.gain.setValueAtTime(rand(0.025, 0.055), shardTime);
            shardGain.gain.exponentialRampToValueAtTime(0.0001, shardTime + rand(0.045, 0.09));
            shard.connect(shardGain).connect(dest);
            shard.start(shardTime);
            shard.stop(shardTime + 0.1);
        }
    }

    playAcid(options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: 0.25 });

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

        noise.connect(hp).connect(gain).connect(dest);
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
            
            osc.connect(pGain).connect(dest);
            osc.start(popTime);
            osc.stop(popTime + 0.02);
        }
    }

    playLightning(options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: 0.35 });

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

        noise.connect(hp).connect(lp).connect(gain).connect(dest);
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

        zap.connect(zGain).connect(dest);
        zap.start(now);
        zap.stop(now + 0.08);
    }

    playForce(options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const rand = (min, max) => Math.random() * (max - min) + min;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: rand(0.25, 0.36) });

        const vortexDuration = rand(0.65, 0.95);
        const vortexBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * vortexDuration), this.ctx.sampleRate);
        const vortexData = vortexBuffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < vortexData.length; i++) {
            const white = Math.random() * 2 - 1;
            lastOut = (lastOut + 0.06 * white) / 1.06;
            vortexData[i] = lastOut * 3.8;
        }

        // Inward spectral sweep: the vortex opens wide, then tightens into a
        // narrow low-frequency singularity.
        const vortex = this.ctx.createBufferSource();
        const vortexFilter = this.ctx.createBiquadFilter();
        const vortexGain = this.ctx.createGain();
        const vortexLfo = this.ctx.createOscillator();
        const vortexLfoGain = this.ctx.createGain();
        vortex.buffer = vortexBuffer;
        vortexFilter.type = 'bandpass';
        vortexFilter.Q.setValueAtTime(rand(1.8, 3), now);
        vortexFilter.frequency.setValueAtTime(rand(1800, 2800), now);
        vortexFilter.frequency.exponentialRampToValueAtTime(rand(180, 320), now + vortexDuration * 0.72);
        vortexFilter.frequency.exponentialRampToValueAtTime(rand(65, 130), now + vortexDuration);
        vortexGain.gain.setValueAtTime(0.0001, now);
        vortexGain.gain.linearRampToValueAtTime(rand(0.12, 0.18), now + vortexDuration * 0.62);
        vortexGain.gain.exponentialRampToValueAtTime(0.0001, now + vortexDuration);
        vortexLfo.type = 'sine';
        vortexLfo.frequency.setValueAtTime(rand(2.2, 4.8), now);
        vortexLfoGain.gain.setValueAtTime(rand(80, 180), now);
        vortexLfo.connect(vortexLfoGain).connect(vortexFilter.frequency);
        vortex.connect(vortexFilter).connect(vortexGain).connect(dest);
        vortex.start(now);
        vortex.stop(now + vortexDuration);
        vortexLfo.start(now);
        vortexLfo.stop(now + vortexDuration + 0.02);

        // Magical harmonic gravity: two detuned oscillators slowly emerge from
        // the noise and fade after the vortex collapses.
        const toneBus = this.ctx.createGain();
        const toneGain = this.ctx.createGain();
        const toneFilter = this.ctx.createBiquadFilter();
        const toneLfo = this.ctx.createOscillator();
        const toneLfoGain = this.ctx.createGain();
        toneFilter.type = 'lowpass';
        toneFilter.frequency.setValueAtTime(rand(700, 1100), now);
        toneFilter.frequency.exponentialRampToValueAtTime(rand(160, 280), now + vortexDuration);
        toneGain.gain.setValueAtTime(0.0001, now);
        toneGain.gain.linearRampToValueAtTime(rand(0.08, 0.13), now + vortexDuration * 0.48);
        toneGain.gain.exponentialRampToValueAtTime(0.0001, now + vortexDuration + 0.22);
        toneLfo.type = 'sine';
        toneLfo.frequency.setValueAtTime(rand(0.35, 0.8), now);
        toneLfoGain.gain.setValueAtTime(rand(0.012, 0.025), now);
        toneLfo.connect(toneLfoGain).connect(toneGain.gain);
        toneBus.connect(toneFilter).connect(toneGain).connect(dest);
        [0, rand(-12, 12)].forEach((detune, index) => {
            const tone = this.ctx.createOscillator();
            tone.type = index === 0 ? 'sine' : 'triangle';
            tone.frequency.setValueAtTime(rand(90, 135), now);
            tone.frequency.exponentialRampToValueAtTime(rand(34, 55), now + vortexDuration);
            tone.detune.setValueAtTime(detune, now);
            tone.connect(toneBus);
            tone.start(now);
            tone.stop(now + vortexDuration + 0.25);
        });
        toneLfo.start(now);
        toneLfo.stop(now + vortexDuration + 0.25);

        // A tiny release click marks the moment the stored force discharges.
        const release = this.createImpulseSource(0.004, 'white');
        const releaseFilter = this.ctx.createBiquadFilter();
        const releaseGain = this.ctx.createGain();
        const releaseTime = now + vortexDuration * 0.82;
        releaseFilter.type = 'highpass';
        releaseFilter.frequency.setValueAtTime(rand(2400, 4200), releaseTime);
        releaseGain.gain.setValueAtTime(rand(0.06, 0.1), releaseTime);
        releaseGain.gain.exponentialRampToValueAtTime(0.0001, releaseTime + 0.035);
        release.connect(releaseFilter).connect(releaseGain).connect(dest);
        release.start(releaseTime);
        release.stop(releaseTime + 0.04);
    }

    playSmoke(options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: 0.25 });

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

        noise.connect(filter).connect(gain).connect(dest);
        noise.start(now);
        noise.stop(now + 0.45);
    }

    playSlash(options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const rand = (min, max) => Math.random() * (max - min) + min;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: rand(0.2, 0.3) });
        const duration = rand(0.28, 0.38);

        // Doppler air shear: rapid up/down spectral motion sells blade velocity.
        const whoosh = this.createImpulseSource(duration, 'pink');
        const whooshFilter = this.ctx.createBiquadFilter();
        const whooshGain = this.ctx.createGain();
        whooshFilter.type = 'bandpass';
        whooshFilter.Q.setValueAtTime(rand(3, 5), now);
        whooshFilter.frequency.setValueAtTime(rand(1200, 1700), now);
        whooshFilter.frequency.exponentialRampToValueAtTime(rand(3200, 4200), now + duration * 0.28);
        whooshFilter.frequency.exponentialRampToValueAtTime(rand(450, 700), now + duration);
        whooshGain.gain.setValueAtTime(0.0001, now);
        whooshGain.gain.linearRampToValueAtTime(rand(0.2, 0.32), now + duration * 0.28);
        whooshGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        whoosh.connect(whooshFilter).connect(whooshGain).connect(dest);
        whoosh.start(now);
        whoosh.stop(now + duration);

        // Tempered steel sing at the swing apex.
        const singTime = now + rand(0.055, 0.085);
        const carrier = this.ctx.createOscillator();
        const mod = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const singGain = this.ctx.createGain();
        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(rand(1650, 2050), singTime);
        carrier.frequency.exponentialRampToValueAtTime(rand(700, 1050), singTime + 0.2);
        mod.type = 'sawtooth';
        mod.frequency.setValueAtTime(rand(300, 430), singTime);
        modGain.gain.setValueAtTime(rand(220, 360), singTime);
        modGain.gain.exponentialRampToValueAtTime(12, singTime + 0.2);
        mod.connect(modGain).connect(carrier.frequency);
        singGain.gain.setValueAtTime(0.0001, singTime);
        singGain.gain.linearRampToValueAtTime(rand(0.08, 0.14), singTime + 0.02);
        singGain.gain.exponentialRampToValueAtTime(0.0001, singTime + 0.2);
        carrier.connect(singGain).connect(dest);
        mod.start(singTime);
        carrier.start(singTime);
        mod.stop(singTime + 0.21);
        carrier.stop(singTime + 0.21);

        // Edge bite and a light mass displacement arrive just behind the whoosh.
        const biteTime = now + rand(0.065, 0.095);
        const bite = this.createImpulseSource(0.012, 'pink');
        const biteFilter = this.ctx.createBiquadFilter();
        const biteGain = this.ctx.createGain();
        biteFilter.type = 'bandpass';
        biteFilter.frequency.setValueAtTime(rand(900, 1500), biteTime);
        biteFilter.Q.setValueAtTime(rand(2.5, 4), biteTime);
        biteGain.gain.setValueAtTime(rand(0.1, 0.18), biteTime);
        biteGain.gain.exponentialRampToValueAtTime(0.0001, biteTime + 0.045);
        bite.connect(biteFilter).connect(biteGain).connect(dest);
        bite.start(biteTime);
        bite.stop(biteTime + 0.05);

        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(rand(105, 140), now);
        sub.frequency.exponentialRampToValueAtTime(rand(34, 48), now + 0.22);
        subGain.gain.setValueAtTime(0.0001, now);
        subGain.gain.linearRampToValueAtTime(rand(0.1, 0.17), now + 0.07);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
        sub.connect(subGain).connect(dest);
        sub.start(now);
        sub.stop(now + 0.25);
    }

    playImpact(options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const rand = (min, max) => Math.random() * (max - min) + min;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: rand(0.24, 0.34) });

        // Kinetic contact crack followed by dense material resonance.
        const snap = this.createImpulseSource(rand(0.003, 0.007), 'white');
        const snapFilter = this.ctx.createBiquadFilter();
        const snapGain = this.ctx.createGain();
        snapFilter.type = 'highpass';
        snapFilter.frequency.setValueAtTime(rand(1800, 2800), now);
        snapGain.gain.setValueAtTime(rand(0.22, 0.36), now);
        snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
        snap.connect(snapFilter).connect(snapGain).connect(dest);
        snap.start(now);
        snap.stop(now + 0.025);

        const body = this.createImpulseSource(rand(0.008, 0.016), 'brown');
        this.triggerModalBank([
            { freq: rand(120, 165), q: rand(5, 8), gain: 0.42, decay: 0.25 },
            { freq: rand(240, 330), q: rand(7, 11), gain: 0.28, decay: 0.18 },
            { freq: rand(430, 620), q: rand(9, 15), gain: 0.16, decay: 0.13 }
        ], body, now + rand(0.006, 0.018), dest, rand(0.55, 0.8));

        // Heavy concussive sub displacement.
        const sub1 = this.ctx.createOscillator();
        const sub2 = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub1.type = 'sine';
        sub2.type = 'triangle';
        sub1.frequency.setValueAtTime(rand(72, 92), now);
        sub1.frequency.exponentialRampToValueAtTime(rand(30, 40), now + 0.28);
        sub2.frequency.setValueAtTime(rand(68, 88), now);
        sub2.frequency.exponentialRampToValueAtTime(rand(26, 36), now + 0.28);
        subGain.gain.setValueAtTime(0.0001, now);
        subGain.gain.linearRampToValueAtTime(rand(0.2, 0.32), now + 0.012);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        sub1.connect(subGain);
        sub2.connect(subGain);
        subGain.connect(dest);
        sub1.start(now);
        sub2.start(now);
        sub1.stop(now + 0.31);
        sub2.stop(now + 0.31);

        // Debris and splinter scatter with irregular timing.
        for (let i = 0; i < Math.floor(rand(4, 7)); i++) {
            const debrisTime = now + rand(0.04, 0.22);
            const debris = this.createImpulseSource(rand(0.002, 0.006), 'pink');
            const debrisFilter = this.ctx.createBiquadFilter();
            const debrisGain = this.ctx.createGain();
            debrisFilter.type = 'bandpass';
            debrisFilter.frequency.setValueAtTime(rand(700, 2200), debrisTime);
            debrisFilter.Q.setValueAtTime(rand(6, 14), debrisTime);
            debrisGain.gain.setValueAtTime(rand(0.025, 0.07), debrisTime);
            debrisGain.gain.exponentialRampToValueAtTime(0.0001, debrisTime + rand(0.018, 0.045));
            debris.connect(debrisFilter).connect(debrisGain).connect(dest);
            debris.start(debrisTime);
            debris.stop(debrisTime + 0.05);
        }
    }

    playMissileLaunch(styleKey, options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({ ...options, sendReverb: 0.3 });

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

                noise.connect(lp).connect(gain).connect(dest);
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

                wind.connect(gain).connect(dest);
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

                noise.connect(hp).connect(gain).connect(dest);
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

                osc.connect(gain).connect(dest);
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

                osc.connect(gain).connect(dest);
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

                noise.connect(bp).connect(gain).connect(dest);
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

                osc.connect(gain).connect(dest);
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

                osc.connect(gain).connect(dest);
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

                osc.connect(gain).connect(dest);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            }
        }
    }

    playLightning(options = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;

        const rand = (min, max) => Math.random() * (max - min) + min;
        const now = this.ctx.currentTime;
        const dest = this.createSpatialRoute({
            ...options,
            sendReverb: options.sendReverb ?? 0.38,
            volume: (typeof options.volume === 'number' ? options.volume : 1) * 0.65
        });

        // Dielectric breakdown: a short, bright broadband snap.
        const snap = this.createImpulseSource(rand(0.003, 0.006), 'white');
        const snapHighpass = this.ctx.createBiquadFilter();
        const snapPeak = this.ctx.createBiquadFilter();
        const snapGain = this.ctx.createGain();
        snapHighpass.type = 'highpass';
        snapHighpass.frequency.setValueAtTime(rand(3200, 4200), now);
        snapPeak.type = 'peaking';
        snapPeak.frequency.setValueAtTime(rand(6800, 8200), now);
        snapPeak.Q.setValueAtTime(rand(2, 4), now);
        snapPeak.gain.setValueAtTime(rand(5, 9), now);
        snapGain.gain.setValueAtTime(rand(0.28, 0.42), now);
        snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
        snap.connect(snapHighpass).connect(snapPeak).connect(snapGain).connect(dest);
        snap.start(now);
        snap.stop(now + 0.05);

        // Plasma arc: a gritty FM carrier with a short downward discharge sweep.
        const carrier = this.ctx.createOscillator();
        const modulator = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const arcFilter = this.ctx.createBiquadFilter();
        const arcGain = this.ctx.createGain();
        const arcLfo = this.ctx.createOscillator();
        const arcLfoGain = this.ctx.createGain();
        const arcStart = rand(1350, 1850);
        const arcEnd = rand(360, 560);
        const arcDuration = rand(0.3, 0.42);
        carrier.type = 'sawtooth';
        carrier.frequency.setValueAtTime(arcStart, now);
        carrier.frequency.exponentialRampToValueAtTime(arcEnd, now + arcDuration);
        modulator.type = 'triangle';
        modulator.frequency.setValueAtTime(rand(110, 145), now);
        modulator.frequency.linearRampToValueAtTime(rand(72, 95), now + arcDuration);
        modGain.gain.setValueAtTime(rand(360, 560), now);
        modGain.gain.exponentialRampToValueAtTime(rand(60, 100), now + arcDuration);
        arcFilter.type = 'bandpass';
        arcFilter.frequency.setValueAtTime(rand(1700, 2400), now);
        arcFilter.frequency.exponentialRampToValueAtTime(rand(500, 750), now + arcDuration);
        arcFilter.Q.setValueAtTime(rand(2.5, 4.5), now);
        arcGain.gain.setValueAtTime(0.0001, now);
        arcGain.gain.linearRampToValueAtTime(rand(0.16, 0.25), now + 0.008);
        arcGain.gain.linearRampToValueAtTime(rand(0.07, 0.12), now + arcDuration * 0.55);
        arcGain.gain.exponentialRampToValueAtTime(0.0001, now + arcDuration + 0.06);
        arcLfo.type = 'sine';
        arcLfo.frequency.setValueAtTime(rand(6, 13), now);
        arcLfo.detune.setValueAtTime(rand(-35, 35), now);
        arcLfoGain.gain.setValueAtTime(rand(0.018, 0.04), now);
        modulator.connect(modGain).connect(carrier.frequency);
        carrier.connect(arcFilter).connect(arcGain).connect(dest);
        arcLfo.connect(arcLfoGain).connect(arcGain.gain);
        modulator.start(now);
        carrier.start(now);
        arcLfo.start(now + rand(0, 0.08));
        modulator.stop(now + arcDuration + 0.08);
        carrier.stop(now + arcDuration + 0.08);
        arcLfo.stop(now + arcDuration + 0.08);

        // Thermal expansion and collapse: detuned low-frequency concussion.
        const sub1 = this.ctx.createOscillator();
        const sub2 = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub1.type = 'sine';
        sub2.type = 'triangle';
        sub1.frequency.setValueAtTime(rand(88, 112), now + 0.004);
        sub1.frequency.exponentialRampToValueAtTime(rand(26, 34), now + 0.22);
        sub2.frequency.setValueAtTime(rand(78, 98), now + 0.004);
        sub2.frequency.exponentialRampToValueAtTime(rand(22, 30), now + 0.22);
        subGain.gain.setValueAtTime(0.0001, now);
        subGain.gain.linearRampToValueAtTime(rand(0.22, 0.34), now + 0.014);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.27);
        sub1.connect(subGain);
        sub2.connect(subGain);
        subGain.connect(dest);
        sub1.start(now + 0.004);
        sub2.start(now + 0.004);
        sub1.stop(now + 0.28);
        sub2.stop(now + 0.28);

        // Short thunder-like tail: rolling brown noise and moving low-pass
        // resonance give the strike a grounded, weather-scale aftershock.
        const tailStart = now + rand(0.07, 0.13);
        const tailDuration = rand(1.3, 2.0);
        const tailBuffer = this.ctx.createBuffer(
            1,
            Math.floor(this.ctx.sampleRate * (tailDuration + 0.1)),
            this.ctx.sampleRate
        );
        const tailData = tailBuffer.getChannelData(0);
        let tailLast = 0;
        for (let i = 0; i < tailData.length; i++) {
            const white = Math.random() * 2 - 1;
            tailLast = (tailLast + 0.035 * white) / 1.035;
            tailData[i] = tailLast * 4.2;
        }

        const tailSource = this.ctx.createBufferSource();
        const tailFilter = this.ctx.createBiquadFilter();
        const tailGain = this.ctx.createGain();
        tailSource.buffer = tailBuffer;
        tailFilter.type = 'lowpass';
        tailFilter.Q.setValueAtTime(rand(1.2, 2.2), tailStart);
        tailFilter.frequency.setValueAtTime(rand(260, 430), tailStart);
        tailFilter.frequency.exponentialRampToValueAtTime(rand(55, 95), tailStart + tailDuration);
        tailGain.gain.setValueAtTime(0.0001, tailStart);
        tailGain.gain.linearRampToValueAtTime(rand(0.08, 0.14), tailStart + rand(0.06, 0.12));
        for (let i = 1; i <= 4; i++) {
            const swellTime = tailStart + (tailDuration * i / 5);
            tailGain.gain.linearRampToValueAtTime(rand(0.035, 0.085) * (1 - i * 0.12), swellTime);
        }
        tailGain.gain.exponentialRampToValueAtTime(0.0001, tailStart + tailDuration);
        tailSource.connect(tailFilter).connect(tailGain).connect(dest);
        tailSource.start(tailStart);
        tailSource.stop(tailStart + tailDuration + 0.04);

        // Subtle electrical air: white noise whose level flickers with a
        // randomized slow LFO, adding movement without becoming a hiss bed.
        const staticDuration = rand(0.5, 0.8);
        const staticSource = this.createImpulseSource(staticDuration, 'white');
        const staticFilter = this.ctx.createBiquadFilter();
        const staticGain = this.ctx.createGain();
        const staticLfo = this.ctx.createOscillator();
        const staticLfoGain = this.ctx.createGain();
        staticFilter.type = 'highpass';
        staticFilter.frequency.setValueAtTime(rand(1800, 2800), now);
        staticGain.gain.setValueAtTime(0.0001, now);
        staticGain.gain.linearRampToValueAtTime(rand(0.018, 0.032), now + 0.012);
        staticGain.gain.exponentialRampToValueAtTime(0.0001, now + staticDuration);
        staticLfo.type = 'sine';
        staticLfo.frequency.setValueAtTime(rand(4.5, 9.5), now);
        staticLfoGain.gain.setValueAtTime(rand(0.008, 0.016), now);
        staticSource.connect(staticFilter).connect(staticGain).connect(dest);
        staticLfo.connect(staticLfoGain).connect(staticGain.gain);
        staticSource.start(now);
        staticSource.stop(now + staticDuration);
        staticLfo.start(now + rand(0, 0.08));
        staticLfo.stop(now + staticDuration + 0.02);

        // Additional corona shimmer: a bright, narrow sizzle with irregular
        // tremolo that bridges the initial snap and the trailing micro-arcs.
        const shimmerDuration = rand(0.45, 0.72);
        const shimmerSource = this.createImpulseSource(shimmerDuration, 'white');
        const shimmerHighpass = this.ctx.createBiquadFilter();
        const shimmerBandpass = this.ctx.createBiquadFilter();
        const shimmerGain = this.ctx.createGain();
        const shimmerLfo = this.ctx.createOscillator();
        const shimmerLfoGain = this.ctx.createGain();
        shimmerHighpass.type = 'highpass';
        shimmerHighpass.frequency.setValueAtTime(rand(4200, 5600), now);
        shimmerBandpass.type = 'bandpass';
        shimmerBandpass.frequency.setValueAtTime(rand(6200, 8200), now);
        shimmerBandpass.Q.setValueAtTime(rand(2.5, 4.5), now);
        shimmerGain.gain.setValueAtTime(0.0001, now);
        shimmerGain.gain.linearRampToValueAtTime(rand(0.025, 0.045), now + 0.018);
        shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + shimmerDuration);
        shimmerLfo.type = 'sine';
        shimmerLfo.frequency.setValueAtTime(rand(13, 22), now + rand(0, 0.04));
        shimmerLfoGain.gain.setValueAtTime(rand(0.012, 0.026), now);
        shimmerSource.connect(shimmerHighpass).connect(shimmerBandpass).connect(shimmerGain).connect(dest);
        shimmerLfo.connect(shimmerLfoGain).connect(shimmerGain.gain);
        shimmerSource.start(now);
        shimmerSource.stop(now + shimmerDuration);
        shimmerLfo.start(now);
        shimmerLfo.stop(now + shimmerDuration + 0.02);

        // Branching corona: staggered narrow micro-arcs trailing the strike.
        const branchCount = Math.floor(rand(7, 11));
        for (let i = 0; i < branchCount; i++) {
            const branchTime = now + rand(0.025, 0.5);
            const frequency = rand(2800, 8600);
            const spark = this.createImpulseSource(rand(0.001, 0.003), 'white');
            const sparkFilter = this.ctx.createBiquadFilter();
            const sparkGain = this.ctx.createGain();
            sparkFilter.type = 'bandpass';
            sparkFilter.frequency.setValueAtTime(frequency, branchTime);
            sparkFilter.Q.setValueAtTime(rand(10, 22), branchTime);
            sparkGain.gain.setValueAtTime(rand(0.035, 0.08), branchTime);
            sparkGain.gain.exponentialRampToValueAtTime(0.0001, branchTime + rand(0.018, 0.045));
            spark.connect(sparkFilter).connect(sparkGain).connect(dest);
            spark.start(branchTime);
            spark.stop(branchTime + 0.05);
        }
    }

    // Router fallback
    playElementSound(styleKey, options = {}) {
        switch (styleKey) {
            case 'fire':      this.playFire(options); break;
            case 'water':     this.playWater(options); break;
            case 'blood':     this.playBlood(options); break;
            case 'holy':      this.playHoly(options); break;
            case 'dark':      this.playDark(options); break;
            case 'frost':     this.playFrost(options); break;
            case 'acid':      this.playAcid(options); break;
            case 'smoke':     this.playSmoke(options); break;
            case 'slash':     this.playSlash(options); break;
            case 'impact':    this.playImpact(options); break;
            case 'lightning': this.playLightning(options); break;
            case 'force':     this.playForce(options); break;
            case 'healing':   this.playHeal(); break;
            case 'damage':    this.playDamage(options); break;
            default:          this.playDamage(options); break;
        }
    }

    playSoundStack(layers = [], { masterVolume = 1 } = {}) {
        if (!this.enabled || !this.unlocked || !this.ensureContext()) return;

        const startTime = this.ctx.currentTime;
        layers.forEach((layer) => {
            if (!layer || layer.enabled === false) return;
            const delay = Math.max(0, Number(layer.delay) || 0);
            const volume = Math.max(0, Math.min(1, Number(layer.volume) || 0));
            const options = {
                pan: Number(layer.pan) || 0,
                distance: Number(layer.distance) || 0,
                continuous: Boolean(layer.loop),
                volume: volume * Math.max(0, Math.min(1, masterVolume))
            };

            if (delay === 0) {
                this.playElementSound(layer.sound, options);
            } else {
                const timer = window.setTimeout(() => {
                    this.activeStackTimers.delete(timer);
                    this.playElementSound(layer.sound, options);
                }, delay * 1000);
                this.activeStackTimers.add(timer);
            }
        });

        return startTime;
    }

    stopSoundStack() {
        this.activeStackTimers.forEach((timer) => window.clearTimeout(timer));
        this.activeStackTimers.clear();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        this.activeRoutes.forEach((route) => {
            route.gain.cancelScheduledValues(now);
            route.gain.setValueAtTime(Math.max(0.0001, route.gain.value), now);
            route.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        });
        this.activeRoutes.clear();
    }
}

// Export singleton
export default new SoundSynthesizer();