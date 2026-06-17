export interface MockCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
}

export const MOCK_CATEGORIES: MockCategory[] = [
  { id: 'cat-1', name: 'Técnicas', slug: 'tecnicas', description: 'Montajes, aparejos y tácticas de captura', sort_order: 1 },
  { id: 'cat-2', name: 'Destinos', slug: 'destinos', description: 'Los mejores lagos de Europa', sort_order: 2 },
  { id: 'cat-3', name: 'Masterclass', slug: 'masterclass', description: 'Formación intensiva con expertos', sort_order: 3 },
  { id: 'cat-4', name: 'Alimentación', slug: 'alimentacion', description: 'Boilies, partículas y estrategia de cebado', sort_order: 4 },
  { id: 'cat-5', name: 'Equipo', slug: 'equipo', description: 'Análisis y reviews de material', sort_order: 5 },
];
