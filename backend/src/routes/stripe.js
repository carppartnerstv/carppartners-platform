// =====================================================================
// Webhook de Stripe.  (Briefing 4.4)
//
// IMPORTANTE: este router se monta ANTES de express.json() y usa
// express.raw() porque la verificación de firma necesita el body EXACTO
// tal cual lo envió Stripe. Si se parsea como JSON, la firma no valida.
//
// Eventos manejados:
//   invoice.paid                    -> suscripción 'active', actualiza period_end
//   invoice.payment_failed          -> 'past_due'
//   customer.subscription.deleted   -> 'cancelled'
//   customer.subscription.updated   -> actualiza plan/estado
//   customer.subscription.created   -> alta inicial
// =====================================================================
import { Router } from 'express';
import express from 'express';
import { stripe } from '../services/stripe.js';
import {
  upsertSubscriptionFromStripe,
  markSubscriptionCancelled,
} from '../services/subscriptions.js';
import { config } from '../config/index.js';

export const stripeWebhookRouter = Router();

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
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await upsertSubscriptionFromStripe(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await markSubscriptionCancelled(event.data.object.id);
          break;

        case 'invoice.paid': {
          // Recuperamos la suscripción completa para tener period_end actualizado.
          const invoice = event.data.object;
          if (invoice.subscription) {
            const sub = await stripe.subscriptions.retrieve(invoice.subscription);
            await upsertSubscriptionFromStripe(sub);
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          if (invoice.subscription) {
            const sub = await stripe.subscriptions.retrieve(invoice.subscription);
            await upsertSubscriptionFromStripe(sub); // mapStripeStatus -> 'past_due'
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
