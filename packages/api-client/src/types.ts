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
  /** Presente en /videos y /videos/:id; ausente en vídeos "sintéticos" derivados de historial/watchlist */
  crew?: Pick<CrewMember, 'id' | 'name' | 'slug' | 'role' | 'avatar_url'>[];
}

// Forma real (más reducida que Video) que devuelve /videos/:id en "related",
// con el progreso de visionado del usuario actual para esa tarjeta.
export interface RelatedVideo {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string | null;
  duration_sec: number;
  episode_num: number | null;
  progress_sec: number | null;
  completed: boolean | null;
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
  season_count: number;
  episode_count: number;
}

// Temporada = fila de `series` con parent_series_id apuntando a la serie
// madre. Un array vacío en SeriesDetail.seasons significa serie "plana".
export interface SeriesSeason {
  id: string;
  title: string;
  slug: string;
  season_num: number | null;
  cover_url: string | null;
  order_index: number;
  episode_count: number;
}

export interface SeriesDetail {
  series: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    category_id: string | null;
    season_num: number | null;
    cover_url: string | null;
    order_index: number;
    parent_series_id: string | null;
  };
  seasons: SeriesSeason[];
}

export interface AdminSeries {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  season_num: number | null;
  cover_url: string | null;
  order_index: number;
  parent_series_id: string | null;
  created_at: string;
  category_name: string | null;
  parent_title: string | null;
  season_count: number;
  video_count: number;
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

export interface UserStatusCounts {
  active: number;
  trialing: number;
  past_due: number;
  cancelled: number;
  with_subscription: number;
  total: number;
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
  publishedAt?: string | null;
  crewMemberIds?: string[];
  /** Destacado en la portada (hero) de Home. Solo un vídeo puede estarlo a la vez. */
  isFeatured?: boolean;
}

export interface RatingsSummary {
  love: number;
  like: number;
  down: number;
  total: number;
  avg: number | null;
}

// GET /admin/videos devuelve campos extra respecto al Video público
export interface AdminVideo extends Video {
  vimeo_id: string;
  published: boolean;
  published_at: string | null;
  status: 'borrador' | 'programado' | 'publicado';
  updated_at: string;
  category_name: string | null;
  series_title: string | null;
  // crew hereda de Video (incluye avatar_url)
  ratings: RatingsSummary;
  is_featured: boolean;
}

export interface CrewMember {
  id: string;
  name: string;
  slug: string;
  role: 'socio' | 'crew';
  bio: string | null;
  avatar_url: string | null;
  order_index: number;
  created_at?: string;
}

export interface CrewMemberInput {
  name: string;
  slug: string;
  role?: 'socio' | 'crew';
  bio?: string;
  avatarUrl?: string;
  orderIndex?: number;
}

export interface CategoryInput {
  name: string;
  slug: string;
  description?: string;
  coverUrl?: string;
  orderIndex?: number;
}

export interface SeriesInput {
  title: string;
  slug: string;
  description?: string;
  categoryId?: string;
  seasonNum?: number;
  coverUrl?: string;
  orderIndex?: number;
  // uuid de la serie madre para convertir esta serie en una temporada suya,
  // o null para quitarle la serie madre (solo se permite un nivel).
  parentSeriesId?: string | null;
}
