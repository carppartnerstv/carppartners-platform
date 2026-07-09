import React from 'react';

export interface CrewCardMember {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
}

export interface CrewCardProps {
  member: CrewCardMember;
  onClick?: (member: CrewCardMember) => void;
}

// Tarjeta de miembro de la crew para parrillas de exploración (Explorar → Crew).
// Mismo marco 16:9 que VideoCard/SeriesCard, pero sin icono de play ni
// segunda línea de metadatos (aquí no aplica "Socio"/"Miembro de la crew").
export function CrewCard({ member, onClick }: CrewCardProps) {
  return (
    <button
      onClick={() => onClick?.(member)}
      className="group relative w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      style={{ transition: 'transform .25s ease' }}
    >
      <div
        className="relative aspect-video rounded-card overflow-hidden bg-surface-raised border border-cp-border shadow-card
                   transition-transform duration-[250ms] ease-out
                   group-hover:-translate-y-[5px]"
      >
        {member.avatar_url ? (
          <img
            src={member.avatar_url}
            alt={member.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-surface-2 flex items-center justify-center">
            <PersonIcon className="w-10 h-10 text-white/20" />
          </div>
        )}

        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 38%, rgba(4,8,10,0.82) 100%)' }}
        />
        <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" />
      </div>

      <div className="pt-2.5 px-0.5">
        <p className="text-[13.5px] font-semibold leading-snug line-clamp-1" style={{ color: '#e9efeb' }}>
          {member.name}
        </p>
      </div>
    </button>
  );
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
