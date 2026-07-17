'use client';

import React, { useState } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '13px 14px',
  color: '#eef3f0',
  fontFamily: 'Inter, sans-serif',
  fontSize: 14.5,
  outline: 'none',
};

// Maquetación del formulario de contacto, conectada a POST /contact (guarda
// la consulta, avisa a MAIL_ADMIN y manda acuse de recibo al usuario).
export function ContactForm() {
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError]     = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Rellena tu nombre, correo y mensaje.');
      return;
    }

    setSending(true);
    try {
      await apiClient.submitContact({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim() || undefined,
        message: message.trim(),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el mensaje. Inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div
        className="rounded-[16px] px-[26px] py-[30px] text-center mt-4"
        style={{ background: 'rgba(104,20,11,0.1)', border: '1px solid rgba(207,74,53,0.3)' }}
      >
        <i className="ti ti-circle-check text-[32px]" style={{ color: '#cf4a35' }} />
        <p className="font-display font-semibold text-white text-[17px] mt-3 mb-1.5">Mensaje enviado</p>
        <p className="text-[14px]" style={{ color: '#9aa9a3' }}>
          Gracias por escribirnos, {name.split(' ')[0]}. Te responderemos lo antes posible.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[12.5px] font-semibold mb-2" style={{ color: '#b3c0ba' }}>Nombre</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" style={inputStyle} />
        </div>
        <div>
          <label className="block text-[12.5px] font-semibold mb-2" style={{ color: '#b3c0ba' }}>Correo electrónico</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" style={inputStyle} />
        </div>
      </div>
      <div>
        <label className="block text-[12.5px] font-semibold mb-2" style={{ color: '#b3c0ba' }}>Asunto</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="¿En qué podemos ayudarte?" style={inputStyle} />
      </div>
      <div>
        <label className="block text-[12.5px] font-semibold mb-2" style={{ color: '#b3c0ba' }}>Mensaje</label>
        <textarea
          value={message} onChange={e => setMessage(e.target.value)} placeholder="Escribe tu mensaje…" rows={5}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {error && (
        <p className="px-3 py-2.5 rounded-lg text-[13px]" style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.3)', color: '#ff8a80' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="inline-flex items-center gap-[9px] px-[26px] py-[13px] rounded-[11px] text-white font-bold text-[14.5px] transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: '#68140b', boxShadow: '0 8px 24px rgba(104,20,11,0.45)', border: 'none' }}
      >
        {sending ? 'Enviando…' : 'Enviar mensaje'}
        <i className="ti ti-send text-[17px]" />
      </button>
    </form>
  );
}
