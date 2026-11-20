import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AudioDevice } from '../audio/types';
import { ErrorNote } from '../components/Chrome';
import { useFit } from '../layout';
import { useSession } from '../session';
import { theme } from '../theme';

export function DevicesScreen() {
  const insets = useSafeAreaInsets();
  const fit = useFit();
  const session = useSession();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 18, paddingBottom: fit.bottom, paddingHorizontal: fit.pad },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={session.refreshing}
          onRefresh={session.refreshDevices}
          tintColor={theme.paper}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <Text style={[styles.title, { fontSize: fit.title, lineHeight: fit.title + 4 }]}>Earbuds</Text>
        {Platform.OS === 'web' ? (
          <View style={styles.spacer} />
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Bluetooth settings" onPress={session.openBluetooth} style={styles.round}>
            <Ionicons name="settings-outline" size={20} color={theme.ink} />
          </Pressable>
        )}
      </View>
      <ErrorNote message={session.error} onDismiss={session.clearError} />

      <View style={styles.list}>
        {session.devices.filter((device) => device.kind === 'bluetooth').length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bluetooth" size={22} color={theme.paperDim} />
            <Text style={styles.emptyText}>No earbuds connected</Text>
          </View>
        ) : (
          session.devices
            .filter((device) => device.kind === 'bluetooth')
            .map((device) => (
              <DeviceRow
                key={device.id}
                device={device}
                selected={session.selected?.id === device.id}
                onPress={() => session.selectDevice(device.id)}
              />
            ))
        )}
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Assign ears" onPress={() => session.setScreen('roles')} style={styles.next}>
        <Ionicons name="swap-horizontal" size={22} color={theme.ink} />
      </Pressable>
    </ScrollView>
  );
}

function DeviceRow({
  device,
  selected,
  onPress,
}: {
  device: AudioDevice;
  selected: boolean;
  onPress: () => void;
}) {
  const icon =
    device.kind === 'bluetooth' ? 'bluetooth' : device.kind === 'wired' ? 'headset' : 'phone-portrait-outline';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.row, selected && styles.rowOn]}
    >
      <View style={[styles.icon, selected && styles.iconOn]}>
        <Ionicons name={icon} size={18} color={selected ? theme.ink : theme.paper} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {device.name}
      </Text>
      {selected ? <Ionicons name="checkmark" size={20} color={theme.receiver} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {},
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  title: {
    color: theme.paper,
    fontFamily: theme.font.display,
  },
  spacer: {
    width: 44,
    height: 44,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.paper,
  },
  empty: {
    marginTop: 28,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    color: theme.paperDim,
    fontFamily: theme.font.medium,
    fontSize: 15,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: theme.raised,
    borderWidth: 1,
    borderColor: theme.line,
  },
  rowOn: {
    borderColor: theme.receiver,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.raised2,
  },
  iconOn: {
    backgroundColor: theme.receiver,
  },
  name: {
    flex: 1,
    color: theme.paper,
    fontFamily: theme.font.semibold,
    fontSize: 16,
  },
  next: {
    alignSelf: 'center',
    marginTop: 22,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.paper,
  },
});
