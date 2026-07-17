// =====================================================================
// Contenido de las plantillas de email — cada función devuelve
// {subject, html, text} usando el layout compartido de mailLayout.js
// (una sola tabla HTML con bloques opcionales). Aquí solo vive el texto
// de cada variante: la maquetación vive en mailLayout.js.
// =====================================================================
import { config } from '../config/index.js';
import { renderEmailLayout, escapeHtml } from './mailLayout.js';

export { escapeHtml };

function greetingLine(name) {
  return name ? `Hola ${name},` : 'Hola,';
}

export function welcomeEmail({ name }) {
  const greeting = greetingLine(name);
  const ctaUrl = `${config.publicWebUrl}/home`;
  const html = renderEmailLayout({
    previewText: 'Tu cuenta ya está lista — empieza a ver ahora.',
    eyebrow: 'Bienvenido a bordo',
    heading: `¡Bienvenido a Carp Partners TV, ${greeting}!`,
    bodyText1: `Tu cuenta ya está activa. Desde ahora tienes acceso a todo nuestro catálogo de series, documentales y técnicas de carpfishing en alta definición, con contenido nuevo cada semana.`,
    bodyText2: 'Para empezar, te recomendamos ver el primer episodio de La Picada, nuestra serie insignia.',
    button: { label: 'Empezar a ver', url: ctaUrl },
    perks: [
      'Catálogo completo en alta definición, sin anuncios',
      'Contenido nuevo cada semana',
      'Disponible en web, iOS y Android',
      'Cancela cuando quieras desde tu perfil',
    ],
    signOffLine1: '¡Nos vemos en el agua!',
    signOffLine2: 'El equipo de Carp Partners TV',
  });
  return {
    subject: 'Bienvenido a Carp Partners TV',
    html,
    text: `${greeting}\n\nTu cuenta ya está activa. Desde ahora tienes acceso a todo nuestro catálogo de series, documentales y técnicas de carpfishing en alta definición, con contenido nuevo cada semana.\n\nEmpieza aquí: ${ctaUrl}\n\n¡Nos vemos en el agua!\nEl equipo de Carp Partners TV`,
  };
}

export function passwordResetEmail({ name, resetUrl }) {
  const greeting = greetingLine(name);
  const html = renderEmailLayout({
    previewText: 'Restablece tu contraseña de Carp Partners TV.',
    eyebrow: 'Seguridad de tu cuenta',
    heading: 'Restablece tu contraseña',
    bodyText1: `${greeting} hemos recibido una solicitud para restablecer tu contraseña de Carp Partners TV. Pulsa el botón para crear una nueva.`,
    button: { label: 'Crear nueva contraseña', url: resetUrl },
    linkFallback: { label: 'Si el botón no funciona, copia y pega este enlace en tu navegador:', url: resetUrl },
    note: 'Este enlace caduca en 30 minutos. Si no has sido tú, puedes ignorar este correo — tu contraseña actual seguirá funcionando.',
    signOffLine1: 'Un saludo,',
    signOffLine2: 'El equipo de Carp Partners TV',
  });
  return {
    subject: 'Restablece tu contraseña — Carp Partners TV',
    html,
    text: `${greeting}\n\nHemos recibido una solicitud para restablecer tu contraseña de Carp Partners TV. Abre este enlace para crear una nueva (caduca en 30 minutos):\n${resetUrl}\n\nSi no has sido tú, puedes ignorar este correo.\n\nUn saludo,\nEl equipo de Carp Partners TV`,
  };
}

export function setPasswordEmail({ name, setUrl }) {
  const greeting = greetingLine(name);
  const html = renderEmailLayout({
    previewText: 'Elige tu contraseña para activar tu cuenta.',
    eyebrow: 'Activa tu cuenta',
    heading: 'Elige tu contraseña',
    bodyText1: `${greeting} te hemos dado de alta como suscriptor en Carp Partners TV. Para acceder a tu cuenta, primero elige una contraseña.`,
    button: { label: 'Establecer contraseña', url: setUrl },
    linkFallback: { label: 'Si el botón no funciona, copia y pega este enlace en tu navegador:', url: setUrl },
    note: 'Este enlace caduca en 14 días.',
    signOffLine1: 'Un saludo,',
    signOffLine2: 'El equipo de Carp Partners TV',
  });
  return {
    subject: 'Establece tu contraseña — Carp Partners TV',
    html,
    text: `${greeting}\n\nTe hemos dado de alta como suscriptor en Carp Partners TV. Abre este enlace para elegir tu contraseña (caduca en 14 días):\n${setUrl}\n\nUn saludo,\nEl equipo de Carp Partners TV`,
  };
}

export function contactAdminNotification({ name, email, subject, message }) {
  const summary = subject ? `${name} · ${email} · ${subject}` : `${name} · ${email}`;
  const html = renderEmailLayout({
    previewText: `Nuevo mensaje de contacto de ${name}`,
    eyebrow: 'Panel de administración',
    heading: 'Nuevo mensaje de contacto',
    bodyText1: 'Alguien ha usado el formulario de contacto de la web. Estos son los detalles:',
    bodyText2: summary,
    quoteLabel: 'Mensaje',
    quoteText: message,
    button: { label: 'Ver en el panel', url: `${config.publicWebUrl}/admin/mensajes` },
    signOffLine1: 'Recibirás este aviso cada vez que alguien escriba desde /contacto.',
    signOffLine2: 'Carp Partners TV',
  });
  return {
    subject: `Contacto: ${subject || 'Nuevo mensaje'} — ${name}`,
    html,
    text: `Nuevo mensaje desde el formulario de contacto:\n\nNombre: ${name}\nEmail: ${email}\n${subject ? `Asunto: ${subject}\n` : ''}\n${message}\n\nVerlo en el panel: ${config.publicWebUrl}/admin/mensajes`,
  };
}

export function contactAcknowledgmentEmail({ name, subject, message }) {
  const greeting = greetingLine(name);
  const html = renderEmailLayout({
    previewText: 'Hemos recibido tu mensaje.',
    eyebrow: 'Mensaje recibido',
    heading: `Gracias por escribirnos, ${greeting}`,
    bodyText1: `Nuestro equipo ha recibido tu consulta a través del formulario de contacto y te responderemos en un plazo máximo de 48 horas laborables.`,
    quoteLabel: subject ? `Tu mensaje — ${subject}` : 'Tu mensaje original',
    quoteText: message,
    signOffLine1: 'Un saludo,',
    signOffLine2: 'El equipo de Carp Partners TV',
  });
  return {
    subject: 'Hemos recibido tu mensaje — Carp Partners TV',
    html,
    text: `${greeting}\n\nGracias por escribirnos. Hemos recibido tu mensaje y te responderemos lo antes posible.\n\nUn saludo,\nEl equipo de Carp Partners TV`,
  };
}

// ---------------------------------------------------------------------
// Variantes listas para usar pero AÚN NO conectadas a ningún disparador
// real (no hay flujo de verificación de email al registrarse, y el
// webhook de Stripe no envía aviso de pago fallido ni de cancelación).
// Se añaden ya redactadas para cuando se decida activarlas.
// ---------------------------------------------------------------------

export function emailVerificationEmail({ name, verifyUrl }) {
  const greeting = greetingLine(name);
  const html = renderEmailLayout({
    previewText: 'Confirma tu dirección de correo.',
    eyebrow: 'Verifica tu correo',
    heading: 'Confirma tu dirección de email',
    bodyText1: `${greeting} para terminar de activar tu cuenta de Carp Partners TV, confirma que esta dirección de correo es tuya.`,
    button: { label: 'Verificar mi correo', url: verifyUrl },
    linkFallback: { label: 'Si el botón no funciona, copia y pega este enlace en tu navegador:', url: verifyUrl },
    note: 'Este enlace caduca en 24 horas. Si no has creado una cuenta en Carp Partners TV, puedes ignorar este correo.',
    signOffLine1: 'Un saludo,',
    signOffLine2: 'El equipo de Carp Partners TV',
  });
  return {
    subject: 'Confirma tu correo — Carp Partners TV',
    html,
    text: `${greeting}\n\nPara terminar de activar tu cuenta, confirma tu correo en este enlace (caduca en 24 horas):\n${verifyUrl}\n\nUn saludo,\nEl equipo de Carp Partners TV`,
  };
}

export function paymentFailedEmail({ name, updatePaymentUrl }) {
  const greeting = greetingLine(name);
  const html = renderEmailLayout({
    previewText: 'No hemos podido procesar tu pago.',
    eyebrow: 'Aviso de pago',
    heading: 'No hemos podido procesar tu pago',
    bodyText1: `${greeting} hemos intentado cobrar tu suscripción de Carp Partners TV y el pago no se ha completado. Puede deberse a una tarjeta caducada o a fondos insuficientes.`,
    bodyText2: 'Actualiza tus datos de pago para que tu acceso no se interrumpa.',
    button: { label: 'Actualizar método de pago', url: updatePaymentUrl },
    note: 'Si no se regulariza el pago en los próximos días, tu suscripción podría quedar pausada.',
    signOffLine1: 'Un saludo,',
    signOffLine2: 'El equipo de Carp Partners TV',
  });
  return {
    subject: 'No hemos podido procesar tu pago — Carp Partners TV',
    html,
    text: `${greeting}\n\nHemos intentado cobrar tu suscripción y el pago no se ha completado. Actualiza tus datos de pago aquí:\n${updatePaymentUrl}\n\nSi no se regulariza en los próximos días, tu suscripción podría quedar pausada.\n\nUn saludo,\nEl equipo de Carp Partners TV`,
  };
}

export function subscriptionCancelledEmail({ name, resubscribeUrl }) {
  const greeting = greetingLine(name);
  const html = renderEmailLayout({
    previewText: 'Tu suscripción se ha cancelado.',
    eyebrow: 'Suscripción cancelada',
    heading: 'Tu suscripción se ha cancelado',
    bodyText1: `${greeting} hemos cancelado tu suscripción de Carp Partners TV, tal y como solicitaste. Mantendrás el acceso hasta el final del periodo ya pagado.`,
    bodyText2: '¿Cambias de opinión? Puedes reactivarla cuando quieras.',
    button: { label: 'Reactivar suscripción', url: resubscribeUrl },
    signOffLine1: 'Gracias por haber formado parte de la tripulación.',
    signOffLine2: 'El equipo de Carp Partners TV',
  });
  return {
    subject: 'Tu suscripción se ha cancelado — Carp Partners TV',
    html,
    text: `${greeting}\n\nHemos cancelado tu suscripción, tal y como solicitaste. Mantendrás el acceso hasta el final del periodo ya pagado.\n\n¿Cambias de opinión? Reactívala aquí:\n${resubscribeUrl}\n\nGracias por haber formado parte de la tripulación.\nEl equipo de Carp Partners TV`,
  };
}
