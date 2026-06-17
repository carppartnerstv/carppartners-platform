export interface MockVideo {
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
  // UI extras
  is_new?: boolean;
  rank?: number;
  progress_sec?: number;
}

// Thumbnails via picsum (desarrollo únicamente)
const T = (seed: number) => `https://picsum.photos/seed/${seed}/640/360`;

export const MOCK_VIDEOS: MockVideo[] = [
  {
    id: 'v-1',
    title: 'El Montaje Chod Definitivo',
    slug: 'montaje-chod-definitivo',
    description: 'Aprende paso a paso el montaje chod que funciona en cualquier fondo, desde limo hasta piedra. Incluye variantes de longitud de gancho y elección de pelo.',
    duration_sec: 2460,
    thumbnail_url: T(10),
    category_id: 'cat-1',
    series_id: 'ser-1',
    episode_num: 1,
    created_at: '2026-05-01T10:00:00Z',
    is_new: true,
  },
  {
    id: 'v-2',
    title: 'Zig Rigs: Atacar en Superficie',
    slug: 'zig-rigs-superficie',
    description: 'Domina los zigs y pesca carpas que se alimentan en la columna de agua. Materiales, longitudes y señales visuales.',
    duration_sec: 1890,
    thumbnail_url: T(20),
    category_id: 'cat-1',
    series_id: 'ser-1',
    episode_num: 2,
    created_at: '2026-05-08T10:00:00Z',
    progress_sec: 420,
  },
  {
    id: 'v-3',
    title: 'Lac de Madine: 72 Horas en Francia',
    slug: 'lac-de-madine-72h',
    description: 'Sesión completa en uno de los mejores lagos franceses. Estrategia, capturas y errores que aprendimos.',
    duration_sec: 5820,
    thumbnail_url: T(30),
    category_id: 'cat-2',
    series_id: null,
    episode_num: null,
    created_at: '2026-05-15T10:00:00Z',
    rank: 1,
  },
  {
    id: 'v-4',
    title: 'Beaumont Club: El Lago de los Monstruos',
    slug: 'beaumont-club',
    description: 'Sesión de 5 noches en Beaumont Club, Surrey. Capturas por encima de los 30kg y el secreto del fondo de pellets.',
    duration_sec: 6300,
    thumbnail_url: T(40),
    category_id: 'cat-2',
    series_id: null,
    episode_num: null,
    created_at: '2026-05-22T10:00:00Z',
    rank: 2,
  },
  {
    id: 'v-5',
    title: 'Masterclass de Boilies con Nic Cheetham',
    slug: 'masterclass-boilies-nic-cheetham',
    description: 'El campeón europeo explica la química de los boilies: atractores, proteínas, cocción y curado. Fórmulas exclusivas.',
    duration_sec: 4200,
    thumbnail_url: T(50),
    category_id: 'cat-3',
    series_id: 'ser-2',
    episode_num: 1,
    created_at: '2026-06-01T10:00:00Z',
    is_new: true,
    rank: 3,
  },
  {
    id: 'v-6',
    title: 'Particle Power: Cebado Masivo',
    slug: 'particle-power-cebado-masivo',
    description: 'Cómo preparar y usar partículas (maíz, garbanzos, cáñamo) para crear puntos de alimentación irresistibles.',
    duration_sec: 3180,
    thumbnail_url: T(60),
    category_id: 'cat-4',
    series_id: 'ser-2',
    episode_num: 2,
    created_at: '2026-06-08T10:00:00Z',
    progress_sec: 1200,
  },
  {
    id: 'v-7',
    title: 'Review: Shimano Tribal TX-A 12ft',
    slug: 'review-shimano-tribal-tx-a',
    description: 'Analizamos en profundidad la caña más popular del 2026: arrojar, sensibilidad, acción y relación calidad-precio.',
    duration_sec: 1560,
    thumbnail_url: T(70),
    category_id: 'cat-5',
    series_id: null,
    episode_num: null,
    created_at: '2026-06-10T10:00:00Z',
    is_new: true,
  },
  {
    id: 'v-8',
    title: 'El PVA: Guía Completa',
    slug: 'pva-guia-completa',
    description: 'Bolsas, mallas, solubles: cuándo y cómo usar el PVA para maximizar el atractivo del montaje.',
    duration_sec: 2100,
    thumbnail_url: T(80),
    category_id: 'cat-1',
    series_id: 'ser-1',
    episode_num: 3,
    created_at: '2026-06-12T10:00:00Z',
  },
];

// Agrupados por categoría para las filas de Home
export const VIDEOS_BY_CATEGORY: Record<string, MockVideo[]> = {
  'cat-1': MOCK_VIDEOS.filter((v) => v.category_id === 'cat-1'),
  'cat-2': MOCK_VIDEOS.filter((v) => v.category_id === 'cat-2'),
  'cat-3': MOCK_VIDEOS.filter((v) => v.category_id === 'cat-3'),
  'cat-4': MOCK_VIDEOS.filter((v) => v.category_id === 'cat-4'),
  'cat-5': MOCK_VIDEOS.filter((v) => v.category_id === 'cat-5'),
};

export const CONTINUE_WATCHING = MOCK_VIDEOS.filter((v) => v.progress_sec && v.progress_sec > 0);
export const NEW_VIDEOS = MOCK_VIDEOS.filter((v) => v.is_new);
export const TRENDING = MOCK_VIDEOS.filter((v) => v.rank != null).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
export const HERO_VIDEO = MOCK_VIDEOS[2]; // Lac de Madine como hero
