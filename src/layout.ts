import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useFit() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dock = 68 + 36 + Math.max(insets.bottom, 16) + 20;
  const bottom = 16;
  const usable = Math.max(280, height - insets.top - dock - bottom);
  const scale = Math.min(1.15, Math.max(0.72, Math.min(width / 390, usable / 740)));
  const size = (value: number) => Math.round(value * scale);
  const signal = Math.max(48, Math.min(86, width * 0.18));
  const bud = Math.max(64, Math.min(size(100), (width - signal - 36) / 2.15));

  return {
    width,
    height,
    scale,
    insets,
    bottom,
    pad: Math.max(16, Math.min(28, width * 0.06)),
    title: Math.max(40, Math.min(size(64), width * 0.16)),
    bud,
    budStage: Math.max(56, bud * 0.82),
    signal,
    live: Math.max(108, Math.min(size(148), usable * 0.3, width * 0.4)),
    clock: Math.max(28, size(40)),
  };
}
