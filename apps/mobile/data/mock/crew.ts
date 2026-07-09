// Reparto (cast) — mismo modelo que crew_members en el backend real: solo
// dos tipos posibles, sin rol de texto libre. La etiqueta se calcula desde
// `role` con el mapa ROLE_LABELS (ver data/index.ts), nunca se guarda aparte.
export type CrewRole = 'socio' | 'crew';

export interface MockCrewMember {
  id: string;
  name: string;
  slug: string;
  role: CrewRole;
  avatar_url: string | null;
  bio: string;
}

// Contenido real (nombre, foto, biografía) copiado del catálogo real de
// Carp Partners para poder probar con datos auténticos en vez de placeholders.
export const MOCK_CREW: MockCrewMember[] = [
  {
    id: 'crew-oriol-vilamu',
    name: 'Oriol Vilamú',
    slug: 'oriol-vilamu',
    role: 'socio',
    avatar_url: 'http://localhost:3001/uploads/crew/1782491458022-du0bb4f.png',
    bio:
      'Creador de Contenido y Documentalista de Carpfishing\n\n' +
      'Oriol Vilamú es el fundador de Carp Partners, la primera plataforma de vídeos de carpfishing en España, ofreciendo contenido exclusivo para apasionados de la pesca. Su trayectoria comenzó con una tradición familiar que lo llevó a explorar el mundo de la pesca desde pequeño.\n\n' +
      'Como creador de la serie Solo Carp, Oriol recorre el mundo pescando en solitario y documentando sus aventuras con una narrativa única. Además, ha producido y desarrollado formatos innovadores como La Picada, combinando entretenimiento, retos y un enfoque dinámico para conectar con la audiencia.\n\n' +
      'Comprometido con llevar la pesca al siguiente nivel, Oriol trabaja incansablemente en la producción de documentales, programas y contenido de calidad, siempre con el objetivo de inspirar a la comunidad carpera.',
  },
  {
    id: 'crew-fran-lopez',
    name: 'Fran López',
    slug: 'fran-lopez',
    role: 'crew',
    avatar_url: 'http://localhost:3001/uploads/crew/1783513698918-0qym9iv.png',
    bio:
      'Desde tierras extremeñas nos llega Fran López, un joven apasionado del carpfishing que lleva la pesca en la sangre desde que tiene memoria. Gracias a su familia, creció rodeado de cañas, cebos y aventuras, y desde muy pequeño supo que su sitio estaba junto al agua. Con el tiempo, su camino se cruzó con el carpfishing, y desde entonces, no ha mirado atrás.\n\n' +
      'Gran parte de su trayectoria se ha forjado en las aguas del emblemático embalse de Proserpina, y ha recorrido, una y otra vez, los rincones del río Guadiana, del que conoce casi cada curva, cada recula y cada detalle como si fuera su patio trasero.\n\n' +
      'Durante años, Fran no tuvo coche, lo que no le impidió moverse constantemente, explorando, pescando y aprendiendo con las herramientas justas y la motivación de un auténtico explorador. Su historia demuestra que la pasión rompe cualquier barrera, incluso la de la movilidad.\n\n' +
      'Ahora, con el carnet de conducir recién estrenado, se abre una nueva etapa para él: la de los grandes viajes, los retos aún mayores, y quién sabe cuántos nuevos récords personales por venir.\n\n' +
      'Sin duda, Fran es de esos que pescan con el corazón… y con una determinación que arrastra todo lo que se proponga.',
  },
];
