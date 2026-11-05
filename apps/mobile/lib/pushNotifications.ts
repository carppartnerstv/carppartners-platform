import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient } from './apiClient';

// Pide permiso (si falta) y registra el token de push de este dispositivo
// en el backend. Se llama al autenticar (si el usuario ya tiene el toggle
// Push activado) y al activar el toggle desde Perfil. Nunca lanza: un "no"
// del usuario o un fallo de red no debe romper ningún flujo que la dispare.
export async function registerForPushNotificationsAsync(): Promise<void> {
  try {
    if (Platform.OS === 'web') return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    await apiClient.registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
  } catch (err) {
    console.warn('[push] No se pudo registrar el token push:', err);
  }
}
