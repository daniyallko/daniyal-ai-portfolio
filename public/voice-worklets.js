// AudioWorklet processors for the live voice call. Runs off the main thread.

// Spectral-energy + zero-crossing-rate voice activity detector.
// 128-sample frames (~2.7ms @48k); onset after 3 voiced frames (<10ms).
class VadProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.floor = 0.004;
    this.run = 0;
    this.speaking = false;
    this.silentMs = 0;
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let e = 0, z = 0;
    for (let i = 0; i < ch.length; i++) {
      e += ch[i] * ch[i];
      if (i && (ch[i] >= 0) !== (ch[i - 1] >= 0)) z++;
    }
    const rms = Math.sqrt(e / ch.length);
    const zcr = z / ch.length;
    const frameMs = (ch.length / sampleRate) * 1000;
    if (!this.speaking) this.floor = this.floor * 0.995 + Math.min(rms, 0.05) * 0.005;
    const voiced = rms > Math.max(0.015, this.floor * 3) && zcr > 0.005 && zcr < 0.4;
    if (voiced) { this.run++; this.silentMs = 0; } else { this.run = 0; this.silentMs += frameMs; }
    if (!this.speaking && this.run >= 3) {
      this.speaking = true;
      this.port.postMessage({ type: "onset", detectMs: this.run * frameMs });
    }
    if (this.speaking && this.silentMs > 250) {
      this.speaking = false;
      this.port.postMessage({ type: "offset" });
    }
    if (++this.n % 6 === 0) this.port.postMessage({ type: "level", rms, zcr, speaking: this.speaking, silentMs: this.silentMs, floor: this.floor });
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
