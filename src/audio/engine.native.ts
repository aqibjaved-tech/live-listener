import { Linking, PermissionsAndroid, Platform } from 'react-native';
import { ActivityAction, startActivityAsync } from 'expo-intent-launcher';
import {
  AnalyserNode,
  AudioContext,
  AudioManager,
  AudioRecorder,
  FileDirectory,
  FileFormat,
  FilePreset,
  GainNode,
} from 'react-native-audio-api';
import { getConnectedBluetoothDevices, setBluetoothCallMode } from '../../modules/bluetooth-names';
import {
  AudioDevice,
  CapturedTake,
  classifyDevice,
  LevelHandler,
  LiveEngine,
  PHONE_MIC,
  StartOptions,
} from './types';

const WAVE_POINTS = 32;
const supportsCommunication = Platform.OS !== 'android' || Number(Platform.Version) >= 31;

const recorder = new AudioRecorder({
  androidInputPreset: 'voiceCommunication',
  iosVoiceProcessing: true,
});

type Graph = {
  context: AudioContext;
  gain: GainNode;
  left: GainNode;
  right: GainNode;
  analyser: AnalyserNode;
};

let graph: Graph | null = null;
let wired = false;
let levelHandler: LevelHandler | null = null;
let meter: ReturnType<typeof setInterval> | null = null;
let timeDomain = new Uint8Array(256);
let receiverGain = 0.65;
let receiverEar: 'left' | 'right' = 'right';
let holding = false;
let healing = false;
let switching = false;
let activeOptions: StartOptions | null = null;
let dropHandler: (() => void) | null = null;
let watchdog: ReturnType<typeof setInterval> | null = null;
let missingHeadsetPolls = 0;

function configureSession(): void {
  AudioManager.setSystemOptions({
    ios: {
      category: 'playAndRecord',
      mode: 'voiceChat',
      options: ['allowBluetoothHFP', 'allowBluetoothA2DP', 'bluetoothHighQualityRecording', 'defaultToSpeaker'],
    },
    android: supportsCommunication
      ? {
          mode: 'inCommunication',
          communicationDevice: 'systemDefault',
        }
      : {},
  });
}

function releaseAdapter(): void {
  try {
    recorder.disconnect();
  } catch {
    // The adapter is already gone.
  }
  wired = false;
}

async function closeGraph(): Promise<void> {
  releaseAdapter();
  const current = graph;
  graph = null;
  if (current && current.context.state !== 'closed') {
    await current.context.close().catch(() => undefined);
  }
}

function buildGraph(): Graph {
  const context = new AudioContext({
    latencyHint: 'interactive',
    androidOutputProfile: 'voiceCommunication',
  });
  const gain = context.createGain();
  const left = context.createGain();
  const right = context.createGain();
  const merger = context.createChannelMerger(2);
  const analyser = context.createAnalyser();
  gain.gain.value = 1;
  left.channelCount = 1;
  left.channelCountMode = 'explicit';
  right.channelCount = 1;
  right.channelCountMode = 'explicit';
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.28;
  gain.connect(left);
  gain.connect(right);
  left.connect(merger, 0, 0);
  right.connect(merger, 0, 1);
  merger.connect(analyser);
  analyser.connect(context.destination);
  timeDomain = new Uint8Array(analyser.fftSize);
  context.onerror = () => {
    wired = false;
    if (holding) void heal();
  };
  const next = { context, gain, left, right, analyser };
  applyLevelsOn(next);
  return next;
}

async function ensureGraph(): Promise<Graph> {
  if (!graph || graph.context.state === 'closed') {
    graph = buildGraph();
    wired = false;
  }
  if (graph.context.state !== 'running') {
    await graph.context.resume();
  }
  if (!wired) {
    recorder.connect(graph.context, graph.gain);
    wired = true;
  }
  graph.gain.gain.value = 1;
  applyLevels();
  return graph;
}

function applyEar(ear: 'left' | 'right'): void {
  receiverEar = ear;
  applyLevels();
}

function applyLevels(): void {
  if (graph) applyLevelsOn(graph);
}

function applyLevelsOn(target: Graph): void {
  target.left.gain.value = receiverGain;
  target.right.gain.value = receiverGain;
}

function stopMeter(): void {
  if (meter) {
    clearInterval(meter);
    meter = null;
  }
}

function startMeter(): void {
  stopMeter();
  meter = setInterval(() => {
    const analyser = graph?.analyser;
    if (!analyser) return;
    try {
      analyser.getByteTimeDomainData(timeDomain);
    } catch {
      return;
    }
    const samples: number[] = [];
    let peak = 0;
    const step = timeDomain.length / WAVE_POINTS;
    for (let index = 0; index < WAVE_POINTS; index += 1) {
      const source = timeDomain[Math.floor(index * step)] ?? 128;
      const sample = (source - 128) / 128;
      samples.push(sample);
      const level = Math.abs(sample);
      if (level > peak) peak = level;
    }
    levelHandler?.(peak, samples);
  }, 180);
}

function toDevice(id: string, name: string, category: string): AudioDevice {
  return {
    id,
    name: name.trim() || 'Audio device',
    category: category.trim() || 'Audio',
    kind: classifyDevice(name, category),
  };
}

async function openBluetoothSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    await startActivityAsync(ActivityAction.BLUETOOTH_SETTINGS);
    return;
  }
  try {
    await Linking.openURL('App-Prefs:Bluetooth');
  } catch {
    await Linking.openSettings();
  }
}

async function holdCallRoute(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (activeOptions?.headset) {
    await setBluetoothCallMode(true);
  }
  if (supportsCommunication) {
    await AudioManager.setAudioSessionActivity(true).catch(() => undefined);
  }
}

async function releaseCallRoute(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (supportsCommunication) {
    await AudioManager.setAudioSessionActivity(false).catch(() => undefined);
  }
  await setBluetoothCallMode(false);
}

async function armOutputs(): Promise<void> {
  if (!activeOptions?.record) {
    await recorder.disableFileOutput().catch(() => undefined);
    return;
  }
  recorder.enableFileOutput({
    format: FileFormat.M4A,
    preset: FilePreset.High,
    directory: FileDirectory.Document,
    subDirectory: 'recordings',
    fileName: `listen-${Date.now()}`,
    channelCount: 1,
  });
}

async function reopenOutput(): Promise<void> {
  releaseAdapter();
  const current = graph;
  graph = null;
  wired = false;
  if (current && current.context.state !== 'closed') {
    await current.context.close().catch(() => undefined);
  }
  await ensureGraph();
}

async function capture() {
  releaseAdapter();
  await ensureGraph();
  return recorder.start();
}

async function settlePlayback(): Promise<void> {
  if (!activeOptions?.headset) return;
  await setBluetoothCallMode(true);
  await reopenOutput();
}

async function headsetGone(): Promise<boolean> {
  if (!activeOptions?.headset || Platform.OS !== 'android') return false;
  const labels = await getConnectedBluetoothDevices();
  if (labels.length === 0) return true;
  const inputId = activeOptions.inputId;
  if (inputId?.startsWith('bt:')) {
    const address = inputId.slice(3);
    return !labels.some((label) => label.id === address);
  }
  return false;
}

function stopWatchdog(): void {
  if (watchdog) {
    clearInterval(watchdog);
    watchdog = null;
  }
}

function startWatchdog(): void {
  stopWatchdog();
  missingHeadsetPolls = 0;
  watchdog = setInterval(() => {
    void guard();
  }, 1000);
}

async function heal(): Promise<void> {
  if (!holding || healing || switching) return;
  healing = true;
  try {
    if (await headsetGone()) return;
    if (recorder.isRecording()) {
      await recorder.stop().catch(() => undefined);
    }
    if (!holding) return;
    await closeGraph();
    await holdCallRoute();
    await armOutputs();
    const result = await capture();
    if (!holding) {
      if (recorder.isRecording()) await recorder.stop().catch(() => undefined);
      return;
    }
    if (result.status === 'error') return;
    startMeter();
    await settlePlayback();
  } catch {
    // The watchdog tries again while the user still wants the relay.
  } finally {
    healing = false;
  }
}

async function guard(): Promise<void> {
  if (!holding || healing || switching) return;
  if (await headsetGone()) {
    missingHeadsetPolls += 1;
    if (missingHeadsetPolls < 2) return;
    holding = false;
    stopWatchdog();
    dropHandler?.();
    return;
  }
  missingHeadsetPolls = 0;
  const contextDown = !graph || graph.context.state !== 'running';
  if (contextDown || !recorder.isRecording()) {
    await heal();
  }
}

recorder.onError(() => {
  if (holding) void heal();
});

export const engine: LiveEngine = {
  async prepare() {
    configureSession();
    const permission = await AudioManager.requestRecordingPermissions();
    if (permission !== 'Granted') {
      throw new Error('Allow microphone access to send live audio between your earbuds.');
    }
    if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
    }
  },

  async listDevices() {
    await this.prepare();
    const wasRecording = recorder.isRecording();
    if (!wasRecording && supportsCommunication) {
      await AudioManager.setAudioSessionActivity(true).catch(() => undefined);
    }
    try {
      const info = await AudioManager.getDevicesInfo();
      const labels = await getConnectedBluetoothDevices();
      const inputs = info.availableInputs.map((device) => toDevice(device.id, device.name, device.category));
      const outputs = info.availableOutputs.map((device) => toDevice(device.id, device.name, device.category));
      const headsets = inputs.flatMap((device) => {
        const label = labels.find(
          (item) => device.name.trim().toLowerCase() === item.name.trim().toLowerCase() || device.id === `bt:${item.id}`,
        );
        return label ? [{ ...device, name: label.name, kind: 'bluetooth' as const }] : [];
      });
      for (const label of labels) {
        const listed = headsets.some((device) => device.name.toLowerCase() === label.name.toLowerCase() || device.id === `bt:${label.id}`);
        if (!listed) {
          headsets.unshift({
            id: `bt:${label.id}`,
            name: label.name,
            category: 'Bluetooth',
            kind: 'bluetooth',
          });
        }
      }
      const phone = inputs.find((device) => device.kind === 'phone') ?? PHONE_MIC;
      return {
        inputs: [...headsets, phone],
        outputs,
      };
    } finally {
      if (!wasRecording && supportsCommunication && !holding) {
        await AudioManager.setAudioSessionActivity(false).catch(() => undefined);
      }
    }
  },

  openBluetoothSettings,

  async start(options) {
    await this.prepare();
    activeOptions = options;
    applyEar(options.receiverEar);
    receiverGain = options.gain;
    holding = true;

    try {
      if (recorder.isRecording()) {
        await recorder.stop();
      }

      if (options.headset) {
        await AudioManager.setInputDevice('default').catch(() => undefined);
      } else if (options.inputId && !options.inputId.startsWith('bt:')) {
        await AudioManager.setInputDevice(options.inputId).catch(() => undefined);
      }

      await holdCallRoute();
      await armOutputs();

      const result = await capture();
      if (result.status === 'error' && /adapter node is unavailable/i.test(result.message)) {
        await closeGraph();
        const retry = await capture();
        if (retry.status === 'error') {
          throw new Error(retry.message || 'The microphone did not start.');
        }
      } else if (result.status === 'error') {
        throw new Error(result.message || 'The microphone did not start.');
      }
      startMeter();
      startWatchdog();
      await settlePlayback();
    } catch (error) {
      holding = false;
      stopWatchdog();
      stopMeter();
      await graph?.context.suspend().catch(() => undefined);
      await releaseCallRoute();
      throw error;
    }
  },

  async stop() {
    holding = false;
    stopWatchdog();
    stopMeter();
    levelHandler?.(0, Array.from({ length: WAVE_POINTS }, () => 0));
    let captured: CapturedTake | null = null;
    if (recorder.isRecording()) {
      const result = await recorder.stop();
      if (result.status === 'success' && result.paths.length > 0 && result.duration > 0.25) {
        captured = {
          path: result.paths[0] ?? '',
          duration: result.duration,
          size: result.size,
        };
      }
    }
    releaseAdapter();
    await graph?.context.suspend().catch(() => undefined);
    await releaseCallRoute();
    activeOptions = null;
    return captured && captured.path ? captured : null;
  },

  async setRecording(record) {
    if (!holding || !activeOptions || activeOptions.record === record) return null;
    switching = true;
    activeOptions = { ...activeOptions, record };
    let captured: CapturedTake | null = null;
    try {
      if (recorder.isRecording()) {
        const result = await recorder.stop();
        if (!record && result.status === 'success' && result.paths.length > 0 && result.duration > 0.25) {
          captured = {
            path: result.paths[0] ?? '',
            duration: result.duration,
            size: result.size,
          };
        }
      }
      if (!holding) return captured && captured.path ? captured : null;
      await armOutputs();
      const started = await capture();
      if (started.status === 'error' && /adapter node is unavailable/i.test(started.message)) {
        await closeGraph();
        const retry = await capture();
        if (retry.status === 'error') {
          throw new Error(retry.message || 'Recording could not be changed.');
        }
      } else if (started.status === 'error') {
        throw new Error(started.message || 'Recording could not be changed.');
      }
      startMeter();
      return captured && captured.path ? captured : null;
    } finally {
      switching = false;
    }
  },

  setGain(value) {
    receiverGain = Math.min(1, Math.max(0, value));
    applyLevels();
  },

  setReceiverEar(ear) {
    applyEar(ear);
  },

  setLevelHandler(handler) {
    levelHandler = handler;
  },

  setDropHandler(handler) {
    dropHandler = handler;
  },
};
