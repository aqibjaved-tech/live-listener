import * as Haptics from 'expo-haptics';

type Strength = 'light' | 'medium' | 'heavy';

const style: Record<Strength, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

export function tap(strength: Strength = 'light'): void {
  Haptics.impactAsync(style[strength]).catch(() => undefined);
}

export function confirm(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
