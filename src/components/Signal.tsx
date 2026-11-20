import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../theme';

interface SignalProps {
  active: boolean;
  reverse: boolean;
  reduceMotion: boolean;
  width?: number;
}

export function Signal({ active, reverse, reduceMotion, width = 86 }: SignalProps) {
  return (
    <View style={[styles.track, { width }]}>
      <View style={styles.line} />
      <Dot active={active} reverse={reverse} offset={0} reduceMotion={reduceMotion} span={Math.max(36, width - 14)} />
      <Dot active={active} reverse={reverse} offset={0.33} reduceMotion={reduceMotion} span={Math.max(36, width - 14)} />
      <Dot active={active} reverse={reverse} offset={0.66} reduceMotion={reduceMotion} span={Math.max(36, width - 14)} />
    </View>
  );
}

function Dot({
  active,
  reverse,
  offset,
  reduceMotion,
  span,
}: {
  active: boolean;
  reverse: boolean;
  offset: number;
  reduceMotion: boolean;
  span: number;
}) {
  const clock = useSharedValue(0);
  const travel = useSharedValue(span);

  useEffect(() => {
    travel.value = span;
  }, [span, travel]);

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(clock);
      clock.value = 0;
      return;
    }
    clock.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [active, clock, reduceMotion]);

  const style = useAnimatedStyle(() => {
    const cycle = (clock.value + offset) % 1;
    const along = reverse ? 1 - cycle : cycle;
    const visible = active && !reduceMotion;
    return {
      opacity: visible ? 0.2 + Math.sin(cycle * Math.PI) * 0.8 : 0.35,
      transform: [{ translateX: along * travel.value }],
    };
  });

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  track: {
    width: 86,
    height: 18,
    justifyContent: 'center',
    marginBottom: 28,
  },
  line: {
    height: 1,
    backgroundColor: theme.line,
  },
  dot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.receiver,
  },
});
