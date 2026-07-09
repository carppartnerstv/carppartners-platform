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
  /** Ids de MockCrewMember (data/mock/crew.ts) que aparecen en este vídeo */
  crew?: string[];
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

  // ── Vídeos reales con reparto, para probar la sección "Reparto" ──────────────
  {
    id: 'v-9',
    title: 'DESENFRENO | Rio Guadiana | Parte 2',
    slug: 'desenfreno-rio-guadiana-parte-2',
    description:
      'Desenfreno es una sesión de primavera en estado puro. Días y días recorriendo tablas del río, probando puestos, leyendo el agua y dejándose llevar por lo que el Guadiana quiere mostrar en cada momento.\n\n' +
      'Fran López y Oriol Vilamú vuelven a encontrarse a orillas del río Guadiana, en una de esas situaciones en las que todo empieza a encajar: el tiempo cambia, las condiciones se alinean y la experiencia acumulada tras muchas jornadas empieza a pesar más que cualquier plan previo.',
    duration_sec: 1378,
    thumbnail_url: 'https://i.vimeocdn.com/video/2116238604-47688fec90d753f05322bdbb6d8960fce6b2852bae1676093abf6891c8bb3812-d_1920x1080?&r=pad&region=us',
    category_id: 'cat-2',
    series_id: null,
    episode_num: null,
    created_at: '2026-05-20T10:00:00Z',
    is_new: true,
    crew: ['crew-fran-lopez', 'crew-oriol-vilamu'],
  },
  {
    id: 'v-10',
    title: 'Meet + Fran',
    slug: 'meet-fran',
    description:
      'En este nuevo episodio de Meet+ conocemos de cerca a Francisco López, más conocido como Fran. Un pescador con una historia muy personal, marcada por su entorno y por una pasión que le acompaña desde muy joven.\n\n' +
      'Comenzamos la serie visitando uno de los rincones más emblemáticos de su tierra: el Puente Romano de Mérida, y nos adentramos en el embalse de Proserpina, su "segunda casa" y donde nació su amor por la pesca.',
    duration_sec: 2393,
    thumbnail_url: 'https://i.vimeocdn.com/video/2056398215-beae5a75cc07ae4f6757a12751d66d3f4b43b01f70f0ad71ad306cf4beaae487-d_1920x1080?&r=pad&region=us',
    category_id: 'cat-3',
    series_id: null,
    episode_num: null,
    created_at: '2026-04-10T10:00:00Z',
    crew: ['crew-fran-lopez', 'crew-oriol-vilamu'],
  },
  {
    id: 'v-11',
    title: 'La Picada 8 (Zayas)',
    slug: 'la-picada-8-zayas',
    description: 'Nueva entrega de La Picada, el formato que mezcla entretenimiento y carpfishing con invitados de excepción.',
    duration_sec: 5878,
    thumbnail_url: 'https://i.vimeocdn.com/video/1996700243-8ef78c903321b523f039a44ec29746c50adf56612544888d77481b30617f781b-d_1920x1080',
    category_id: 'cat-5',
    series_id: null,
    episode_num: 8,
    created_at: '2026-03-01T10:00:00Z',
    crew: ['crew-oriol-vilamu'],
  },
  {
    id: 'v-12',
    title: 'El Duelo 1.1',
    slug: 'el-duelo-1-1',
    description: 'Dos equipos, un mismo lago, 48 horas para demostrar quién pesca mejor.',
    duration_sec: 2204,
    thumbnail_url: 'https://i.vimeocdn.com/video/2159063036-450feefaf73c9ec4850bcef48ee827421947cbe0d4d9c5768338e767f9ffa81b-d_1920x1080',
    category_id: 'cat-2',
    series_id: null,
    episode_num: null,
    created_at: '2026-06-18T10:00:00Z',
    crew: ['crew-oriol-vilamu'],
  },
  {
    id: 'v-13',
    title: 'David Molina Meet+',
    slug: 'david-molina-meet',
    description: 'Otro episodio de Meet+ conociendo de cerca a los pescadores de la comunidad Carp Partners.',
    duration_sec: 2229,
    thumbnail_url: 'https://i.vimeocdn.com/video/1952266518-efce0e8df62e8bdb44a66c61b407aa9b8946cb8e25f933507e83e881c37330f0-d_1920x1080?&r=pad&region=us',
    category_id: 'cat-3',
    series_id: null,
    episode_num: null,
    created_at: '2026-02-15T10:00:00Z',
    crew: ['crew-oriol-vilamu'],
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
