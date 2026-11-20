import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../theme';

interface LiveButtonProps {
  live: boolean;
  recording: boolean;
  reduceMotion: boolean;
  disabled?: boolean;
  size?: number;
  onPress: () => void;
}

export function LiveButton({ live, recording, reduceMotion, disabled = false, size = 148, onPress }: LiveButtonProps) {
  const scale = useSharedValue(1);
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.wrap}>
      {live && !reduceMotion ? (
        <>
          <Pulse delay={0} size={size} />
          <Pulse delay={600} size={size} />
        </>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={live ? 'Stop live audio' : 'Start live audio'}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={() => {
          if (disabled) return;
          scale.value = withSpring(0.96, { damping: 16, stiffness: 280 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 240 });
        }}
        onPress={onPress}
      >
        <Animated.View
          style={[
            styles.button,
            live && styles.buttonLive,
            disabled && { opacity: 0.38 },
            { width: size, height: size, borderRadius: size / 2 },
            buttonStyle,
          ]}
        >
          <LiveMark color={theme.paper} />
          {recording ? <View style={styles.recordDot} /> : null}
        </Animated.View>
      </Pressable>
      <Text style={[styles.caption, live && styles.captionLive]}>{live ? 'Live' : 'Go live'}</Text>
    </View>
  );
}

function LiveMark({ color }: { color: string }) {
  return (
    <Svg width={54} height={54} viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="5" fill={color} />
      <Path d="M21.5 21.5c-6.2 6.2-6.2 14.8 0 21" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
      <Path d="M42.5 21.5c6.2 6.2 6.2 14.8 0 21" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
      <Path d="M13 13c-10.4 10.4-10.4 27.6 0 38" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
      <Path d="M51 13c10.4 10.4 10.4 27.6 0 38" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function Pulse({ delay, size }: { delay: number; size: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }), -1, false),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - progress.value),
    transform: [{ scale: 1 + progress.value * 0.48 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pulse, { width: size, height: size, borderRadius: size / 2, top: 8 }, style]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  pulse: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: theme.live,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1D24',
    borderWidth: 1.5,
    borderColor: 'rgba(244, 239, 230, 0.28)',
  },
  buttonLive: {
    backgroundColor: theme.live,
    borderColor: theme.live,
  },
  recordDot: {
    position: 'absolute',
    top: 18,
    right: 22,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.paper,
  },
  caption: {
    marginTop: 16,
    color: theme.paper,
    fontFamily: theme.font.semibold,
    fontSize: 16,
    letterSpacing: 0.4,
  },
  captionLive: {
    color: theme.live,
  },
});
