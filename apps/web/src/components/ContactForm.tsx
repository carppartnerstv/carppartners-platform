'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiClient, ApiError } from '@carp-partners/api-client';

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 9,
  padding: '12px 14px',
  color: '#eef3f0',
  fontFamily: 'Inter, sans-serif',
  fontSize: 14,
  outline: 'none',
};

// Borde + glow suave al enfocar — separado de inputStyle (arriba) porque un
// estilo inline de border no puede tener variante :focus; con clases sí.
const inputClass =
  'border border-white/10 focus:border-[#cf4a35] focus:shadow-[0_0_0_3px_rgba(207,74,53,0.18)] transition-[border-color,box-shadow] duration-200';

const labelClass = 'block text-[12px] font-semibold mb-[7px]';
const labelStyle: React.CSSProperties = { color: '#b3c0ba' };

// Tarjeta del formulario de contacto — POST /contact (guarda la consulta,
// avisa a MAIL_ADMIN y manda acuse de recibo al usuario). El backend solo
// tiene un campo `name`; Nombre + Apellidos se combinan al enviar.
export function ContactForm() {
  const [name, setName]         = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail]       = useState('');
  const [subject, setSubject]   = useState('');
  const [message, setMessage]   = useState('');
  const [error, setError]       = useState('');
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [privacyAccepted, setPrivacyAccepted]     = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Rellena tu nombre, correo y mensaje.');
      return;
    }
    if (!privacyAccepted) {
      setError('Debes aceptar la política de privacidad para continuar.');
      return;
    }

    setSending(true);
    try {
      await apiClient.submitContact({
        name: [name.trim(), lastName.trim()].filter(Boolean).join(' '),
        email: email.trim(),
        subject: subject.trim() || undefined,
        message: message.trim(),
        marketingOptIn: marketingAccepted,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el mensaje. Inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  };

  // Sin recuadro en móvil (a petición): los campos van directos sobre el
  // fondo de la página. Desde md recupera la tarjeta con fondo/blur de
  // siempre.
  const cardClass = 'md:p-8 md:rounded-[18px] md:bg-[rgba(14,21,26,0.75)] md:border md:border-[rgba(255,255,255,0.09)] md:backdrop-blur-[10px]';

  if (sent) {
    return (
      <div className={`${cardClass} flex flex-col items-center justify-center text-center md:min-h-[380px]`}>
        <i className="ti ti-circle-check text-[36px]" style={{ color: '#cf4a35' }} />
        <p className="font-display font-semibold text-white text-[18px] mt-4 mb-2">Mensaje enviado</p>
        <p className="text-[14px]" style={{ color: '#9aa9a3' }}>
          Gracias por escribirnos, {name.split(' ')[0]}. Te responderemos en menos de 24h.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelClass} style={labelStyle}>Nombre</label>
          <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="Nombre" style={inputStyle} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Apellidos</label>
          <input className={inputClass} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Apellidos" style={inputStyle} />
        </div>
      </div>
      <div className="mb-4">
        <label className={labelClass} style={labelStyle}>Tu email</label>
        <input className={inputClass} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" style={inputStyle} />
      </div>
      <div className="mb-4">
        <label className={labelClass} style={labelStyle}>Asunto</label>
        <input className={inputClass} value={subject} onChange={e => setSubject(e.target.value)} placeholder="¿En qué podemos ayudarte?" style={inputStyle} />
      </div>
      <div className="mb-6">
        <label className={labelClass} style={labelStyle}>Mensaje</label>
        <textarea
          className={inputClass}
          value={message} onChange={e => setMessage(e.target.value)} placeholder="Escribe tu mensaje aquí..." rows={4}
          style={{ ...inputStyle, resize: 'none' }}
        />
      </div>

      <label className="flex items-start gap-2.5 mb-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={privacyAccepted}
          onChange={e => setPrivacyAccepted(e.target.checked)}
          className="mt-[3px] w-[15px] h-[15px] rounded shrink-0 cursor-pointer accent-[#cf4a35]"
        />
        <span className="text-[12.5px] leading-[1.55]" style={{ color: '#9aa9a3' }}>
          He leído y acepto la{' '}
          <Link href="/politica-de-privacidad" target="_blank" className="underline hover:text-white transition-colors" style={{ color: '#cf4a35' }}>
            política de privacidad
          </Link>
          <span style={{ color: '#ff8a80' }}> *</span>
        </span>
      </label>
      <label className="flex items-start gap-2.5 mb-6 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={marketingAccepted}
          onChange={e => setMarketingAccepted(e.target.checked)}
          className="mt-[3px] w-[15px] h-[15px] rounded shrink-0 cursor-pointer accent-[#cf4a35]"
        />
        <span className="text-[12.5px] leading-[1.55]" style={{ color: '#9aa9a3' }}>
          Acepto recibir información sobre las actividades, servicios y productos de Carp Partners.
        </span>
      </label>

      {error && (
        <p className="px-3 py-2.5 rounded-lg text-[13px] mb-4" style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.3)', color: '#ff8a80' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="w-full inline-flex items-center justify-center gap-[9px] py-[15px] rounded-[11px] text-white font-bold text-[15px] transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: '#68140b', boxShadow: '0 8px 24px rgba(104,20,11,0.45)', border: 'none' }}
      >
        {sending ? 'Enviando…' : 'Enviar mensaje'}
      </button>
    </form>
  );
}
