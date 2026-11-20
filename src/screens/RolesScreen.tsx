import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ear } from '../audio/types';
import { Bud } from '../components/Bud';
import { Signal } from '../components/Signal';
import { useFit } from '../layout';
import { useSession } from '../session';
import { theme } from '../theme';

export function RolesScreen() {
  const insets = useSafeAreaInsets();
  const fit = useFit();
  const session = useSession();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { flexGrow: 1, paddingTop: insets.top + 18, paddingBottom: fit.bottom, paddingHorizontal: fit.pad, justifyContent: 'center' },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stage}>
        <Bud
          ear="left"
          role={roleFor('left', session.receiverEar)}
          size={fit.bud}
          onPress={() => session.chooseReceiver('left')}
        />
        <Signal active reverse={session.receiverEar === 'left'} reduceMotion={session.reduceMotion} width={fit.signal} />
        <Bud
          ear="right"
          role={roleFor('right', session.receiverEar)}
          size={fit.bud}
          onPress={() => session.chooseReceiver('right')}
        />
      </View>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Swap ears" onPress={session.swapEars} style={styles.round}>
          <Ionicons name="swap-horizontal" size={22} color={theme.ink} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open live stage" onPress={() => session.setScreen('stage')} style={styles.live}>
          <Ionicons name="radio" size={28} color={theme.paper} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

function roleFor(ear: Ear, receiverEar: Ear): 'sender' | 'receiver' {
  return ear === receiverEar ? 'receiver' : 'sender';
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  stage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  round: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.paper,
  },
  live: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.live,
  },
});
