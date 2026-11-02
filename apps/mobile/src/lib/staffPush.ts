import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Off until Firebase and Apple push are set up; turning it on also needs the expo-notifications plugin in app.json. */
const PUSH_READY = false;

/** This phone's push address, asking permission first. Null if refused, or the build has no push credentials. */
export const staffPushToken = async (): Promise<string | null> => {
  if (!PUSH_READY || Platform.OS === 'web') return null;
  try {
    const { granted } = await Notifications.requestPermissionsAsync();
    if (!granted) return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alerts', { name: 'Compliance alerts', importance: Notifications.AndroidImportance.HIGH });
    }
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
};
