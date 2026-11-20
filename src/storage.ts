import * as FileSystem from 'expo-file-system/legacy';
import { Ear } from './audio/types';

export interface Take {
  id: string;
  path: string;
  duration: number;
  size: number;
  createdAt: number;
  senderEar: Ear;
  receiverEar: Ear;
  deviceName: string;
}

export interface PersistedSession {
  selectedId: string | null;
  receiverEar: Ear;
  gain: number;
  recordArmed: boolean;
  takes: Take[];
}

const FILE_NAME = 'live-listener.json';
let memory: PersistedSession | null = null;

function fileUri(): string | null {
  if (!FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory}${FILE_NAME}`;
}

export async function loadSession(): Promise<PersistedSession | null> {
  try {
    const uri = fileUri();
    if (!uri) return memory;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(uri);
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed || !Array.isArray(parsed.takes)) return null;
    return parsed;
  } catch {
    return memory;
  }
}

export async function saveSession(session: PersistedSession): Promise<void> {
  memory = session;
  try {
    const uri = fileUri();
    if (!uri) return;
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(session));
  } catch {
    memory = session;
  }
}

export async function deleteTakeFile(path: string): Promise<void> {
  if (!path) return;
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    return undefined;
  }
}
