// AudioWorklet processors for the live voice call. Runs off the main thread.

// Speech-only voice activity detector (energy + zero-crossing rate + crest factor + duration).
// Knocks, clicks and object sounds are short, peaky bursts; speech is sustained and smooth.
// A frame is "voiced" only if it is loud relative to the noise floor, has a speech-like ZCR
// and a low peak-to-RMS ratio. Onset needs ~180ms of voiced audio inside a 250ms window.
class VadProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.floor = 0.004;
    this.voicedMs = 0;
    this.speaking = false;
    this.silentMs = 0;
    this.n = 0;
    this.zcrAvg = 0.1;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let e = 0, z = 0, peak = 0;
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      e += ch[i] * ch[i];
      if (a > peak) peak = a;
      if (i && (ch[i] >= 0) !== (ch[i - 1] >= 0)) z++;
    }
    const rms = Math.sqrt(e / ch.length);
    const zcr = z / ch.length;
    const crest = rms > 0 ? peak / rms : 99;
    const frameMs = (ch.length / sampleRate) * 1000;
    if (!this.speaking) this.floor = this.floor * 0.995 + Math.min(rms, 0.05) * 0.005;
    this.zcrAvg = this.zcrAvg * 0.9 + zcr * 0.1;
    const voiced = rms > Math.max(0.02, this.floor * 4) && zcr > 0.004 && zcr < 0.25 && this.zcrAvg < 0.25 && crest < 8;
    // Leaky integrator: voiced frames add time, other frames drain it faster.
    this.voicedMs = voiced ? Math.min(250, this.voicedMs + frameMs) : Math.max(0, this.voicedMs - frameMs * 1.5);
    if (voiced) this.silentMs = 0; else this.silentMs += frameMs;
    if (!this.speaking && this.voicedMs >= 180) {
      this.speaking = true;
      this.port.postMessage({ type: "onset", detectMs: this.voicedMs });
    }
    if (this.speaking && this.silentMs > 300) {
      this.speaking = false;
      this.voicedMs = 0;
      this.port.postMessage({ type: "offset" });
    }
    if (++this.n % 6 === 0) this.port.postMessage({ type: "level", rms, zcr, speaking: this.speaking, silentMs: this.silentMs, floor: this.floor, crest, voicedMs: this.voicedMs });
    return true;
  }
}

// Ring-buffer player: ingests the remote PCM stream, plays it smoothly, can be flushed instantly.
class RingPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = sampleRate; // 1s capacity
    this.buf = new Float32Array(this.size);
    this.w = 0; this.r = 0; this.fill = 0;
    this.prefill = 256; this.primed = false;
    this.ducked = false; this.muted = false;
    this.underruns = 0; this.playedSpeech = 0; this.n = 0; this.inRms = 0;
    this.port.onmessage = ({ data }) => {
      if (data.type === "flush") { this.r = this.w; this.fill = 0; this.primed = false; }
      else if (data.type === "duck") this.ducked = data.on;
      else if (data.type === "mute") this.muted = data.on;
    };
  }
  process(inputs, outputs) {
    const inp = inputs[0] && inputs[0][0];
    const out = outputs[0];
    const len = out[0].length;
    let ie = 0;
    if (inp) {
      for (let i = 0; i < inp.length; i++) {
        const s = inp[i];
        ie += s * s;
        if (this.ducked) continue; // drop frames of an interrupted turn
        this.buf[this.w] = s;
        this.w = (this.w + 1) % this.size;
        if (this.fill < this.size) this.fill++; else this.r = (this.r + 1) % this.size;
      }
      this.inRms = Math.sqrt(ie / inp.length);
    }
    if (!this.primed && this.fill >= this.prefill) this.primed = true;
    let oe = 0;
    for (let i = 0; i < len; i++) {
      let s = 0;
      if (this.primed && this.fill > 0) {
        s = this.buf[this.r];
        this.r = (this.r + 1) % this.size;
        this.fill--;
      } else if (this.primed) { this.primed = false; this.underruns++; }
      if (this.muted) s = 0;
      oe += s * s;
      for (let c = 0; c < out.length; c++) out[c][i] = s;
    }
    const rms = Math.sqrt(oe / len);
    if (rms > 0.01) this.playedSpeech += (len / sampleRate) * 1000;
    if (++this.n % 6 === 0) {
      this.port.postMessage({ type: "level", rms, inRms: this.inRms, fillMs: (this.fill / sampleRate) * 1000, underruns: this.underruns, playedMs: this.playedSpeech });
    }
    return true;
  }
}

registerProcessor("vad-processor", VadProcessor);
registerProcessor("ring-player", RingPlayer);
