// Documentation FR: Script utilitaire exécuté manuellement pour la configuration du projet.

import fs from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';

const envPath = path.join(process.cwd(), '.env');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !line.trim().startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

if (!env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY in .env');
}

if (!env.APP_URL) {
  throw new Error('Missing APP_URL in .env');
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

async function getOrCreateProduct(plan, name, description) {
  const products = await stripe.products.list({ active: true, limit: 100 });
  const existing = products.data.find((product) => product.metadata?.kusari_plan === plan);
  if (existing) return existing;

  return stripe.products.create({
    name,
    description,
    metadata: { kusari_plan: plan },
  });
}

async function getOrCreatePrice(productId, amount, interval, plan) {
  const prices = await stripe.prices.list({ active: true, limit: 100 });
  const existing = prices.data.find(
    (price) =>
      price.product === productId &&
      price.currency === 'chf' &&
      price.unit_amount === amount &&
      price.recurring?.interval === interval
  );

  if (existing) return existing;

  return stripe.prices.create({
    product: productId,
    currency: 'chf',
    unit_amount: amount,
    recurring: { interval },
    metadata: { tracker_plan: plan },
  });
}

async function getWebhookInfo() {
  const targetUrl = `${env.APP_URL.replace(/\/$/, '')}/api/stripe/webhook`;
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = endpoints.data.find((endpoint) => endpoint.url === targetUrl);

  if (existing) {
    return {
      webhookId: existing.id,
      webhookSecret: existing.secret || '',
      webhookNote: 'already_exists',
    };
  }

  const created = await stripe.webhookEndpoints.create({
    url: targetUrl,
    enabled_events: [
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_failed',
    ],
    description: 'tracker billing webhook',
  });

  return {
    webhookId: created.id,
    webhookSecret: created.secret || '',
    webhookNote: 'created',
  };
}

const monthlyProduct = await getOrCreateProduct('monthly', 'tracker Monthly', "14 jours d'essai puis 2 CHF/mois");
const yearlyProduct = await getOrCreateProduct('yearly', 'tracker Yearly', '19 CHF/an');
const monthlyPrice = await getOrCreatePrice(monthlyProduct.id, 200, 'month', 'monthly');
const yearlyPrice = await getOrCreatePrice(yearlyProduct.id, 1900, 'year', 'yearly');

let webhook = { webhookId: '', webhookSecret: '', webhookNote: 'not_attempted' };
try {
  webhook = await getWebhookInfo();
} catch (error) {
  webhook = {
    webhookId: '',
    webhookSecret: '',
    webhookNote: error instanceof Error ? error.message : String(error),
  };
}

console.log(
  JSON.stringify(
    {
      monthlyPriceId: monthlyPrice.id,
      yearlyPriceId: yearlyPrice.id,
      ...webhook,
    },
    null,
    2
  )
);
