import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFonts, InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Backdrop } from './src/components/Backdrop';
import { Dock } from './src/components/Chrome';
import { SessionProvider, useSession } from './src/session';
import { DevicesScreen } from './src/screens/DevicesScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { RolesScreen } from './src/screens/RolesScreen';
import { StageScreen } from './src/screens/StageScreen';
import { theme } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={styles.boot} />;
  }

  return (
    <GestureHandlerRootView style={styles.boot}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <SessionProvider>
          <Backdrop>
            <Root />
          </Backdrop>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Root() {
  const { screen } = useSession();

  return (
    <View style={styles.boot}>
      <View style={styles.frame}>
        <View key={screen} style={styles.boot}>
          {screen === 'home' ? <HomeScreen /> : null}
          {screen === 'devices' ? <DevicesScreen /> : null}
          {screen === 'roles' ? <RolesScreen /> : null}
          {screen === 'stage' ? <StageScreen /> : null}
          {screen === 'library' ? <LibraryScreen /> : null}
        </View>
        <Dock />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
});
