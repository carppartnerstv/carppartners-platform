import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const { stripe } = await import('../backend/src/services/stripe.js');

const dbCustomerId = 'cus_TEFi6K88llpxz4';

const customer = await stripe.customers.retrieve(dbCustomerId).catch((e) => { console.log('retrieve() falló:', e.message); return null; });
console.log('1) Customer en nuestra BD:', dbCustomerId);
console.log('   email en Stripe:', JSON.stringify(customer?.email));
console.log('   deleted:', customer?.deleted);
console.log('   created:', customer ? new Date(customer.created * 1000).toISOString() : '?');

const email = customer && !customer.deleted ? customer.email : 'vwpassat130@hotmail.com';
console.log('2) Email usado para buscar:', JSON.stringify(email));

const escaped = email.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const others = await stripe.customers.search({ query: `email:'${escaped}'`, limit: 10 });
console.log('3) customers.search() encuentra', others.data.length, 'resultados:');
others.data.forEach((c) => console.log('   -', c.id, JSON.stringify(c.email), 'creado', new Date(c.created * 1000).toISOString()));

// También probamos con el email tal cual lo escribió el usuario (minúsculas, sin normalizar)
const email2 = 'vwpassat130@hotmail.com';
if (email2 !== email) {
  const others2 = await stripe.customers.search({ query: `email:'${email2}'`, limit: 10 });
  console.log(`4) Búsqueda alternativa con "${email2}":`, others2.data.length, 'resultados:');
  others2.data.forEach((c) => console.log('   -', c.id, JSON.stringify(c.email), 'creado', new Date(c.created * 1000).toISOString()));
}

console.log('\n6) Detalle de cada uno de los 6 customers:');
for (const c of others.data) {
  const subs = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 10 });
  const schedules = await stripe.subscriptionSchedules.list({ customer: c.id, limit: 10 });
  const charges = await stripe.charges.list({ customer: c.id, limit: 5 });
  console.log(`   ${c.id} (creado ${new Date(c.created * 1000).toISOString().slice(0, 10)}):`);
  console.log(`     suscripciones: ${subs.data.map((s) => `${s.id}(${s.status})`).join(', ') || 'ninguna'}`);
  console.log(`     schedules: ${schedules.data.map((sc) => `${sc.id}(${sc.status})`).join(', ') || 'ninguna'}`);
  console.log(`     cargos: ${charges.data.map((ch) => `${ch.id}(${ch.status}, ${ch.amount / 100}${ch.currency}, ${new Date(ch.created * 1000).toISOString().slice(0, 10)})`).join(', ') || 'ninguno'}`);
}

process.exit(0);
