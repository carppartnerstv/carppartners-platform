import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const { stripe } = await import('../backend/src/services/stripe.js');

const dbCustomerId = 'cus_SAPj2U4ovGRpJa';

const customer = await stripe.customers.retrieve(dbCustomerId).catch((e) => { console.log('retrieve() falló:', e.message); return null; });
console.log('1) Customer en nuestra BD:', dbCustomerId, '-> email en Stripe:', customer?.email, '- deleted:', customer?.deleted);

const email = customer && !customer.deleted ? customer.email : 'barnygambel_89@hotmail.com';
console.log('2) Email usado para buscar:', email);

const escaped = email.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const others = await stripe.customers.search({ query: `email:'${escaped}'`, limit: 10 });
console.log('3) customers.search() encuentra', others.data.length, 'resultados:');
others.data.forEach((c) => console.log('   -', c.id, c.email, 'creado', new Date(c.created * 1000).toISOString()));

const duplicates = others.data.filter((c) => c.id !== dbCustomerId);
console.log('4) De esos, distintos al nuestro:', duplicates.length);

for (const dup of duplicates) {
  const subs = await stripe.subscriptions.list({ customer: dup.id, status: 'all', limit: 10 });
  console.log(`   Suscripciones de ${dup.id}:`, subs.data.map((s) => `${s.id}(${s.status}, creada ${new Date(s.created * 1000).toISOString().slice(0,10)})`));

  const schedules = await stripe.subscriptionSchedules.list({ customer: dup.id, limit: 10 });
  console.log(`   Subscription Schedules de ${dup.id}:`, schedules.data.map((sc) => ({
    id: sc.id, status: sc.status, subscription: sc.subscription,
    phases: sc.phases?.map((p) => ({ start: new Date(p.start_date * 1000).toISOString().slice(0,10), price: p.items?.[0]?.price })),
  })));

  const charges = await stripe.charges.list({ customer: dup.id, limit: 10 });
  console.log(`   Cargos de ${dup.id}:`, charges.data.map((c) => `${c.id}(${c.status}, ${c.amount/100}${c.currency}, ${new Date(c.created*1000).toISOString().slice(0,10)})`));
}

process.exit(0);
