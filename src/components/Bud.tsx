import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Ear } from '../audio/types';
import { theme } from '../theme';

interface BudProps {
  ear: Ear;
  role: 'sender' | 'receiver';
  size?: number;
  active?: boolean;
  onPress?: () => void;
}

export function Bud({ ear, role, size = 108, active = false, onPress }: BudProps) {
  const accent = role === 'sender' ? theme.sender : theme.receiver;
  const soft = role === 'sender' ? theme.senderSoft : theme.receiverSoft;
  const height = size * 1.34;
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!active) {
      pulse.value = withTiming(1, { duration: 180 });
      return;
    }
    pulse.value = withRepeat(withTiming(1.16, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [active, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const body = (
    <View style={[styles.wrap, { width: size + 12 }]}>
      <Svg width={size} height={height} viewBox="0 0 88 128">
        <G transform={ear === 'left' ? 'translate(88 0) scale(-1 1)' : undefined}>
          <Path
            d="M34 62 C32 78 31 96 35 112 C38 122 52 122 55 112 C59 96 58 78 56 62 C54 56 36 56 34 62 Z"
            fill="#161920"
            stroke={accent}
            strokeWidth="2.6"
          />
          <Ellipse cx="46" cy="40" rx="28" ry="30" fill="#12141A" stroke={accent} strokeWidth="2.8" />
          <Ellipse cx="46" cy="38" rx="14" ry="16" fill={soft} />
          <Circle cx="46" cy="33" r="2.3" fill={accent} />
          <Circle cx="40" cy="42" r="1.7" fill={accent} />
          <Circle cx="52" cy="42" r="1.7" fill={accent} />
          <Circle cx="45" cy="104" r="2.4" fill={accent} />
        </G>
      </Svg>
      <Animated.View style={[styles.badge, { backgroundColor: accent }, pulseStyle]}>
        <Ionicons name={role === 'sender' ? 'mic' : 'volume-high'} size={15} color={theme.ink} />
      </Animated.View>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ear} earbud, ${role}`}
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.84 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  badge: {
    marginTop: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
