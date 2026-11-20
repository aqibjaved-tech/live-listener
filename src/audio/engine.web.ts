import { AudioDevice, CapturedTake, LevelHandler, LiveEngine, PHONE_MIC, StartOptions } from './types';

const WAVE_POINTS = 64;

let recording = false;
let live = false;
let recordStartedAt = 0;
let levelHandler: LevelHandler | null = null;
let meter: ReturnType<typeof setInterval> | null = null;
let stream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;

function stopMeter(): void {
  if (meter) {
    clearInterval(meter);
    meter = null;
  }
}

function silence(): void {
  levelHandler?.(0, Array.from({ length: WAVE_POINTS }, () => 0));
}

export const engine: LiveEngine = {
  async prepare() {
    return undefined;
  },

  async listDevices() {
    return {
      inputs: [PHONE_MIC],
      outputs: [],
    };
  },

  async openBluetoothSettings() {
    return undefined;
  },

  async start(_options: StartOptions) {
    live = true;
    recording = _options.record;
    recordStartedAt = _options.record ? Date.now() : 0;
    stopMeter();
    const media = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream = media;
    const context = new AudioContext();
    const node = context.createAnalyser();
    node.fftSize = 256;
    node.smoothingTimeConstant = 0.28;
    context.createMediaStreamSource(media).connect(node);
    audioContext = context;
    analyser = node;
    const timeDomain = new Uint8Array(node.fftSize);
    meter = setInterval(() => {
      node.getByteTimeDomainData(timeDomain);
      const samples: number[] = [];
      let peak = 0;
      const step = timeDomain.length / WAVE_POINTS;
      for (let index = 0; index < WAVE_POINTS; index += 1) {
        const source = timeDomain[Math.floor(index * step)] ?? 128;
        const sample = (source - 128) / 128;
        samples.push(sample);
        peak = Math.max(peak, Math.abs(sample));
      }
      levelHandler?.(peak, samples);
    }, 40);
  },

  async stop() {
    stopMeter();
    silence();
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    await audioContext?.close().catch(() => undefined);
    audioContext = null;
    analyser = null;
    live = false;
    if (!recording) return null;
    const duration = Math.max(0.4, (Date.now() - recordStartedAt) / 1000);
    recording = false;
    const captured: CapturedTake = {
      path: '',
      duration,
      size: duration * 0.02,
    };
    return captured;
  },

  async setRecording(record) {
    if (!live || recording === record) return null;
    if (record) {
      recording = true;
      recordStartedAt = Date.now();
      return null;
    }
    const duration = Math.max(0.4, (Date.now() - recordStartedAt) / 1000);
    recording = false;
    return {
      path: '',
      duration,
      size: duration * 0.02,
    };
  },

  setGain() {
    return undefined;
  },

  setReceiverEar() {
    return undefined;
  },

  setLevelHandler(handler: LevelHandler | null) {
    levelHandler = handler;
  },

  setDropHandler() {
    return undefined;
  },
};
