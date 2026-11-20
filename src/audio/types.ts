export type Ear = 'left' | 'right';

export type DeviceKind = 'bluetooth' | 'phone' | 'wired' | 'other';

export interface AudioDevice {
  id: string;
  name: string;
  category: string;
  kind: DeviceKind;
}

export interface CapturedTake {
  path: string;
  duration: number;
  size: number;
}

export interface StartOptions {
  inputId: string | null;
  receiverEar: Ear;
  gain: number;
  record: boolean;
  headset?: boolean;
}

export type LevelHandler = (level: number, bands: number[]) => void;

export interface LiveEngine {
  prepare(): Promise<void>;
  listDevices(): Promise<{ inputs: AudioDevice[]; outputs: AudioDevice[] }>;
  openBluetoothSettings(): Promise<void>;
  start(options: StartOptions): Promise<void>;
  stop(): Promise<CapturedTake | null>;
  setRecording(record: boolean): Promise<CapturedTake | null>;
  setGain(value: number): void;
  setReceiverEar(ear: Ear): void;
  setLevelHandler(handler: LevelHandler | null): void;
  setDropHandler(handler: (() => void) | null): void;
}

export const PHONE_MIC: AudioDevice = {
  id: 'default',
  name: 'This phone',
  category: 'Built-in microphone',
  kind: 'phone',
};

export function classifyDevice(name: string, category: string): DeviceKind {
  const blob = `${name} ${category}`.toLowerCase();
  if (
    blob.includes('bluetooth') ||
    blob.includes('airpod') ||
    blob.includes('buds') ||
    blob.includes('tws') ||
    blob.includes('galaxy')
  ) {
    return 'bluetooth';
  }
  if (blob.includes('wired') || blob.includes('usb') || blob.includes('headphone')) {
    return 'wired';
  }
  if (
    blob.includes('built-in') ||
    blob.includes('builtin') ||
    blob.includes('iphone') ||
    blob.includes('pixel') ||
    blob.includes('microphone') ||
    blob.includes('speaker') ||
    blob.includes('handset') ||
    blob.includes('earpiece')
  ) {
    return 'phone';
  }
  return 'other';
}

export function otherEar(ear: Ear): Ear {
  return ear === 'left' ? 'right' : 'left';
}

export function earLabel(ear: Ear): string {
  return ear === 'left' ? 'Left' : 'Right';
}
