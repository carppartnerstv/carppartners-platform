// =====================================================================
// Webhook de Stripe.  (Briefing 4.4)
//
// IMPORTANTE: este router se monta ANTES de express.json() y usa
// express.raw() porque la verificación de firma necesita el body EXACTO
// tal cual lo envió Stripe. Si se parsea como JSON, la firma no valida.
//
// Eventos manejados — ESTOS son los que el endpoint real tiene habilitados en
// Stripe (Dashboard > Webhooks); antes de tocar el switch de abajo, comprueba
// ahí qué eventos llegan de verdad, un nombre distinto simplemente no entra
// nunca (ver invoice.payment_succeeded más abajo, corregido tras auditoría):
//   checkout.session.completed      -> alta inicial (vía más rápida tras el pago)
//   invoice.payment_succeeded       -> renovación correcta, actualiza status/period_end
//                                       (también se acepta invoice.paid por si el
//                                       endpoint cambiara de configuración algún día)
//   invoice.payment_failed          -> 'past_due' + email al primer fallo (avisa
//                                       aunque el estado siga dando acceso —
//                                       periodo de gracia mientras Stripe reintenta)
//   customer.subscription.deleted   -> 'cancelled' + email de winback (la baja ya
//                                       es efectiva, el acceso ya se ha cortado)
//   customer.subscription.updated   -> actualiza plan/estado; si cancel_at_period_end
//                                       pasa de false a true, email de cancelación
//                                       PROGRAMADA (en ESE momento, no en el borrado
//                                       final — ahí es cuando el mensaje "mantienes
//                                       el acceso hasta X" sigue siendo cierto)
//   customer.subscription.created   -> alta inicial (respaldo si el evento de
//                                       arriba no llegara)
// =====================================================================
import { Router } from 'express';
import express from 'express';
import { stripe } from '../services/stripe.js';
import {
  upsertSubscriptionFromStripe,
  markSubscriptionCancelled,
} from '../services/subscriptions.js';
import { config } from '../config/index.js';
import { queryOne } from '../config/db.js';
import { sendMail } from '../services/mail.js';
import { paymentFailedEmail, subscriptionCancelledEmail, subscriptionEndedEmail } from '../services/mailTemplates.js';

export const stripeWebhookRouter = Router();

async function findUserByCustomerId(customerId) {
  return queryOne('SELECT name, email FROM users WHERE stripe_customer_id = $1', [customerId]);
}

stripeWebhookRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    let event;

    // 1) Verificar la firma criptográfica ANTES de procesar nada.
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, config.stripe.webhookSecret);
    } catch (err) {
      console.error('[stripe] Firma de webhook inválida:', err.message);
      return res.status(400).send(`Webhook signature verification failed`);
    }

    // 2) Procesar el evento. Devolvemos 200 rápido para que Stripe no reintente.
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          if (session.mode === 'subscription' && session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription);
            await upsertSubscriptionFromStripe(sub); // idempotente (ON CONFLICT stripe_sub_id)
          }
          break;
        }

        case 'customer.subscription.created':
          await upsertSubscriptionFromStripe(event.data.object);
          break;

        case 'customer.subscription.updated': {
          const sub = event.data.object;
          const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
          const before = await queryOne(
            'SELECT cancel_at_period_end FROM subscriptions WHERE stripe_sub_id = $1',
            [sub.id],
          );
          await upsertSubscriptionFromStripe(sub);

          const justScheduledCancel = !before?.cancel_at_period_end && sub.cancel_at_period_end;
          if (justScheduledCancel) {
            const user = await findUserByCustomerId(customerId);
            if (user) {
              sendMail({
                to: user.email,
                ...subscriptionCancelledEmail({ name: user.name, resubscribeUrl: `${config.publicWebUrl}/perfil` }),
              });
            }
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          // Comprobamos el estado ANTES de actualizar — si Stripe reintenta la
          // entrega de este mismo evento (p. ej. porque una entrega anterior
          // devolvió error después de escribir en BD), no queremos reenviar
          // el email de winback una segunda vez.
          const before = await queryOne(
            'SELECT status FROM subscriptions WHERE stripe_sub_id = $1',
            [sub.id],
          );
          await markSubscriptionCancelled(sub.id);

          if (before?.status !== 'cancelled') {
            const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
            const user = await findUserByCustomerId(customerId);
            if (user) {
              sendMail({
                to: user.email,
                ...subscriptionEndedEmail({ name: user.name, resubscribeUrl: `${config.publicWebUrl}/planes` }),
              });
            }
          }
          break;
        }

        case 'invoice.paid':
        case 'invoice.payment_succeeded': {
          // Recuperamos la suscripción completa para tener period_end actualizado.
          const invoice = event.data.object;
          if (invoice.subscription) {
            const sub = await stripe.subscriptions.retrieve(invoice.subscription);
            await upsertSubscriptionFromStripe(sub);

            // Punto preparado para un futuro email de recibo de renovación —
            // NO implementado todavía (pedido explícito: dejar el sitio listo,
            // sin conectar nada). Cuando se haga, distinguir la renovación de
            // pago de la alta inicial con invoice.billing_reason ===
            // 'subscription_cycle' (en la primera factura es
            // 'subscription_create', ese caso ya lo cubre welcomeEmail/checkout).
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          if (invoice.subscription) {
            const sub = await stripe.subscriptions.retrieve(invoice.subscription);
            await upsertSubscriptionFromStripe(sub); // mapStripeStatus -> 'past_due'

            // Solo en el primer intento fallido de esta factura — Stripe reintenta
            // varias veces (Smart Retries) y volvería a disparar este evento en
            // cada uno; con esto avisamos una vez, no una vez por reintento.
            if (invoice.attempt_count === 1) {
              const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
              const user = await findUserByCustomerId(customerId);
              if (user) {
                sendMail({
                  to: user.email,
                  ...paymentFailedEmail({ name: user.name, updatePaymentUrl: `${config.publicWebUrl}/perfil` }),
                });
              }
            }
          }
          break;
        }

        case 'payment_intent.succeeded':
          // Reservado para pagos puntuales futuros (Briefing 4.4).
          break;

        default:
          // No es un error: simplemente no nos interesa este evento.
          break;
      }

      res.json({ received: true });
    } catch (err) {
      // Si falla el procesamiento, devolvemos 500 para que Stripe reintente.
      console.error(`[stripe] Error procesando ${event.type}:`, err);
      res.status(500).json({ error: 'processing_failed' });
    }
  },
);
