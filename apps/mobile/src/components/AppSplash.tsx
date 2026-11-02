import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

/** Matches `imageWidth` for expo-splash-screen in app.json, so the native splash hands over without a jump. */
const IMAGE_SIZE = 320;
const HOLD_MS = 900;

/** Holds the launch screen over the app, then fades out. Always black, whatever the theme. */
export const AppSplash = () => {
  const [visible, setVisible] = useState(true);

  const onReady = () => {
    SplashScreen.hideAsync().catch(() => undefined);
    setTimeout(() => setVisible(false), HOLD_MS);
  };

  if (!visible) return null;
  return (
    <Animated.View exiting={FadeOut.duration(260)} style={styles.root}>
      <StatusBar style="light" />
      <Image source={require('../../assets/splash-icon.png')} style={styles.image} fadeDuration={0} onLoadEnd={onReady} accessibilityLabel="XRP Ledger" />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  image: { width: IMAGE_SIZE, height: IMAGE_SIZE },
});
