import React from 'react';

export type RatingValue = 'down' | 'like' | 'love';

export interface RatingDialogProps {
  videoTitle: string;
  value: RatingValue | null;
  onChange: (value: RatingValue | null) => void;
  onClose: () => void;
}

export interface RatingMeta {
  icon: 'thumb-down' | 'thumb-up';
  /** "Me encanta" se dibuja como dos pulgares superpuestos, no un icono propio */
  double?: boolean;
  color: string;
  borderColor: string;
  bgColor: string;
}

// Única fuente de verdad de icono/color por voto — la reutiliza tanto este
// diálogo como el botón disparador de la pantalla de Detalle, para que el
// icono del botón siempre coincida con el voto real (nunca un pulgar arriba
// genérico cuando el usuario votó "No es para mí").
export const RATING_META: Record<RatingValue, RatingMeta> = {
  down: { icon: 'thumb-down', color: '#c0392b', borderColor: 'rgba(192,57,43,0.55)', bgColor: 'rgba(192,57,43,0.12)' },
  like: { icon: 'thumb-up',   color: '#cf4a35', borderColor: 'rgba(207,74,53,0.55)', bgColor: 'rgba(104,20,11,0.12)' },
  love: { icon: 'thumb-up', double: true, color: '#cf4a35', borderColor: 'rgba(207,74,53,0.55)', bgColor: 'rgba(104,20,11,0.12)' },
};

export const RATING_LABELS: Record<RatingValue, string> = {
  down: 'No es para mí',
  like: 'Me gusta',
  love: 'Me encanta',
};

const DIALOG_LABELS: Record<RatingValue, string> = {
  down: 'No es\npara mí',
  like: 'Me gusta',
  love: 'Me encanta',
};

const OPTIONS: RatingValue[] = ['down', 'like', 'love'];

const CONFIRM_TEXT: Record<RatingValue, string> = {
  down: 'Gracias, ajustaremos tus recomendaciones',
  like: 'Gracias por tu valoración',
  love: '¡Te encanta! Buscaremos más como este',
};

export function RatingDialog({ videoTitle, value, onChange, onClose }: RatingDialogProps) {
  const select = (key: RatingValue) => onChange(value === key ? null : key);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-5"
      style={{ background: 'rgba(4,6,8,0.72)', backdropFilter: 'blur(3px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-fade-in relative w-full text-center rounded-[20px]"
        style={{
          maxWidth: 440,
          background: '#0e151a',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          padding: '34px 32px 30px',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/12"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#9aa9a3' }}
        >
          <i className="ti ti-x text-[17px]" />
        </button>

        <div className="font-display font-bold text-white text-[20px] mb-1.5">¿Qué te ha parecido?</div>
        <p className="text-[13.5px] mb-[30px] truncate" style={{ color: '#85958e' }}>{videoTitle}</p>

        <div className="flex items-stretch justify-center gap-3.5">
          {OPTIONS.map((key) => {
            const meta = RATING_META[key];
            const selected = value === key;
            const iconSuffix = selected ? '-filled' : '';
            const iconColor = selected ? '#fff' : '#9aa9a3';
            return (
              <button
                key={key}
                type="button"
                onClick={() => select(key)}
                className="flex-1 flex flex-col items-center gap-3 py-5 px-2 rounded-[14px] transition-all hover:bg-white/6"
                style={{
                  background: selected ? meta.bgColor : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${selected ? meta.borderColor : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center relative"
                  style={{ background: selected ? meta.color : 'rgba(255,255,255,0.06)' }}
                >
                  {meta.double ? (
                    <>
                      <i
                        className={`ti ti-${meta.icon}${iconSuffix} text-[19px]`}
                        style={{ color: iconColor, position: 'absolute', left: 12, top: 14, transform: 'rotate(-8deg)' }}
                      />
                      <i
                        className={`ti ti-${meta.icon}${iconSuffix} text-[19px]`}
                        style={{ color: iconColor, position: 'absolute', right: 12, top: 14, transform: 'rotate(8deg)' }}
                      />
                    </>
                  ) : (
                    <i className={`ti ti-${meta.icon}${iconSuffix} text-[25px]`} style={{ color: iconColor }} />
                  )}
                </div>
                <div
                  className="text-[12.5px] font-semibold leading-[1.3] whitespace-pre-line"
                  style={{ color: selected ? '#e9efeb' : '#9aa9a3' }}
                >
                  {DIALOG_LABELS[key]}
                </div>
              </button>
            );
          })}
        </div>

        {value && (
          <div className="mt-6 flex items-center justify-center gap-[7px] text-[13px]" style={{ color: '#cf4a35' }}>
            <i className="ti ti-check text-[16px]" />
            {CONFIRM_TEXT[value]}
          </div>
        )}
      </div>
    </div>
  );
}
