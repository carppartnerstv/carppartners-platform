// La bio de crew y la descripción de series se editan como HTML enriquecido
// (Tiptap, ver /admin/paginas en la web) — aquí solo hace falta el texto,
// sin negritas/enlaces/listas, así que quitamos etiquetas y desescapamos
// las entidades más comunes.
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<\/(p|li|div)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatDurationShort(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDurationLong(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

/** mm:ss o h:mm:ss para el contador del reproductor */
export function formatClock(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// Compara fechas de calendario (no una ventana móvil de 24h), igual que el
// perfil web: un vídeo visto ayer a las 23:50 no debe salir como "Hoy" si ya
// son las 00:10 del día siguiente.
export function formatRelativeDay(dateStr: string): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(dateStr))) / 86_400_000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? 'Hace 1 semana' : `Hace ${weeks} semanas`;
  const months = Math.floor(days / 30);
  return months <= 1 ? 'Hace 1 mes' : `Hace ${months} meses`;
}
