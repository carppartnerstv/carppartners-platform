import React from 'react';

export interface CastMember {
  id: string;
  name: string;
  slug: string;
  /** Solo dos valores posibles — la etiqueta se calcula, nunca es texto libre */
  role: string;
  avatar_url: string | null;
}

export interface CastRowProps {
  crew: CastMember[];
  onSelect?: (member: CastMember) => void;
  /** Encabezado sobre la fila. `null` la oculta (p. ej. al reutilizar en una parrilla de exploración). */
  title?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  socio: 'Socio',
  crew: 'Miembro de la crew',
};

// Sección "Reparto" de la ficha de vídeo. No se renderiza si no hay nadie
// asignado (crew vacío). También se reutiliza (con title={null}) como
// parrilla de miembros en el buscador de Explorar.
export function CastRow({ crew, onSelect, title = 'Reparto' }: CastRowProps) {
  if (!crew || crew.length === 0) return null;

  return (
    <div>
      {title && (
        <div
          className="text-[12.5px] font-semibold uppercase tracking-[0.04em] mb-4"
          style={{ color: '#7d8d86' }}
        >
          {title}
        </div>
      )}
      <div className="flex gap-[22px] flex-wrap">
        {crew.map((member) => {
          const initials = member.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelect?.(member)}
              className="flex flex-col items-center gap-2.5 w-[88px] text-center group"
            >
              {member.avatar_url ? (
                <img
                  src={member.avatar_url}
                  alt=""
                  className="w-16 h-16 rounded-full object-cover border border-white/14 transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center font-display font-semibold text-white border border-white/14"
                  style={{ background: 'linear-gradient(135deg,#5a241d,#2a1411)' }}
                >
                  {initials}
                </div>
              )}
              <div>
                <div className="text-[12.5px] font-semibold leading-[1.3]" style={{ color: '#e9efeb' }}>
                  {member.name}
                </div>
                <div className="text-[11px] mt-0.5 leading-[1.3]" style={{ color: '#cf4a35' }}>
                  {ROLE_LABELS[member.role] ?? member.role}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
