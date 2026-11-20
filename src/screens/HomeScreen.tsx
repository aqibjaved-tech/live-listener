import { useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bud } from '../components/Bud';
import { ErrorNote } from '../components/Chrome';
import { Signal } from '../components/Signal';
import { useFit } from '../layout';
import { useSession } from '../session';
import { theme } from '../theme';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const fit = useFit();
  const session = useSession();
  const progress = useSharedValue(session.receiverEar === 'left' ? 1 : 0);
  const opened = useMemo(() => ({ current: false }), []);
  const span = fit.bud + 12 + fit.signal;

  useEffect(() => {
    const next = session.receiverEar === 'left' ? 1 : 0;
    if (!opened.current) {
      opened.current = true;
      progress.value = next;
      return;
    }
    progress.value = session.reduceMotion
      ? next
      : withTiming(next, { duration: 480, easing: Easing.inOut(Easing.cubic) });
  }, [opened, progress, session.receiverEar, session.reduceMotion]);

  const leftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * span }],
    zIndex: progress.value > 0.5 ? 2 : 1,
  }));
  const rightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * -span }],
    zIndex: progress.value > 0.5 ? 1 : 2,
  }));
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .onEnd((event) => {
          if (Math.abs(event.translationX) < 48) return;
          runOnJS(session.swapEars)();
        }),
    [session.swapEars],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingHorizontal: fit.pad }]}>
      <Text style={[styles.title, { fontSize: fit.title, lineHeight: fit.title + 4 }]}>
        Listen
        <Text style={styles.period}>.</Text>
      </Text>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.stageWrap}>
        <ErrorNote message={session.error} onDismiss={session.clearError} />

        <GestureDetector gesture={swipe}>
          <View style={styles.stage}>
            <Animated.View style={leftStyle}>
              <Bud
                ear="left"
                role={session.receiverEar === 'left' ? 'receiver' : 'sender'}
                size={fit.bud}
                onPress={() => session.chooseReceiver('left')}
              />
            </Animated.View>
            <Signal
              active={false}
              reverse={session.receiverEar === 'left'}
              reduceMotion={session.reduceMotion}
              width={fit.signal}
            />
            <Animated.View style={rightStyle}>
              <Bud
                ear="right"
                role={session.receiverEar === 'right' ? 'receiver' : 'sender'}
                size={fit.bud}
                onPress={() => session.chooseReceiver('right')}
              />
            </Animated.View>
          </View>
        </GestureDetector>

        <Text style={styles.device} numberOfLines={1}>
          {session.canGoLive ? session.selected?.name : 'No earbuds'}
        </Text>
      </View>

      {session.notice ? (
          <View style={styles.note}>
            <Ionicons name={session.notice.saved ? 'checkmark-circle' : 'alert-circle'} size={22} color={session.notice.saved ? theme.receiver : theme.live} />
            <View style={styles.noteCopy}>
              <Text style={styles.noteTitle}>{session.notice.title}</Text>
              <Text style={styles.noteBody}>{session.notice.detail}</Text>
            </View>
          </View>
        ) : !session.canGoLive ? (
          <View style={styles.note}>
            <Ionicons name={session.bluetoothEnabled === false ? 'bluetooth' : 'headset'} size={22} color={theme.paper} />
            <View style={styles.noteCopy}>
              <Text style={styles.noteTitle}>{session.bluetoothEnabled === false ? 'Bluetooth is off' : 'No earbuds connected'}</Text>
              <Text style={styles.noteBody}>
                {session.bluetoothEnabled === false
                  ? 'Turn Bluetooth on and connect your earbuds. Go Live stays off until then.'
                  : 'Connect your earbuds. Go Live stays off until a headset is connected.'}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Earbuds" onPress={() => session.setScreen('devices')} style={styles.iconButton}>
            <Ionicons name="bluetooth" size={22} color={theme.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={session.canGoLive ? 'Go live' : 'Go live unavailable'}
            accessibilityState={{ disabled: !session.canGoLive }}
            disabled={!session.canGoLive}
            onPress={() => {
              if (!session.canGoLive) return;
              session.setScreen('stage');
              if (!session.live) void session.toggleLive();
            }}
            style={[styles.liveButton, !session.canGoLive && styles.liveButtonOff]}
          >
            <Ionicons name="radio" size={30} color={session.canGoLive ? theme.paper : theme.paperDim} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Swap ears" onPress={session.swapEars} style={styles.iconButton}>
            <Ionicons name="swap-horizontal" size={22} color={theme.ink} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flexGrow: 1,
  },
  stageWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    marginBottom: 8,
    color: theme.paper,
    fontFamily: theme.font.display,
  },
  period: {
    color: theme.receiver,
  },
  stage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  device: {
    marginTop: 18,
    textAlign: 'center',
    color: theme.paper,
    fontFamily: theme.font.semibold,
    fontSize: 16,
  },
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.paper,
  },
  liveButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.live,
  },
  liveButtonOff: {
    backgroundColor: theme.raised,
  },
  note: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: theme.raised,
    borderWidth: 1,
    borderColor: theme.line,
  },
  noteCopy: {
    flex: 1,
    gap: 4,
  },
  noteTitle: {
    color: theme.paper,
    fontFamily: theme.font.semibold,
    fontSize: 15,
  },
  noteBody: {
    color: theme.paperDim,
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 18,
  },
});
