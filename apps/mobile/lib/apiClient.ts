import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { ApiClient, type TokenStorage } from '@carp-partners/api-client';

const REFRESH_TOKEN_KEY = 'cp_refresh_token';

// El TokenStorage del api-client es síncrono (pensado para localStorage en
// web) — expo-secure-store expone las mismas operaciones en versión sync
// (getItem/setItem/deleteItem) en iOS/Android. En web (expo start --web) no
// existen esas variantes síncronas, así que ahí caemos a memoria: no hay
// persistencia entre recargas, pero tampoco rompe nada (web es solo para
// depurar UI en este proyecto, la app real es iOS/Android).
class SecureTokenStorage implements TokenStorage {
  private cache: string | null = null;

  constructor() {
    if (Platform.OS === 'web') return;
    try {
      this.cache = SecureStore.getItem(REFRESH_TOKEN_KEY);
    } catch {
      this.cache = null;
    }
  }

  getRefreshToken(): string | null {
    return this.cache;
  }

  setRefreshToken(token: string): void {
    this.cache = token;
    if (Platform.OS === 'web') return;
    try {
      SecureStore.setItem(REFRESH_TOKEN_KEY, token);
    } catch {
      /* si falla el guardado nativo, seguimos con la sesión solo en memoria */
    }
  }

  clearRefreshToken(): void {
    this.cache = null;
    if (Platform.OS === 'web') return;
    // No hay deleteItem síncrono (solo deleteItemAsync) — el borrado real en
    // disco puede ir en segundo plano, la caché en memoria ya queda limpia
    // de inmediato, que es lo que importa para el resto de esta sesión.
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
  }
}

// Base URL del backend: en un dev build normal, `expo.extra.apiUrl` de
// app.json/app.config; con fallback al backend local (mismo puerto que usa
// el resto del monorepo). NEXT_PUBLIC_API_URL (el fallback interno del
// api-client) no existe en el entorno de Expo, así que hay que inyectarla
// aquí explícitamente.
const baseUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  'http://localhost:3001';

export const apiClient = new ApiClient({ baseUrl, storage: new SecureTokenStorage() });
