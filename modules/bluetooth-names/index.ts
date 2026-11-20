import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export interface BluetoothLabel {
  id: string;
  name: string;
}

interface BluetoothNamesNative {
  getConnectedDevices(): Promise<string>;
  isEnabled(): boolean;
  setCallMode(enabled: boolean): void;
}

const native = Platform.OS === 'android' ? requireOptionalNativeModule<BluetoothNamesNative>('BluetoothNames') : null;

function isPhoneName(name: string): boolean {
  if (Platform.OS !== 'android') return false;
  const constants = Platform.constants as { Model?: string; Brand?: string; Manufacturer?: string };
  const value = name.trim().toLowerCase();
  const model = constants.Model?.trim().toLowerCase() ?? '';
  const exact = [constants.Model, constants.Brand, constants.Manufacturer]
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().toLowerCase());
  return exact.some((item) => item === value) || (model.length > 3 && value.includes(model));
}

export async function getConnectedBluetoothDevices(): Promise<BluetoothLabel[]> {
  if (!native) return [];
  try {
    const raw = await native.getConnectedDevices();
    const parsed = JSON.parse(raw) as BluetoothLabel[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (device) => device && typeof device.name === 'string' && device.name.trim().length > 0 && !isPhoneName(device.name),
    );
  } catch {
    return [];
  }
}

export async function isBluetoothEnabled(): Promise<boolean | null> {
  if (!native?.isEnabled) return null;
  try {
    return native.isEnabled();
  } catch {
    return null;
  }
}
export async function setBluetoothCallMode(enabled: boolean): Promise<void> {
  if (!native) return;
  try {
    native.setCallMode(enabled);
  } catch {
    // The installed build may not have the call-mode hook yet.
  }
}
