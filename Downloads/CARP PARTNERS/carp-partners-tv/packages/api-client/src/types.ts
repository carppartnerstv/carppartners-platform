// Tipos que reflejan exactamente lo que devuelve el backend (snake_case de PostgreSQL)
// Excepción: accessToken/refreshToken vienen en camelCase desde el backend

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'admin';
  avatar_url: string | null;
  stripe_customer_id: string | null;
}

export interface Subscription {
  plan: string;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  period_end: string | null;
  cancelled_at: string | null;
}

export interface Video {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration_sec: number;
  thumbnail_url: string | null;
  category_id: string | null;
  series_id: string | null;
  episode_num: number | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  order_index: number;
}

export interface Series {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  season_num: number | null;
  cover_url: string | null;
  order_index: number;
  episode_count: number;
}

export interface WatchHistoryItem {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string | null;
  duration_sec: number;
  progress_sec: number;
  last_watched_at: string;
}

export interface WatchlistItem {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string | null;
  duration_sec: number;
  added_at: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface DashboardStats {
  activeSubscribers: number;
  publishedVideos: number;
  playsToday: number;
  mrr: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  plan: string | null;
  status: string | null;
  period_end: string | null;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  email: string | null;
  refunded: boolean;
  created: string;
}

export interface AdminVideoInput {
  title: string;
  slug: string;
  vimeoId: string;
  description?: string;
  durationSec?: number;
  thumbnailUrl?: string;
  categoryId?: string;
  seriesId?: string;
  episodeNum?: number;
  published?: boolean;
}
