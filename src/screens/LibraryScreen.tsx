import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'react-native-audio-api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorNote } from '../components/Chrome';
import { formatClock, formatSize } from '../format';
import { useFit } from '../layout';
import { useSession, useTick } from '../session';
import { Take } from '../storage';
import { theme } from '../theme';

export function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const fit = useFit();
  const session = useSession();
  const playing = session.takes.find((take) => take.id === session.playingId) ?? null;
  const playStamp = useRef(0);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { flexGrow: 1, paddingTop: insets.top + 18, paddingBottom: playing ? fit.bottom + 88 : fit.bottom, paddingHorizontal: fit.pad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>SAVED</Text>
        <Text style={[styles.title, { fontSize: fit.title, lineHeight: fit.title + 4 }]}>Takes</Text>
        <ErrorNote message={session.error} onDismiss={session.clearError} />

        {session.recording || session.takes.length > 0 ? (
          <View style={styles.list}>
            {session.recording ? (
              <View style={styles.row}>
                <View style={styles.liveMark}>
                  <View style={styles.liveDot} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.name} numberOfLines={1}>
                    {session.selected?.name ?? 'Recording'}
                  </Text>
                  <RecordingMeta />
                </View>
              </View>
            ) : null}
            {session.takes.map((take) => (
              <TakeRow
                key={take.id}
                take={take}
                active={take.id === session.playingId}
                onPlay={() => session.togglePlay(take.id)}
                onDelete={() => session.deleteTake(take.id)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="musical-notes" size={28} color={theme.paperDim} />
          </View>
        )}
      </ScrollView>

      {playing?.path ? (
        <Audio
          source={playing.path}
          autoPlay
          volume={1}
          onPositionChange={(seconds) => {
            const now = Date.now();
            if (now - playStamp.current < 250) return;
            playStamp.current = now;
            session.seekPlayhead(seconds);
          }}
          onEnded={session.stopPlayback}
          onError={session.stopPlayback}
        />
      ) : null}

      {playing ? <LivePlayer take={playing} onToggle={() => session.togglePlay(playing.id)} /> : null}
    </View>
  );
}

function RecordingMeta() {
  const { recordElapsed } = useTick();
  return <Text style={styles.meta}>Recording · {formatClock(recordElapsed)}</Text>;
}

function LivePlayer({ take, onToggle }: { take: Take; onToggle: () => void }) {
  const { playhead } = useTick();
  return (
    <View style={[styles.player, { bottom: 12 }]}>
      <PlayerBody take={take} playhead={playhead} onToggle={onToggle} />
    </View>
  );
}

function PlayerBody({
  take,
  playhead,
  onToggle,
}: {
  take: Take;
  playhead: number;
  onToggle: () => void;
}) {
  const progress = take.duration > 0 ? Math.min(1, playhead / take.duration) : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Pause take"
      onPress={onToggle}
      style={styles.playerInner}
    >
      <Ionicons name="pause" size={18} color={theme.ink} />
      <View style={styles.playerCopy}>
        <Text style={styles.playerTitle} numberOfLines={1}>
          {take.deviceName}
        </Text>
        <View style={styles.progress}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </View>
      <Text style={styles.playerTime}>{formatClock(playhead)}</Text>
    </Pressable>
  );
}

function TakeRow({
  take,
  active,
  onPlay,
  onDelete,
}: {
  take: Take;
  active: boolean;
  onPlay: () => void;
  onDelete: () => void;
}) {
  const size = formatSize(take.size);
  return (
    <View style={[styles.row, active && styles.rowOn]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Play take" onPress={onPlay} style={styles.play}>
        <Ionicons name={active ? 'pause' : 'play'} size={16} color={theme.ink} />
      </Pressable>
      <View style={styles.rowCopy}>
        <Text style={styles.name} numberOfLines={1}>
          {take.deviceName}
        </Text>
        <Text style={styles.meta}>
          {formatClock(take.duration)}
          {size ? ` · ${size}` : ''}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Delete take" onPress={onDelete} hitSlop={8}>
        <Ionicons name="trash-outline" size={18} color={theme.paperDim} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  kicker: {
    color: theme.sender,
    fontFamily: theme.font.semibold,
    fontSize: 12,
    letterSpacing: 2.4,
  },
  title: {
    marginBottom: 16,
    color: theme.paper,
    fontFamily: theme.font.display,
  },
  empty: {
    marginTop: 36,
    alignItems: 'center',
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 22,
    backgroundColor: theme.raised,
    borderWidth: 1,
    borderColor: theme.line,
  },
  rowOn: {
    borderColor: theme.receiver,
  },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.paper,
  },
  liveMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.live,
  },
  liveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.paper,
  },
  rowCopy: {
    flex: 1,
  },
  name: {
    color: theme.paper,
    fontFamily: theme.font.semibold,
    fontSize: 15,
  },
  meta: {
    marginTop: 3,
    color: theme.paperDim,
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 16,
  },
  player: {
    position: 'absolute',
    left: 18,
    right: 18,
  },
  playerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.paper,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  playerCopy: {
    flex: 1,
    gap: 6,
  },
  playerTitle: {
    color: theme.ink,
    fontFamily: theme.font.semibold,
    fontSize: 14,
  },
  playerTime: {
    color: theme.ink,
    fontFamily: theme.font.medium,
    fontSize: 13,
  },
  progress: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(18, 19, 15, 0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: theme.ink,
  },
});
