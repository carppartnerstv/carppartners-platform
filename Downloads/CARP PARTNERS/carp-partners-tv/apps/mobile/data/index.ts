// Data layer — swap implementations (mock vs real apiClient) without touching screen code.
//
// During Phase 1 (prototype), all functions return mock data.
// In Phase 2, replace each function body with the real apiClient call.

import {
  MOCK_VIDEOS,
  VIDEOS_BY_CATEGORY,
  CONTINUE_WATCHING,
  NEW_VIDEOS,
  TRENDING,
  HERO_VIDEO,
  type MockVideo,
} from './mock/videos';
import { MOCK_CATEGORIES, type MockCategory } from './mock/categories';
import { MOCK_USER, MOCK_SUBSCRIPTION, type MockUser, type MockSubscription } from './mock/user';

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(_email: string, _password: string): Promise<MockUser> {
  await delay(600);
  return MOCK_USER;
}

export async function register(_email: string, _name: string, _password: string): Promise<MockUser> {
  await delay(600);
  return MOCK_USER;
}

export async function logout(): Promise<void> {
  await delay(200);
}

export async function getMe(): Promise<{ user: MockUser; subscription: MockSubscription | null }> {
  await delay(300);
  return { user: MOCK_USER, subscription: MOCK_SUBSCRIPTION };
}

// ── Catálogo ──────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<MockCategory[]> {
  await delay(300);
  return MOCK_CATEGORIES;
}

export async function getVideos(params?: {
  category?: string;
  series?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<MockVideo[]> {
  await delay(400);
  let results = [...MOCK_VIDEOS];
  if (params?.category) results = results.filter((v) => v.category_id === params.category);
  if (params?.series) results = results.filter((v) => v.series_id === params.series);
  if (params?.q) {
    const q = params.q.toLowerCase();
    results = results.filter((v) => v.title.toLowerCase().includes(q));
  }
  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? 20;
  return results.slice(offset, offset + limit);
}

export async function getVideo(id: string): Promise<{ video: MockVideo; related: MockVideo[] }> {
  await delay(300);
  const video = MOCK_VIDEOS.find((v) => v.id === id) ?? MOCK_VIDEOS[0];
  const related = MOCK_VIDEOS.filter((v) => v.id !== id && v.category_id === video.category_id).slice(0, 6);
  return { video, related };
}

export async function getStreamUrl(_id: string): Promise<string> {
  // Returns a real HLS URL in production; for prototype, a public HLS test stream
  await delay(200);
  return 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
}

// ── Home rows ─────────────────────────────────────────────────────────────────

export function getContinueWatching(): MockVideo[] { return CONTINUE_WATCHING; }
export function getNewVideos(): MockVideo[] { return NEW_VIDEOS; }
export function getTrending(): MockVideo[] { return TRENDING; }
export function getHeroVideo(): MockVideo { return HERO_VIDEO; }
export function getVideosByCategory(categoryId: string): MockVideo[] {
  return VIDEOS_BY_CATEGORY[categoryId] ?? [];
}

// ── Watchlist ─────────────────────────────────────────────────────────────────

const _watchlist = new Set<string>();

export async function getWatchlist(): Promise<MockVideo[]> {
  await delay(300);
  return MOCK_VIDEOS.filter((v) => _watchlist.has(v.id));
}

export async function addToWatchlist(videoId: string): Promise<void> {
  await delay(200);
  _watchlist.add(videoId);
}

export async function removeFromWatchlist(videoId: string): Promise<void> {
  await delay(200);
  _watchlist.delete(videoId);
}

export function isInWatchlist(videoId: string): boolean {
  return _watchlist.has(videoId);
}

// ── Progress ──────────────────────────────────────────────────────────────────

const _progress = new Map<string, number>();

export async function saveProgress(videoId: string, progressSec: number): Promise<void> {
  _progress.set(videoId, progressSec);
}

export function getProgress(videoId: string): number {
  return _progress.get(videoId) ?? 0;
}

// ── Billing ───────────────────────────────────────────────────────────────────

export async function getBillingPortalUrl(): Promise<string> {
  await delay(500);
  return 'https://billing.stripe.com/mock';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
