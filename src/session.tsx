import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Platform } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { engine } from './audio/engine';
import { getConnectedBluetoothDevices, isBluetoothEnabled } from '../modules/bluetooth-names';
import { AudioDevice, Ear, otherEar } from './audio/types';
import { errorMessage } from './format';
import { confirm, tap } from './haptics';
import { PersistedSession, Take, deleteTakeFile, loadSession, saveSession } from './storage';

export type ScreenName = 'home' | 'devices' | 'roles' | 'stage' | 'library';

export interface HeadsetNotice {
  title: string;
  detail: string;
  saved: boolean;
}

interface SessionValue {
  screen: ScreenName;
  setScreen: (screen: ScreenName) => void;
  reduceMotion: boolean;
  devices: AudioDevice[];
  outputs: AudioDevice[];
  refreshing: boolean;
  refreshDevices: () => Promise<void>;
  selected: AudioDevice | null;
  selectDevice: (id: string) => void;
  receiverEar: Ear;
  senderEar: Ear;
  chooseReceiver: (ear: Ear) => void;
  swapEars: () => void;
  gain: number;
  setGain: (value: number) => void;
  recordArmed: boolean;
  toggleRecord: () => Promise<void>;
  live: boolean;
  recording: boolean;
  error: string | null;
  clearError: () => void;
  toggleLive: () => Promise<void>;
  canGoLive: boolean;
  bluetoothEnabled: boolean | null;
  notice: HeadsetNotice | null;
  clearNotice: () => void;
  openBluetooth: () => Promise<void>;
  takes: Take[];
  deleteTake: (id: string) => Promise<void>;
  playingId: string | null;
  togglePlay: (id: string) => void;
  stopPlayback: () => void;
  seekPlayhead: (seconds: number) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

const EMPTY_BANDS = Array.from({ length: 64 }, () => 0);

interface TickValue {
  elapsed: number;
  recordElapsed: number;
  bands: number[];
  playhead: number;
}

const TickContext = createContext<TickValue>({
  elapsed: 0,
  recordElapsed: 0,
  bands: EMPTY_BANDS,
  playhead: 0,
});

function rank(kind: AudioDevice['kind']): number {
  if (kind === 'bluetooth') return 0;
  if (kind === 'wired') return 1;
  if (kind === 'other') return 2;
  return 3;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [screen, setScreenState] = useState<ScreenName>('home');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [outputs, setOutputs] = useState<AudioDevice[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [receiverEar, setReceiverEar] = useState<Ear>('right');
  const [gain, setGainState] = useState(0.65);
  const [recordArmed, setRecordArmed] = useState(false);
  const [live, setLive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordElapsed, setRecordElapsed] = useState(0);
  const [bands, setBands] = useState<number[]>(EMPTY_BANDS);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<HeadsetNotice | null>(null);
  const [headsetConnected, setHeadsetConnected] = useState(false);
  const [bluetoothEnabled, setBluetoothEnabled] = useState<boolean | null>(null);
  const [takes, setTakes] = useState<Take[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);

  const hydrated = useRef(false);
  const busy = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const receiverRef = useRef<Ear>('right');
  const gainRef = useRef(0.65);
  const recordRef = useRef(false);
  const liveRef = useRef(false);
  const endingRef = useRef(false);
  const headsetLostRef = useRef<() => void>(() => undefined);
  const headsetRef = useRef(false);
  const headsetReadyRef = useRef(false);
  const nameRef = useRef('Earbuds');
  const takesRef = useRef<Take[]>([]);
  const screenRef = useRef<ScreenName>('home');
  screenRef.current = screen;

  const selected = devices.find((device) => device.id === selectedId) ?? null;
  nameRef.current = selected?.name ?? 'Earbuds';
  headsetRef.current = selected?.kind === 'bluetooth';
  headsetReadyRef.current = (Platform.OS !== 'android' || headsetConnected) && selected?.kind === 'bluetooth';
  takesRef.current = takes;

  const rememberTake = useCallback((captured: { path: string; duration: number; size: number }) => {
    const take: Take = {
      id: `${Date.now()}`,
      path: captured.path,
      duration: captured.duration,
      size: captured.size,
      createdAt: Date.now(),
      senderEar: otherEar(receiverRef.current),
      receiverEar: receiverRef.current,
      deviceName: nameRef.current,
    };
    setTakes((current) => [take, ...current]);
  }, []);

  const refreshDevices = useCallback(async () => {
    setRefreshing(true);
    try {
      const listed = await engine.listDevices();
      const inputs = [...listed.inputs].sort(
        (a, b) => rank(a.kind) - rank(b.kind) || a.name.localeCompare(b.name),
      );
      setDevices(inputs);
      setOutputs(listed.outputs);
      const current = selectedIdRef.current;
      const stillThere = inputs.some((device) => device.id === current);
      if (!stillThere) {
        const next = inputs.find((device) => device.kind === 'bluetooth') ?? inputs[0] ?? null;
        selectedIdRef.current = next?.id ?? null;
        setSelectedId(next?.id ?? null);
      }
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, 'Earbuds could not be read.'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    engine.setLevelHandler((_level, nextBands) => {
      if (screenRef.current !== 'stage') return;
      setBands(nextBands);
    });
    return () => engine.setLevelHandler(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadSession();
      if (cancelled) return;
      if (stored) {
        applyStored(stored);
      }
      hydrated.current = true;
      await refreshDevices();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshDevices]);

  useEffect(() => {
    let cancelled = false;
    let running = false;
    const sync = async () => {
      if (!hydrated.current || cancelled || running) return;
      running = true;
      try {
        const enabled = await isBluetoothEnabled();
        if (cancelled || !hydrated.current) return;
        setBluetoothEnabled(enabled);
        if (enabled === false) {
          setHeadsetConnected(false);
          setDevices((current) => {
            const next = current.filter((device) => device.kind !== 'bluetooth');
            const same = next.length === current.length && next.every((device, index) => device.id === current[index]?.id);
            return same ? current : next;
          });
          headsetLostRef.current();
          return;
        }
        const labels = await getConnectedBluetoothDevices();
        if (cancelled || !hydrated.current) return;
        setHeadsetConnected(labels.length > 0);
        const names = labels.map((label) => label.name.trim().toLowerCase());
        const addresses = new Set(labels.map((label) => label.id));
        setDevices((current) => {
          const next = current.filter((device) => {
            if (device.kind !== 'bluetooth') return true;
            if (labels.length === 0) return false;
            if (device.id.startsWith('bt:')) return addresses.has(device.id.slice(3));
            const name = device.name.trim().toLowerCase();
            return names.some((label) => label === name);
          });
          const same = next.length === current.length && next.every((device, index) => device.id === current[index]?.id);
          return same ? current : next;
        });
        if (labels.length === 0) headsetLostRef.current();
      } finally {
        running = false;
      }
    };
    void sync();
    const id = setInterval(() => {
      void sync();
    }, 3000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => {
      cancelled = true;
      clearInterval(id);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const headset = devices.find((device) => device.kind === 'bluetooth') ?? devices.find((device) => device.kind === 'wired') ?? null;
    const current = devices.find((device) => device.id === selectedId) ?? null;
    if (headset && (!current || current.kind === 'phone')) {
      if (selectedId === headset.id) return;
      selectedIdRef.current = headset.id;
      setSelectedId(headset.id);
      return;
    }
    if (current || devices.length === 0) return;
    const next = devices.find((device) => device.kind === 'phone') ?? null;
    selectedIdRef.current = next?.id ?? null;
    setSelectedId(next?.id ?? null);
  }, [devices, selectedId]);

  function applyStored(stored: PersistedSession) {
    selectedIdRef.current = stored.selectedId;
    receiverRef.current = stored.receiverEar;
    gainRef.current = stored.gain;
    recordRef.current = false;
    setSelectedId(stored.selectedId);
    setReceiverEar(stored.receiverEar);
    setGainState(stored.gain);
    setRecordArmed(false);
    setTakes(stored.takes ?? []);
    engine.setGain(stored.gain);
    engine.setReceiverEar(stored.receiverEar);
  }

  useEffect(() => {
    if (!hydrated.current) return;
    const snapshot: PersistedSession = {
      selectedId,
      receiverEar,
      gain,
      recordArmed,
      takes,
    };
    saveSession(snapshot).catch(() => undefined);
  }, [gain, receiverEar, recordArmed, selectedId, takes]);

  useEffect(() => {
    if (!recording) {
      setRecordElapsed(0);
      return;
    }
    const origin = Date.now();
    const id = setInterval(() => {
      const next = Math.floor((Date.now() - origin) / 1000);
      setRecordElapsed((current) => (current === next ? current : next));
    }, 250);
    return () => clearInterval(id);
  }, [recording]);

  useEffect(() => {
    if (!live) return;
    const origin = Date.now();
    const id = setInterval(() => {
      const next = Math.floor((Date.now() - origin) / 1000);
      setElapsed((current) => (current === next ? current : next));
    }, 250);
    return () => clearInterval(id);
  }, [live]);

  useEffect(() => {
    if (!playingId) return;
    const take = takesRef.current.find((item) => item.id === playingId);
    if (!take || take.path) return;
    const origin = Date.now();
    const id = setInterval(() => {
      const next = (Date.now() - origin) / 1000;
      if (next >= take.duration) {
        setPlayingId(null);
        setPlayhead(0);
        return;
      }
      const whole = Math.floor(next);
      setPlayhead((current) => (current === whole ? current : whole));
    }, 250);
    return () => clearInterval(id);
  }, [playingId]);

  const setScreen = useCallback((next: ScreenName) => {
    if (next !== 'library') {
      setPlayingId(null);
      setPlayhead(0);
    }
    setScreenState(next);
  }, []);

  const selectDevice = useCallback((id: string) => {
    selectedIdRef.current = id;
    setSelectedId(id);
    tap('light');
  }, []);

  const chooseReceiver = useCallback((ear: Ear) => {
    receiverRef.current = ear;
    setReceiverEar(ear);
    engine.setReceiverEar(ear);
    tap('light');
  }, []);

  const swapEars = useCallback(() => {
    const next = otherEar(receiverRef.current);
    receiverRef.current = next;
    setReceiverEar(next);
    engine.setReceiverEar(next);
    tap('medium');
  }, []);

  const setGain = useCallback((value: number) => {
    const next = Math.min(1, Math.max(0, value));
    gainRef.current = next;
    setGainState(next);
    engine.setGain(next);
  }, []);

  useEffect(() => {
    engine.setDropHandler(() => {
      headsetLostRef.current();
    });
    return () => engine.setDropHandler(null);
  }, []);

  const finishDisconnected = useCallback(async () => {
    if (endingRef.current || !liveRef.current) return;
    endingRef.current = true;
    const wasRecording = recordRef.current;
    liveRef.current = false;
    recordRef.current = false;
    let captured: { path: string; duration: number; size: number } | null = null;
    try {
      captured = await engine.stop();
    } catch {
      captured = null;
    }
    setLive(false);
    setRecording(false);
    setRecordArmed(false);
    setElapsed(0);
    if (captured) rememberTake(captured);
    setScreenState('home');
    setNotice(
      wasRecording && captured
        ? {
            saved: true,
            title: 'Recording saved',
            detail: 'The earbuds disconnected. Live stopped, and the take is in Takes.',
          }
        : {
            saved: false,
            title: 'Live stopped',
            detail: 'The earbuds disconnected, so the session ended.',
          },
    );
    endingRef.current = false;
  }, [rememberTake]);

  headsetLostRef.current = () => {
    void finishDisconnected();
  };

  useEffect(() => {
    if (headsetConnected) setNotice(null);
  }, [headsetConnected]);

  const startRelay = useCallback(
    async (record: boolean) => {
      await engine.start({
        inputId: selectedIdRef.current,
        receiverEar: receiverRef.current,
        gain: gainRef.current,
        record,
        headset: headsetRef.current,
      });
      liveRef.current = true;
      setLive(true);
      setRecording(record);
    },
    [],
  );

  const toggleLive = useCallback(async () => {
    if (busy.current) return;
    if (!liveRef.current && !headsetReadyRef.current) {
      setScreenState('home');
      return;
    }
    busy.current = true;
    try {
      if (liveRef.current) {
        const captured = await engine.stop();
        liveRef.current = false;
        recordRef.current = false;
        setLive(false);
        setRecording(false);
        setRecordArmed(false);
        setElapsed(0);
        if (captured) rememberTake(captured);
        tap('medium');
        return;
      }
      setError(null);
      recordRef.current = false;
      setRecordArmed(false);
      await startRelay(false);
      setElapsed(0);
      confirm();
    } catch (cause) {
      liveRef.current = false;
      recordRef.current = false;
      setLive(false);
      setRecording(false);
      setRecordArmed(false);
      setError(errorMessage(cause, 'Live audio did not start.'));
    } finally {
      busy.current = false;
    }
  }, [rememberTake, startRelay]);

  const toggleRecord = useCallback(async () => {
    if (!liveRef.current || busy.current) return;
    busy.current = true;
    const next = !recordRef.current;
    try {
      const captured = await engine.setRecording(next);
      recordRef.current = next;
      setRecordArmed(next);
      setRecording(next);
      if (captured) rememberTake(captured);
      tap(next ? 'medium' : 'light');
    } catch (cause) {
      setError(errorMessage(cause, 'Recording could not be changed.'));
    } finally {
      busy.current = false;
    }
  }, [rememberTake]);

  const openBluetooth = useCallback(async () => {
    try {
      await engine.openBluetoothSettings();
    } catch (cause) {
      setError(errorMessage(cause, 'Bluetooth settings could not be opened.'));
    }
  }, []);

  const deleteTake = useCallback(async (id: string) => {
    const take = takesRef.current.find((item) => item.id === id);
    if (take) await deleteTakeFile(take.path);
    if (playingId === id) {
      setPlayingId(null);
      setPlayhead(0);
    }
    setTakes((current) => current.filter((item) => item.id !== id));
    tap('light');
  }, [playingId]);

  const stopPlayback = useCallback(() => {
    setPlayingId(null);
    setPlayhead(0);
  }, []);

  const togglePlay = useCallback((id: string) => {
    if (liveRef.current) {
      setError('End the live relay before playing a take.');
      return;
    }
    setPlayingId((current) => {
      if (current === id) {
        setPlayhead(0);
        return null;
      }
      setPlayhead(0);
      return id;
    });
    tap('light');
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      screen,
      setScreen,
      reduceMotion,
      devices,
      outputs,
      refreshing,
      refreshDevices,
      selected,
      selectDevice,
      receiverEar,
      senderEar: otherEar(receiverEar),
      chooseReceiver,
      swapEars,
      gain,
      setGain,
      recordArmed,
      toggleRecord,
      live,
      recording,
      error,
      clearError: () => setError(null),
      toggleLive,
      canGoLive: (Platform.OS !== 'android' || headsetConnected) && selected?.kind === 'bluetooth',
      bluetoothEnabled,
      notice,
      clearNotice: () => setNotice(null),
      openBluetooth,
      takes,
      deleteTake,
      playingId,
      togglePlay,
      stopPlayback,
      seekPlayhead: setPlayhead,
    }),
    [
      bluetoothEnabled,
      chooseReceiver,
      deleteTake,
      devices,
      error,
      gain,
      headsetConnected,
      live,
      notice,
      openBluetooth,
      outputs,
      playingId,
      receiverEar,
      recordArmed,
      recording,
      reduceMotion,
      refreshDevices,
      refreshing,
      screen,
      selectDevice,
      selected,
      setGain,
      setScreen,
      swapEars,
      takes,
      stopPlayback,
      toggleLive,
      togglePlay,
      toggleRecord,
    ],
  );

  const tick = useMemo<TickValue>(
    () => ({ elapsed, recordElapsed, bands, playhead }),
    [bands, elapsed, playhead, recordElapsed],
  );

  return (
    <SessionContext.Provider value={value}>
      <TickContext.Provider value={tick}>
        {live && Platform.OS !== 'web' ? <ScreenAwake /> : null}
        {children}
      </TickContext.Provider>
    </SessionContext.Provider>
  );
}

function ScreenAwake() {
  useKeepAwake();
  return null;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

export function useTick(): TickValue {
  return useContext(TickContext);
}
