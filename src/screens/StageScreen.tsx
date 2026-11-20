import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bud } from '../components/Bud';
import { ErrorNote, LevelSlider } from '../components/Chrome';
import { LiveButton } from '../components/LiveButton';
import { Signal } from '../components/Signal';
import { Waveform } from '../components/Waveform';
import { formatClock } from '../format';
import { useFit } from '../layout';
import { useSession, useTick } from '../session';
import { theme } from '../theme';

export function StageScreen() {
  const insets = useSafeAreaInsets();
  const fit = useFit();
  const session = useSession();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          flexGrow: 1,
          paddingTop: insets.top + 8,
          paddingBottom: fit.bottom,
          paddingHorizontal: fit.pad,
          justifyContent: 'space-between',
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => session.setScreen('home')} style={styles.back}>
          <Ionicons name="chevron-back" size={18} color={theme.paper} />
        </Pressable>
        <View style={styles.mark}>{session.live ? <View style={styles.air} /> : null}</View>
        <View style={styles.spacer} />
      </View>

      <ErrorNote message={session.error} onDismiss={session.clearError} />

      <View style={styles.pair}>
        <Bud ear={session.senderEar} role="sender" size={fit.budStage} active={session.live} />
        <Signal active={session.live} reverse={false} reduceMotion={session.reduceMotion} width={fit.signal} />
        <Bud ear={session.receiverEar} role="receiver" size={fit.budStage} active={session.live} />
      </View>

      <StageWave height={Math.max(56, Math.round(84 * fit.scale))} />

      <View style={styles.buttonRow}>
        <LiveButton
          live={session.live}
          recording={session.recording}
          reduceMotion={session.reduceMotion}
          disabled={!session.live && !session.canGoLive}
          size={fit.live}
          onPress={session.toggleLive}
        />
      </View>

      <StageClock size={fit.clock} />
      <Text style={styles.device} numberOfLines={1}>
        {session.canGoLive ? session.selected?.name : 'No earbuds'}
      </Text>
      {!session.canGoLive ? (
        <View style={styles.note}>
          <Ionicons name={session.bluetoothEnabled === false ? 'bluetooth' : 'headset'} size={20} color={theme.paper} />
          <Text style={styles.noteText}>
            {session.bluetoothEnabled === false ? 'Bluetooth is off. Go Live stays off.' : 'Connect earbuds to go live.'}
          </Text>
        </View>
      ) : null}

      {session.live ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={session.recording ? 'Stop recording' : 'Start recording'}
          onPress={session.toggleRecord}
          style={[styles.recordBar, session.recording && styles.recordBarOn]}
        >
          <View style={[styles.recordRing, session.recording && styles.recordRingOn]}>
            {session.recording ? <View style={styles.recordStop} /> : <View style={styles.recordDot} />}
          </View>
          <Text style={styles.recordLabel}>{session.recording ? 'Stop recording' : 'Record'}</Text>
        </Pressable>
      ) : null}

      <View style={styles.level}>
        <Ionicons name="volume-high" size={18} color={theme.receiver} />
        <View style={styles.slider}>
          <LevelSlider value={session.gain} onChange={session.setGain} />
        </View>
      </View>
    </ScrollView>
  );
}

function StageWave({ height }: { height: number }) {
  const { bands } = useTick();
  const { live, reduceMotion } = useSession();
  return <Waveform samples={bands} live={live} reduceMotion={reduceMotion} height={height} />;
}

function StageClock({ size }: { size: number }) {
  const { elapsed } = useTick();
  const { recording } = useSession();
  return (
    <Text style={[styles.clock, { fontSize: size, lineHeight: size + 4 }, recording && styles.clockHot]}>
      {formatClock(elapsed)}
    </Text>
  );
}

const styles = StyleSheet.create({
  content: {},
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.raised,
  },
  spacer: {
    width: 40,
    height: 40,
  },
  mark: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  air: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.live,
  },
  pair: {
    marginTop: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    alignItems: 'center',
  },
  recordBar: {
    minHeight: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: theme.raised,
    borderWidth: 1,
    borderColor: theme.line,
  },
  recordBarOn: {
    backgroundColor: theme.live,
    borderColor: theme.live,
  },
  recordRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.live,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordRingOn: {
    borderColor: theme.paper,
  },
  recordDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.live,
  },
  recordStop: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: theme.paper,
  },
  recordLabel: {
    color: theme.paper,
    fontFamily: theme.font.semibold,
    fontSize: 16,
  },
  clock: {
    textAlign: 'center',
    color: theme.paper,
    fontFamily: theme.font.display,
  },
  clockHot: {
    color: theme.live,
  },
  device: {
    textAlign: 'center',
    color: theme.paperDim,
    fontFamily: theme.font.medium,
    fontSize: 13,
    marginTop: 2,
  },
  note: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.raised,
  },
  noteText: {
    flex: 1,
    color: theme.paper,
    fontFamily: theme.font.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  level: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slider: {
    flex: 1,
  },
});
