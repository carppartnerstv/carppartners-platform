import type {
  User,
  Subscription,
  Video,
  Category,
  Series,
  WatchHistoryItem,
  WatchlistItem,
  AuthResponse,
  DashboardStats,
  AdminUser,
  Payment,
  AdminVideoInput,
} from './types.js';

// ─── Error tipado ────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Almacenamiento de tokens ────────────────────────────────────────────────

export interface TokenStorage {
  getRefreshToken(): string | null;
  setRefreshToken(token: string): void;
  clearRefreshToken(): void;
}

class BrowserStorage implements TokenStorage {
  private readonly key = 'cp_refresh_token';

  getRefreshToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(this.key);
  }

  setRefreshToken(token: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.key, token);
  }

  clearRefreshToken(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(this.key);
  }
}

// ─── Cliente principal ───────────────────────────────────────────────────────

export class ApiClient {
  private readonly baseUrl: string;
  private accessToken: string | null = null;
  private readonly storage: TokenStorage;
  private refreshPromise: Promise<void> | null = null;

  constructor(options?: { baseUrl?: string; storage?: TokenStorage }) {
    const envUrl = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || '';
    this.baseUrl = options?.baseUrl || envUrl || 'http://localhost:3001';
    this.storage = options?.storage ?? new BrowserStorage();
  }

  // ── Gestión de sesión ──────────────────────────────────────────────────────

  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.storage.setRefreshToken(refreshToken);
  }

  clearTokens(): void {
    this.accessToken = null;
    this.storage.clearRefreshToken();
  }

  hasSession(): boolean {
    return this.accessToken !== null || this.storage.getRefreshToken() !== null;
  }

  // Intenta recuperar la sesión al cargar la app usando el refreshToken guardado
  async restoreSession(): Promise<{ user: User; subscription: Subscription | null } | null> {
    if (!this.storage.getRefreshToken()) return null;
    try {
      await this.doRefresh();
      return this.getMe();
    } catch {
      return null;
    }
  }

  // ── Lógica de refresh ──────────────────────────────────────────────────────

  private async doRefresh(): Promise<void> {
    const refreshToken = this.storage.getRefreshToken();
    if (!refreshToken) throw new ApiError('NO_REFRESH', 'Sin sesión activa', 401);

    const res = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      this.clearTokens();
      const data = await res.json().catch(() => ({}));
      throw new ApiError(
        data?.error?.code ?? 'REFRESH_FAILED',
        data?.error?.message ?? 'Sesión expirada',
        res.status,
      );
    }

    const data: AuthResponse = await res.json();
    this.setTokens(data.accessToken, data.refreshToken);
  }

  // ── Petición base ──────────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      auth?: boolean;
      query?: Record<string, string | number | boolean | undefined>;
    },
  ): Promise<T> {
    const { body, auth = true, query } = options ?? {};

    let url = `${this.baseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) params.set(k, String(v));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const makeHeaders = (): Record<string, string> => {
      const h: Record<string, string> = { 'Content-Type': 'application/json' };
      if (auth && this.accessToken) h['Authorization'] = `Bearer ${this.accessToken}`;
      return h;
    };

    const fetchOptions = (): RequestInit => ({
      method,
      headers: makeHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let res = await fetch(url, fetchOptions());

    // Si 401, intentamos refresh una sola vez y reintentamos
    if (res.status === 401 && auth) {
      if (!this.refreshPromise) {
        this.refreshPromise = this.doRefresh().finally(() => {
          this.refreshPromise = null;
        });
      }
      try {
        await this.refreshPromise;
      } catch (e) {
        throw e;
      }
      res = await fetch(url, fetchOptions());
    }

    if (res.status === 204) return undefined as T;

    const responseData = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new ApiError(
        responseData?.error?.code ?? 'API_ERROR',
        responseData?.error?.message ?? `Error ${res.status}`,
        res.status,
      );
    }

    return responseData as T;
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('POST', '/auth/login', {
      body: { email, password },
      auth: false,
    });
    this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('POST', '/auth/register', {
      body: { email, password, ...(name ? { name } : {}) },
      auth: false,
    });
    this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  async logout(): Promise<void> {
    const refreshToken = this.storage.getRefreshToken();
    await this.request<void>('POST', '/auth/logout', {
      body: { refreshToken },
      auth: false,
    }).catch(() => {});
    this.clearTokens();
  }

  async getMe(): Promise<{ user: User; subscription: Subscription | null }> {
    return this.request('GET', '/auth/me');
  }

  async setPassword(token: string, password: string): Promise<{ ok: boolean }> {
    return this.request('POST', '/auth/set-password', {
      body: { token, password },
      auth: false,
    });
  }

  // ─── Catálogo ──────────────────────────────────────────────────────────────

  async getVideos(params?: {
    limit?: number;
    offset?: number;
    category?: string;
    series?: string;
    q?: string;
  }): Promise<{ videos: Video[]; limit: number; offset: number }> {
    return this.request('GET', '/videos', { query: params });
  }

  async getVideo(id: string): Promise<{ video: Video; related: Video[] }> {
    return this.request('GET', `/videos/${id}`);
  }

  async getVideoStream(id: string): Promise<{ hlsUrl: string; expiresInSec: number }> {
    return this.request('GET', `/videos/${id}/stream`);
  }

  async getCategories(): Promise<{ categories: Category[] }> {
    return this.request('GET', '/categories');
  }

  async getSeries(params?: { category?: string }): Promise<{ series: Series[] }> {
    return this.request('GET', '/series', { query: params });
  }

  // ─── Historial ─────────────────────────────────────────────────────────────

  async saveProgress(videoId: string, progressSec: number, completed?: boolean): Promise<void> {
    return this.request('POST', '/watch-history', {
      body: { videoId, progressSec, ...(completed !== undefined ? { completed } : {}) },
    });
  }

  async getContinueWatching(): Promise<{ items: WatchHistoryItem[] }> {
    return this.request('GET', '/watch-history/continue');
  }

  // ─── Watchlist ─────────────────────────────────────────────────────────────

  async getWatchlist(): Promise<{ items: WatchlistItem[] }> {
    return this.request('GET', '/watchlist');
  }

  async addToWatchlist(videoId: string): Promise<void> {
    return this.request('POST', `/watchlist/${videoId}`);
  }

  async removeFromWatchlist(videoId: string): Promise<void> {
    return this.request('DELETE', `/watchlist/${videoId}`);
  }

  // ─── Push tokens ───────────────────────────────────────────────────────────

  async registerPushToken(
    token: string,
    platform: 'ios' | 'android' | 'web',
  ): Promise<{ ok: boolean }> {
    return this.request('POST', '/push-tokens', { body: { token, platform } });
  }

  // ─── Billing ───────────────────────────────────────────────────────────────

  async getBillingPortal(): Promise<{ url: string }> {
    return this.request('POST', '/billing/portal');
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────

  async getAdminDashboard(): Promise<DashboardStats> {
    return this.request('GET', '/admin/dashboard');
  }

  async getAdminUsers(params?: {
    status?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: AdminUser[]; limit: number; offset: number }> {
    return this.request('GET', '/admin/users', { query: params });
  }

  async getAdminPayments(params?: { limit?: number }): Promise<{ payments: Payment[] }> {
    return this.request('GET', '/admin/payments', { query: params });
  }

  async createAdminVideo(video: AdminVideoInput): Promise<{ video: Video }> {
    return this.request('POST', '/admin/videos', { body: video });
  }

  async updateAdminVideo(
    id: string,
    video: Partial<AdminVideoInput>,
  ): Promise<{ video: Video }> {
    return this.request('PUT', `/admin/videos/${id}`, { body: video });
  }

  async deleteAdminVideo(id: string): Promise<void> {
    return this.request('DELETE', `/admin/videos/${id}`);
  }
}

// Singleton para uso en la web (browser-side)
export const apiClient = new ApiClient();
