import { ReactNode, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tap } from '../haptics';
import { theme } from '../theme';
import { ScreenName, useSession } from '../session';

const ITEMS: { id: ScreenName; label: string; idle: keyof typeof Ionicons.glyphMap; on: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'home', label: 'Home', idle: 'home-outline', on: 'home' },
  { id: 'devices', label: 'Buds', idle: 'bluetooth-outline', on: 'bluetooth' },
  { id: 'stage', label: 'Live', idle: 'radio-outline', on: 'radio' },
  { id: 'library', label: 'Takes', idle: 'albums-outline', on: 'albums' },
];

export function Dock() {
  const insets = useSafeAreaInsets();
  const { screen, setScreen, live, reduceMotion } = useSession();
  const active = screen === 'roles' ? 'devices' : screen;
  const barWidth = useSharedValue(0);
  const index = useSharedValue(Math.max(0, ITEMS.findIndex((item) => item.id === active)));

  useEffect(() => {
    const next = Math.max(0, ITEMS.findIndex((item) => item.id === active));
    index.value = reduceMotion ? next : withSpring(next, { damping: 18, stiffness: 240, mass: 0.7 });
  }, [active, index, reduceMotion]);

  const pillStyle = useAnimatedStyle(() => {
    const slot = Math.max(0, barWidth.value - 12) / ITEMS.length;
    return {
      width: Math.max(0, slot - 10),
      transform: [{ translateX: 6 + index.value * slot + 5 }],
    };
  });

  return (
    <View style={[styles.dock, { paddingTop: 36, paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
      <View
        style={styles.bar}
        onLayout={(event) => {
          barWidth.value = event.nativeEvent.layout.width;
        }}
      >
        <Animated.View pointerEvents="none" style={[styles.pill, pillStyle]} />
        {ITEMS.map((item) => (
          <DockItem
            key={item.id}
            label={item.label}
            icon={active === item.id ? item.on : item.idle}
            selected={active === item.id}
            live={item.id === 'stage' && live}
            reduceMotion={reduceMotion}
            onPress={() => {
              if (active !== item.id) tap('light');
              setScreen(item.id);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function DockItem({
  label,
  icon,
  selected,
  live,
  reduceMotion,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  live: boolean;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const emphasis = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    emphasis.value = reduceMotion ? (selected ? 1 : 0) : withSpring(selected ? 1 : 0, { damping: 14, stiffness: 260 });
  }, [emphasis, reduceMotion, selected]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * (0.9 + emphasis.value * 0.14) }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPressIn={() => {
        scale.value = withSpring(0.9, { damping: 16, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 240 });
      }}
      onPress={onPress}
      style={styles.item}
    >
      <Animated.View style={[styles.iconSlot, iconStyle]}>
        <Ionicons name={icon} size={23} color={selected ? theme.ink : theme.paperDim} />
        {live ? <View style={styles.liveDot} /> : null}
      </Animated.View>
    </Pressable>
  );
}

export function ErrorNote({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.error}>
      <Text style={styles.errorText}>{message}</Text>
    </Pressable>
  );
}

export function PaperButton({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.paper, pressed && styles.pressed]}
    >
      {icon}
      <Text style={styles.paperLabel}>{label}</Text>
    </Pressable>
  );
}

export function LevelSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const width = { current: 1 };
  const update = (x: number) => {
    onChange(Math.min(1, Math.max(0, x / width.current)));
  };

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Receiver level"
      style={styles.slider}
      onLayout={(event) => {
        width.current = Math.max(1, event.nativeEvent.layout.width);
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => update(event.nativeEvent.locationX)}
      onResponderMove={(event) => update(event.nativeEvent.locationX)}
    >
      <View style={styles.sliderTrack} />
      <View style={[styles.sliderFill, { width: `${Math.round(value * 100)}%` }]} />
      <View style={[styles.knob, { left: `${Math.round(value * 100)}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    paddingHorizontal: 18,
  },
  bar: {
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(20, 22, 27, 0.96)',
    borderWidth: 1,
    borderColor: theme.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    top: 8,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.paper,
  },
  item: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlot: {
    width: 34,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.live,
  },
  error: {
    backgroundColor: theme.liveSoft,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  errorText: {
    color: theme.paper,
    fontFamily: theme.font.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  paper: {
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.paper,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  pressed: {
    opacity: 0.86,
  },
  paperLabel: {
    color: theme.ink,
    fontFamily: theme.font.semibold,
    fontSize: 16,
  },
  slider: {
    height: 36,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(244, 239, 230, 0.14)',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.receiver,
  },
  knob: {
    position: 'absolute',
    width: 18,
    height: 18,
    marginLeft: -9,
    borderRadius: 9,
    backgroundColor: theme.paper,
  },
});
